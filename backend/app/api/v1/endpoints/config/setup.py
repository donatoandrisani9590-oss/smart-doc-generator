"""
Initial Setup API endpoints.

These endpoints are only available when no admin user exists in the database.
Used for first-time setup after deployment.
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr

from app.db import get_db
from app.models.core import User, DesignSetting
from app.models.documents import Clause, DocumentType, DocumentTypeClause
from app.core.security import get_password_hash
from app.api import deps

import logging
logger = logging.getLogger(__name__)

router = APIRouter()


class SetupStatus(BaseModel):
    """Status of the system setup."""
    setup_required: bool
    has_admin: bool
    has_design_settings: bool


class InitialAdminCreate(BaseModel):
    """Schema for creating the initial admin user."""
    email: EmailStr
    password: str
    company_name: str = "Niederwieser Flexible Food Packaging GmbH"


class SetupResponse(BaseModel):
    """Response after successful setup."""
    message: str
    admin_email: str
    admin_id: int


@router.get("/status", response_model=SetupStatus)
async def get_setup_status(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Check if initial setup is required.

    Returns whether the system needs initial configuration.
    This endpoint is always public.
    """
    # Check for any admin user
    admin_query = select(func.count(User.id)).where(User.role == "admin")
    admin_result = await db.execute(admin_query)
    admin_count = admin_result.scalar() or 0

    # Check for design settings
    settings_query = select(func.count(DesignSetting.id))
    settings_result = await db.execute(settings_query)
    settings_count = settings_result.scalar() or 0

    return SetupStatus(
        setup_required=admin_count == 0,
        has_admin=admin_count > 0,
        has_design_settings=settings_count > 0,
    )


@router.post("/initialize", response_model=SetupResponse)
async def initialize_system(
    setup_data: InitialAdminCreate,
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Initialize the system with the first admin user.

    This endpoint is ONLY available when no admin user exists.
    After the first admin is created, this endpoint becomes disabled.

    Creates:
    - Initial admin user
    - Default design settings for DE
    """
    # Security check: Only allow if no admin exists
    admin_query = select(func.count(User.id)).where(User.role == "admin")
    admin_result = await db.execute(admin_query)
    admin_count = admin_result.scalar() or 0

    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System bereits initialisiert. Verwenden Sie das Admin-Panel zur Benutzerverwaltung."
        )

    # Validate password
    if len(setup_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwort muss mindestens 8 Zeichen lang sein"
        )

    # Check if email already exists
    existing_query = select(User).where(User.email == setup_data.email.lower())
    existing_result = await db.execute(existing_query)
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ein Benutzer mit dieser E-Mail existiert bereits"
        )

    # Create admin user
    admin_user = User(
        email=setup_data.email.lower(),
        password_hash=get_password_hash(setup_data.password),
        role="admin",
        country_code="DE",
        is_active=True,
    )
    db.add(admin_user)

    # Create default design settings if not exists
    settings_query = select(DesignSetting).where(DesignSetting.country_code == "DE")
    settings_result = await db.execute(settings_query)
    if not settings_result.scalar_one_or_none():
        de_settings = DesignSetting(
            country_code="DE",
            company_name=setup_data.company_name,
            header_line1=setup_data.company_name,
            header_line2="",
            header_line3="",
            footer_line1="",
            footer_line2="",
            footer_line3="",
            font_family="Arial",
            primary_color="#243186",
            font_size_pt=11,
            line_spacing="1.15",
            margin_left_cm="2.5",
            margin_right_cm="2.0",
            margin_top_cm="2.5",
            margin_bottom_cm="2.0",
        )
        db.add(de_settings)

    await db.commit()
    await db.refresh(admin_user)

    return SetupResponse(
        message="System initialized successfully. You can now log in.",
        admin_email=admin_user.email,
        admin_id=admin_user.id,
    )


@router.post("/migrate-schema")
async def migrate_schema(
    db: Annotated[AsyncSession, Depends(get_db)]
):
    """
    Add missing columns to existing database tables.

    This endpoint runs schema migrations for:
    - document_types: custom header/footer/logo columns

    Safe to run multiple times (uses IF NOT EXISTS).
    """
    from sqlalchemy import text

    migrations = []
    errors = []

    # document_types table - custom header/footer/logo columns
    document_type_columns = [
        ("custom_header_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_header_line1", "TEXT"),
        ("custom_header_line2", "TEXT"),
        ("custom_header_line3", "TEXT"),
        ("custom_footer_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_footer_line1", "TEXT"),
        ("custom_footer_line2", "TEXT"),
        ("custom_footer_line3", "TEXT"),
        ("custom_logo_enabled", "BOOLEAN DEFAULT FALSE"),
        ("custom_logo_path", "VARCHAR"),
        ("custom_logo_position", "VARCHAR(20)"),
        ("custom_logo_width_cm", "VARCHAR(10)"),
        ("custom_margin_left_cm", "VARCHAR(10)"),
        ("custom_margin_right_cm", "VARCHAR(10)"),
        ("custom_margin_top_cm", "VARCHAR(10)"),
        ("custom_margin_bottom_cm", "VARCHAR(10)"),
        ("source_template_id", "INTEGER REFERENCES document_types(id) ON DELETE SET NULL"),
        ("team_id", "INTEGER REFERENCES teams(id) ON DELETE SET NULL"),
        ("visibility", "VARCHAR(20) DEFAULT 'global'"),
        ("created_by_user_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
        ("created_at", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
    ]

    for col_name, col_type in document_type_columns:
        try:
            # Check if column exists (parameterized query)
            check_sql = text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = :table_name AND column_name = :col_name
            """)
            result = await db.execute(check_sql, {"table_name": "document_types", "col_name": col_name})
            if not result.fetchone():
                # Column doesn't exist, add it
                # Note: DDL column names/types cannot be parameterized,
                # but values come from a hardcoded list above (not user input)
                alter_sql = text(f"ALTER TABLE document_types ADD COLUMN {col_name} {col_type}")
                await db.execute(alter_sql)
                migrations.append(f"Added column document_types.{col_name}")
        except Exception as e:
            errors.append(f"Failed to add document_types.{col_name}: {str(e)}")

    await db.commit()

    return {
        "status": "completed",
        "migrations_applied": migrations,
        "errors": errors,
        "total_migrations": len(migrations),
        "total_errors": len(errors)
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE SEEDING - Professional Arbeitsvertrag clauses
# ══════════════════════════════════════════════════════════════════════════════

ARBEITSVERTRAG_CLAUSES = [
    {
        "title": "Beginn und Dauer des Arbeitsverhältnisses",
        "content_html": '<p><strong>&sect; 1 Beginn und Dauer des Arbeitsverh&auml;ltnisses</strong></p><p>Das Arbeitsverh&auml;ltnis beginnt am <strong>[eintrittsdatum]</strong> und wird auf unbestimmte Zeit geschlossen.</p>',
        "category": "Arbeitsrecht", "tags": ["beginn", "dauer"], "tone": "neutral",
        "is_mandatory": True, "display_order": 1,
    },
    {
        "title": "Probezeit",
        "content_html": '<p><strong>&sect; 2 Probezeit</strong></p><p>Die ersten <strong>[probezeit]</strong> des Arbeitsverh&auml;ltnisses gelten als Probezeit. W&auml;hrend der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von zwei Wochen gek&uuml;ndigt werden.</p>',
        "category": "Arbeitsrecht", "tags": ["probezeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 2,
        "clause_type": "conditional",
        "condition": '{"field": "probezeit", "operator": "!=", "value": "Keine"}',
    },
    {
        "title": "Tätigkeit und Aufgabengebiet",
        "content_html": '<p><strong>&sect; 3 T&auml;tigkeit und Aufgabengebiet</strong></p><p>Der Arbeitnehmer wird als <strong>[position]</strong> eingestellt. Der Arbeitgeber beh&auml;lt sich vor, dem Arbeitnehmer im Rahmen des Direktionsrechts auch andere zumutbare T&auml;tigkeiten zuzuweisen, die seinen Kenntnissen und F&auml;higkeiten entsprechen.</p><p>Der Arbeitnehmer verpflichtet sich, die ihm &uuml;bertragenen Aufgaben gewissenhaft und sorgf&auml;ltig auszuf&uuml;hren und die Interessen des Arbeitgebers zu wahren.</p>',
        "category": "Arbeitsrecht", "tags": ["tätigkeit", "position"], "tone": "neutral",
        "is_mandatory": True, "display_order": 3,
    },
    {
        "title": "Arbeitsort",
        "content_html": '<p><strong>&sect; 4 Arbeitsort</strong></p><p>Der Arbeitsort ist der Sitz des Arbeitgebers. Der Arbeitgeber beh&auml;lt sich vor, den Arbeitnehmer auch an anderen Betriebsst&auml;tten oder bei Kunden einzusetzen, soweit dies zumutbar ist.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitsort"], "tone": "neutral",
        "is_mandatory": True, "display_order": 4,
    },
    {
        "title": "Arbeitszeit",
        "content_html": '<p><strong>&sect; 5 Arbeitszeit</strong></p><p>Die regelm&auml;&szlig;ige w&ouml;chentliche Arbeitszeit betr&auml;gt <strong>[wochenstunden]</strong> Stunden, ohne Ber&uuml;cksichtigung der Pausen. Die Verteilung der Arbeitszeit richtet sich nach den betrieblichen Erfordernissen.</p><p>Der Arbeitnehmer erkl&auml;rt sich bereit, im Rahmen der gesetzlichen Bestimmungen &Uuml;berstunden zu leisten, soweit dies betrieblich erforderlich ist.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitszeit", "wochenstunden"], "tone": "neutral",
        "is_mandatory": True, "display_order": 5,
    },
    {
        "title": "Vergütung",
        "content_html": '<p><strong>&sect; 6 Verg&uuml;tung</strong></p><p>Der Arbeitnehmer erh&auml;lt ein monatliches Bruttogehalt in H&ouml;he von <strong>[bruttogehalt]</strong>. Die Zahlung erfolgt bargeldlos jeweils zum Ende eines Kalendermonats auf ein vom Arbeitnehmer benanntes Konto.</p><p>Mit der vereinbarten Verg&uuml;tung sind etwaige &Uuml;berstunden bis zu einem Umfang von 10 % der vereinbarten w&ouml;chentlichen Arbeitszeit abgegolten.</p>',
        "category": "Arbeitsrecht", "tags": ["vergütung", "gehalt", "bruttogehalt"], "tone": "neutral",
        "is_mandatory": True, "display_order": 6,
    },
    {
        "title": "Urlaub",
        "content_html": '<p><strong>&sect; 7 Urlaub</strong></p><p>Der Arbeitnehmer hat Anspruch auf einen j&auml;hrlichen Erholungsurlaub von <strong>[urlaubstage]</strong> Arbeitstagen, bezogen auf eine 5-Tage-Woche. Der Urlaub ist grunds&auml;tzlich im laufenden Kalenderjahr zu nehmen.</p><p>Die zeitliche Festlegung des Urlaubs erfolgt unter Ber&uuml;cksichtigung der betrieblichen Belange und der W&uuml;nsche des Arbeitnehmers.</p>',
        "category": "Arbeitsrecht", "tags": ["urlaub", "urlaubstage"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 7,
    },
    {
        "title": "Krankheit und Arbeitsverhinderung",
        "content_html": '<p><strong>&sect; 8 Krankheit und Arbeitsverhinderung</strong></p><p>Im Falle der Arbeitsunf&auml;higkeit durch Krankheit ist der Arbeitnehmer verpflichtet, den Arbeitgeber unverz&uuml;glich zu informieren. Eine &auml;rztliche Arbeitsunf&auml;higkeitsbescheinigung ist sp&auml;testens am dritten Tag der Erkrankung vorzulegen.</p><p>Die Entgeltfortzahlung im Krankheitsfall richtet sich nach den gesetzlichen Bestimmungen.</p>',
        "category": "Arbeitsrecht", "tags": ["krankheit", "krankmeldung"], "tone": "neutral",
        "is_mandatory": True, "display_order": 8,
    },
    {
        "title": "Verschwiegenheitspflicht",
        "content_html": '<p><strong>&sect; 9 Verschwiegenheitspflicht</strong></p><p>Der Arbeitnehmer verpflichtet sich, &uuml;ber alle Betriebs- und Gesch&auml;ftsgeheimnisse sowie vertrauliche Informationen Stillschweigen zu bewahren. Diese Verschwiegenheitspflicht gilt auch nach Beendigung des Arbeitsverh&auml;ltnisses.</p>',
        "category": "Arbeitsrecht", "tags": ["verschwiegenheit", "geheimhaltung"], "tone": "streng",
        "is_mandatory": True, "display_order": 9,
    },
    {
        "title": "Nebentätigkeit",
        "content_html": '<p><strong>&sect; 10 Nebent&auml;tigkeit</strong></p><p>Jede entgeltliche oder zeitlich umfangreiche Nebent&auml;tigkeit bedarf der vorherigen schriftlichen Zustimmung des Arbeitgebers. Die Zustimmung ist zu erteilen, wenn berechtigte Interessen des Arbeitgebers nicht beeintr&auml;chtigt werden.</p>',
        "category": "Arbeitsrecht", "tags": ["nebentätigkeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 10,
    },
    {
        "title": "Kündigung",
        "content_html": '<p><strong>&sect; 11 K&uuml;ndigung</strong></p><p>Nach Ablauf der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von vier Wochen zum F&uuml;nfzehnten oder zum Ende eines Kalendermonats gek&uuml;ndigt werden. Es gelten im &Uuml;brigen die gesetzlichen K&uuml;ndigungsfristen gem&auml;&szlig; &sect; 622 BGB.</p><p>Die K&uuml;ndigung bedarf der Schriftform. Das Recht zur fristlosen K&uuml;ndigung aus wichtigem Grund bleibt unber&uuml;hrt.</p>',
        "category": "Arbeitsrecht", "tags": ["kündigung", "kündigungsfrist"], "tone": "neutral",
        "is_mandatory": True, "display_order": 11,
    },
    {
        "title": "Firmenwagen",
        "content_html": '<p><strong>&sect; 12 Firmenwagen</strong></p><p>Dem Arbeitnehmer wird ein Firmenfahrzeug zur Verf&uuml;gung gestellt, das auch zur privaten Nutzung verwendet werden darf. Die private Nutzung wird gem&auml;&szlig; der 1-%-Regelung als geldwerter Vorteil versteuert.</p><p>Bei Beendigung des Arbeitsverh&auml;ltnisses ist das Fahrzeug unverz&uuml;glich zur&uuml;ckzugeben.</p>',
        "category": "Zusatzleistungen", "tags": ["firmenwagen", "benefit"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False, "display_order": 12,
        "clause_type": "conditional",
        "condition": '{"field": "firmenwagen", "operator": "=", "value": true}',
    },
    {
        "title": "Home Office",
        "content_html": '<p><strong>&sect; 13 Mobiles Arbeiten (Home Office)</strong></p><p>Der Arbeitnehmer hat die M&ouml;glichkeit, nach Abstimmung mit dem Vorgesetzten teilweise im Home Office zu arbeiten. Der Arbeitgeber stellt die daf&uuml;r erforderliche technische Ausstattung zur Verf&uuml;gung.</p><p>Der Arbeitnehmer verpflichtet sich, auch bei mobiler Arbeit die datenschutzrechtlichen Bestimmungen einzuhalten.</p>',
        "category": "Zusatzleistungen", "tags": ["homeoffice", "remote", "benefit"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False, "display_order": 13,
        "clause_type": "conditional",
        "condition": '{"field": "homeoffice", "operator": "=", "value": true}',
    },
    {
        "title": "Datenschutz",
        "content_html": '<p><strong>&sect; 14 Datenschutz</strong></p><p>Der Arbeitnehmer verpflichtet sich, die geltenden Datenschutzbestimmungen (DSGVO, BDSG) einzuhalten und personenbezogene Daten nur im Rahmen der dienstlichen Erfordernis zu verarbeiten.</p>',
        "category": "Arbeitsrecht", "tags": ["datenschutz", "dsgvo"], "tone": "neutral",
        "is_mandatory": True, "display_order": 14,
    },
    {
        "title": "Vertragsstrafe",
        "content_html": '<p><strong>&sect; 15 Vertragsstrafe</strong></p><p>Tritt der Arbeitnehmer das Arbeitsverh&auml;ltnis nicht an oder l&ouml;st er es vertragswidrig, so hat er eine Vertragsstrafe in H&ouml;he eines Bruttomonatsgehalts zu zahlen.</p>',
        "category": "Arbeitsrecht", "tags": ["vertragsstrafe"], "tone": "streng",
        "is_mandatory": True, "display_order": 15,
    },
    {
        "title": "Ausschlussfristen",
        "content_html": '<p><strong>&sect; 16 Ausschlussfristen</strong></p><p>Alle beiderseitigen Anspr&uuml;che aus dem Arbeitsverh&auml;ltnis verfallen, wenn sie nicht innerhalb von drei Monaten nach F&auml;lligkeit schriftlich geltend gemacht werden. Diese Ausschlussfrist gilt nicht f&uuml;r Anspr&uuml;che aus vors&auml;tzlicher Vertragsverletzung und f&uuml;r den gesetzlichen Mindestlohn.</p>',
        "category": "Arbeitsrecht", "tags": ["ausschlussfrist", "verfall"], "tone": "neutral",
        "is_mandatory": True, "display_order": 16,
    },
    {
        "title": "Schlussbestimmungen",
        "content_html": '<p><strong>&sect; 17 Schlussbestimmungen</strong></p><p>&Auml;nderungen und Erg&auml;nzungen dieses Vertrages bed&uuml;rfen der Schriftform. M&uuml;ndliche Nebenabreden bestehen nicht.</p><p>Sollte eine Bestimmung dieses Vertrages unwirksam sein oder werden, so wird die Wirksamkeit der &uuml;brigen Bestimmungen dadurch nicht ber&uuml;hrt.</p><p>Es gilt das Recht der Bundesrepublik Deutschland.</p>',
        "category": "Arbeitsrecht", "tags": ["schlussbestimmungen", "salvatorisch"], "tone": "neutral",
        "is_mandatory": True, "display_order": 17,
        "is_order_locked": True,
    },
]


@router.post("/seed-clauses")
async def seed_arbeitsvertrag_clauses(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Seed professional Arbeitsvertrag clauses (admin-only).

    Creates 17 standard German employment contract clauses and links them
    to the Arbeitsvertrag document type. Safe to run multiple times -
    updates existing clauses and skips existing links.
    """
    # 1. Find or create "Arbeitsvertrag" document type
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.name.ilike("%arbeitsvertrag%"),
            DocumentType.country_code == "DE",
        )
    )
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        doc_type = DocumentType(
            name="Arbeitsvertrag",
            country_code="DE",
            category="Arbeitsvertrag",
            is_active=True,
        )
        db.add(doc_type)
        await db.flush()
        logger.info(f"Created DocumentType 'Arbeitsvertrag' (ID: {doc_type.id})")

    # 2. Create/update clauses and link them
    created = 0
    updated = 0
    linked = 0

    for clause_data in ARBEITSVERTRAG_CLAUSES:
        # Check if clause exists
        existing = await db.execute(
            select(Clause).where(
                Clause.title == clause_data["title"],
                Clause.country_code == "DE",
            )
        )
        clause = existing.scalar_one_or_none()

        if clause:
            # Update existing clause content
            clause.content_html = clause_data["content_html"]
            clause.category = clause_data.get("category", "Arbeitsrecht")
            clause.tags = clause_data.get("tags", [])
            clause.tone = clause_data.get("tone", "neutral")
            clause.is_active = True
            updated += 1
        else:
            clause = Clause(
                title=clause_data["title"],
                content_html=clause_data["content_html"],
                country_code="DE",
                category=clause_data.get("category", "Arbeitsrecht"),
                is_active=True,
                tags=clause_data.get("tags", []),
                tone=clause_data.get("tone", "neutral"),
                approval_status="active",
                user_id=None,
            )
            db.add(clause)
            await db.flush()
            created += 1

        # Link to document type if not already linked
        existing_link = await db.execute(
            select(DocumentTypeClause).where(
                DocumentTypeClause.document_type_id == doc_type.id,
                DocumentTypeClause.clause_id == clause.id,
            )
        )
        if not existing_link.scalar_one_or_none():
            link = DocumentTypeClause(
                document_type_id=doc_type.id,
                clause_id=clause.id,
                display_order=clause_data["display_order"],
                is_mandatory=clause_data.get("is_mandatory", True),
                clause_type=clause_data.get("clause_type", "standard"),
                is_default_selected=True,
                condition=clause_data.get("condition"),
                is_order_locked=clause_data.get("is_order_locked", False),
            )
            db.add(link)
            linked += 1

    await db.commit()

    return {
        "status": "success",
        "document_type_id": doc_type.id,
        "clauses_created": created,
        "clauses_updated": updated,
        "links_created": linked,
        "total_clauses": len(ARBEITSVERTRAG_CLAUSES),
    }
