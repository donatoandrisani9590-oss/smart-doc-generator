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
    # ── § 1 Beginn und Dauer ──────────────────────────────────────────────
    {
        "title": "Beginn und Dauer des Arbeitsverhältnisses",
        "content_html": '<p><strong>&sect; 1 Beginn und Dauer des Arbeitsverh&auml;ltnisses</strong></p><p>Das Arbeitsverh&auml;ltnis beginnt am <strong>[eintrittsdatum]</strong> und wird auf unbestimmte Zeit geschlossen.</p>',
        "category": "Arbeitsrecht", "tags": ["beginn", "dauer"], "tone": "neutral",
        "is_mandatory": True, "display_order": 1,
    },
    # ── § 2 Tarifvertragshinweis (NEU — NachwG § 2 Abs. 1 Nr. 14) ────────
    {
        "title": "Hinweis auf Tarifverträge und Betriebsvereinbarungen",
        "content_html": '<p><strong>&sect; 2 Hinweis auf Tarifvertr&auml;ge und Betriebsvereinbarungen</strong></p>'
            '<p>Auf das Arbeitsverh&auml;ltnis finden in ihrer jeweils g&uuml;ltigen Fassung Anwendung:</p>'
            '<ul>'
            '<li>der Haustarifvertrag zwischen der [firmenname] und der Industriegewerkschaft Bergbau, Chemie, Energie (IG&nbsp;BCE), Landesbezirk Bayern,</li>'
            '<li>der jeweils g&uuml;ltige Lohn- und Gehaltstarifvertrag,</li>'
            '<li>die betrieblichen Vereinbarungen in ihrer jeweiligen Fassung.</li>'
            '</ul>'
            '<p>Soweit dieser Vertrag keine abweichenden oder erg&auml;nzenden Regelungen enth&auml;lt, gelten die Bestimmungen der vorgenannten Tarifvertr&auml;ge und Betriebsvereinbarungen.</p>',
        "category": "Arbeitsrecht", "tags": ["tarifvertrag", "igbce", "nachwg", "betriebsvereinbarung"], "tone": "neutral",
        "is_mandatory": True, "display_order": 2,
    },
    # ── § 3 Probezeit (KORRIGIERT — TV Ziff. 63: schriftlich vereinbart) ──
    {
        "title": "Probezeit",
        "content_html": '<p><strong>&sect; 3 Probezeit</strong></p>'
            '<p>Die Probezeit wird hiermit schriftlich vereinbart. Die ersten <strong>[probezeit]</strong> des Arbeitsverh&auml;ltnisses gelten als Probezeit (Haustarifvertrag Ziff.&nbsp;63). '
            'W&auml;hrend der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von zwei Wochen gek&uuml;ndigt werden (&sect;&nbsp;622 Abs.&nbsp;3 BGB).</p>',
        "category": "Arbeitsrecht", "tags": ["probezeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 3,
        "clause_type": "conditional",
        "condition": '{"field": "probezeit", "operator": "!=", "value": "Keine"}',
    },
    # ── § 4 Tätigkeit und Aufgabengebiet ──────────────────────────────────
    {
        "title": "Tätigkeit und Aufgabengebiet",
        "content_html": '<p><strong>&sect; 4 T&auml;tigkeit und Aufgabengebiet</strong></p>'
            '<p>Der Arbeitnehmer wird als <strong>[position]</strong> eingestellt.</p>'
            '<p>Der Arbeitgeber beh&auml;lt sich vor, dem Arbeitnehmer im Rahmen des Direktionsrechts auch andere zumutbare T&auml;tigkeiten zuzuweisen, die seinen Kenntnissen und F&auml;higkeiten entsprechen.</p>'
            '<p>Der Arbeitnehmer verpflichtet sich, die ihm &uuml;bertragenen Aufgaben gewissenhaft und sorgf&auml;ltig auszuf&uuml;hren und die Interessen des Arbeitgebers zu wahren.</p>',
        "category": "Arbeitsrecht", "tags": ["tätigkeit", "position"], "tone": "neutral",
        "is_mandatory": True, "display_order": 4,
    },
    # ── § 5 Eingruppierung (NEU — TV Ziff. 28, NachwG § 2 Abs. 1 Nr. 7) ─
    {
        "title": "Eingruppierung",
        "content_html": '<p><strong>&sect; 5 Eingruppierung</strong></p>'
            '<p>Der Arbeitnehmer wird gem&auml;&szlig; dem Haustarifvertrag (Ziff.&nbsp;28&ndash;29) in die Entgeltgruppe <strong>[entgeltgruppe]</strong> eingereiht. '
            'Die Einreihung richtet sich nach der Lohn- und Gehaltsgruppeneinteilung des jeweils g&uuml;ltigen Lohn- und Gehaltstarifvertrages.</p>'
            '<p>Eine &Auml;nderung der Eingruppierung erfolgt nach den tarifvertraglichen Bestimmungen.</p>',
        "category": "Arbeitsrecht", "tags": ["eingruppierung", "entgeltgruppe", "tarifvertrag"], "tone": "neutral",
        "is_mandatory": True, "display_order": 5,
    },
    # ── § 6 Arbeitsort ────────────────────────────────────────────────────
    {
        "title": "Arbeitsort",
        "content_html": '<p><strong>&sect; 6 Arbeitsort</strong></p>'
            '<p>Der Arbeitsort ist der Sitz des Arbeitgebers. Der Arbeitgeber beh&auml;lt sich vor, den Arbeitnehmer auch an anderen Betriebsst&auml;tten oder bei Kunden einzusetzen, soweit dies zumutbar ist.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitsort"], "tone": "neutral",
        "is_mandatory": True, "display_order": 6,
    },
    # ── § 7 Arbeitszeit ──────────────────────────────────────────────────
    {
        "title": "Arbeitszeit",
        "content_html": '<p><strong>&sect; 7 Arbeitszeit</strong></p>'
            '<p>Die regelm&auml;&szlig;ige w&ouml;chentliche Arbeitszeit betr&auml;gt <strong>[wochenstunden]</strong> Stunden ohne Ber&uuml;cksichtigung der Pausen (Haustarifvertrag Ziff.&nbsp;1). '
            'Die Verteilung der Arbeitszeit richtet sich nach den betrieblichen Erfordernissen.</p>'
            '<p>Der Arbeitnehmer erkl&auml;rt sich bereit, im Rahmen der gesetzlichen und tarifvertraglichen Bestimmungen Mehrarbeit zu leisten, soweit dies betrieblich erforderlich ist. '
            'Mehrarbeit ist grunds&auml;tzlich durch Freizeit auszugleichen; hilfsweise erfolgt eine Verg&uuml;tung mit dem tarifvertraglichen Zuschlag (Haustarifvertrag Ziff.&nbsp;15&ndash;17).</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitszeit", "wochenstunden", "mehrarbeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 7,
    },
    # ── § 8 Arbeitszeitkonto (NEU — conditional) ─────────────────────────
    {
        "title": "Arbeitszeitkonto",
        "content_html": '<p><strong>&sect; 8 Arbeitszeitkonto</strong></p>'
            '<p>F&uuml;r den Arbeitnehmer wird ein Arbeitszeitkonto gef&uuml;hrt. Auf dem Arbeitszeitkonto wird die Differenz zwischen der tats&auml;chlich geleisteten und der regelm&auml;&szlig;igen Arbeitszeit erfasst.</p>'
            '<p>Plus- und Minusstunden sind innerhalb eines Ausgleichszeitraums von zw&ouml;lf Monaten auszugleichen. '
            'N&auml;heres regelt die betriebliche Vereinbarung zum Arbeitszeitkonto.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitszeitkonto", "arbeitszeit", "gleitzeitkonto"], "tone": "neutral",
        "is_mandatory": False, "display_order": 8,
        "clause_type": "conditional",
        "condition": '{"field": "arbeitszeitkonto", "operator": "=", "value": true}',
    },
    # ── § 9 Vergütung (KORRIGIERT — ohne Pauschalabgeltung, mit TV-Leistungen) ─
    {
        "title": "Vergütung",
        "content_html": '<p><strong>&sect; 9 Verg&uuml;tung</strong></p>'
            '<p>Der Arbeitnehmer erh&auml;lt ein monatliches Bruttogehalt in H&ouml;he von <strong>[bruttogehalt]</strong> gem&auml;&szlig; der tarifvertraglichen Eingruppierung. '
            'Die Zahlung erfolgt bargeldlos jeweils zum Ende eines Kalendermonats auf ein vom Arbeitnehmer benanntes Konto.</p>'
            '<p>Der Arbeitnehmer erh&auml;lt dar&uuml;ber hinaus eine Jahressonderzahlung (13.&nbsp;Monatsgehalt) gem&auml;&szlig; den Bestimmungen des Haustarifvertrages (Ziff.&nbsp;48&ndash;52). '
            'Die Auszahlung erfolgt mit dem Novembergehalt.</p>'
            '<p>Der Arbeitnehmer erh&auml;lt ein zus&auml;tzliches Urlaubsgeld in H&ouml;he von <strong>[urlaubsgeld_pro_tag]</strong> je Urlaubstag (Haustarifvertrag Ziff.&nbsp;53&ndash;54). '
            'Das Urlaubsgeld wird mit der Gehaltsabrechnung f&uuml;r den Monat Juni ausgezahlt.</p>'
            '<p>Der Arbeitgeber zahlt verm&ouml;genswirksame Leistungen in H&ouml;he von <strong>[vwl_betrag]</strong> brutto monatlich (Haustarifvertrag Ziff.&nbsp;55).</p>',
        "category": "Arbeitsrecht", "tags": ["vergütung", "gehalt", "bruttogehalt", "jahressonderzahlung", "urlaubsgeld", "vwl"], "tone": "neutral",
        "is_mandatory": True, "display_order": 9,
    },
    # ── § 10 Zuschläge (NEU — conditional, TV Ziff. 20) ──────────────────
    {
        "title": "Zuschläge für Mehr-, Nacht-, Sonn- und Feiertagsarbeit",
        "content_html": '<p><strong>&sect; 10 Zuschl&auml;ge f&uuml;r Mehr-, Nacht-, Sonn- und Feiertagsarbeit</strong></p>'
            '<p>F&uuml;r besondere Arbeitszeiten erh&auml;lt der Arbeitnehmer folgende Zuschl&auml;ge gem&auml;&szlig; Haustarifvertrag (Ziff.&nbsp;20):</p>'
            '<ul>'
            '<li>Mehrarbeit: 25&nbsp;% Zuschlag</li>'
            '<li>Nachtarbeit (regul&auml;re Nachtschicht): 25&nbsp;% Zuschlag</li>'
            '<li>Nachtarbeit (Einzel-Nachtarbeit, nicht in Schichtplan): 40&nbsp;% Zuschlag</li>'
            '<li>Sonntagsarbeit: 50&nbsp;% Zuschlag</li>'
            '<li>Feiertagsarbeit: 125&nbsp;% Zuschlag</li>'
            '</ul>'
            '<p>Die Berechnung der Zuschl&auml;ge richtet sich nach den Bestimmungen des Haustarifvertrages (Ziff.&nbsp;15&ndash;22). '
            'Mehrarbeit ist vorrangig durch Freizeit auszugleichen.</p>',
        "category": "Arbeitsrecht", "tags": ["zuschläge", "nachtarbeit", "sonntagsarbeit", "feiertagsarbeit", "mehrarbeit"], "tone": "neutral",
        "is_mandatory": False, "display_order": 10,
        "clause_type": "conditional",
        "condition": '{"field": "schichtzuschlaege", "operator": "=", "value": true}',
    },
    # ── § 11 Urlaub (ERWEITERT — TV Ziff. 31–44) ────────────────────────
    {
        "title": "Urlaub",
        "content_html": '<p><strong>&sect; 11 Urlaub</strong></p>'
            '<p>Der Arbeitnehmer hat Anspruch auf einen j&auml;hrlichen Erholungsurlaub von <strong>[urlaubstage]</strong> Arbeitstagen, bezogen auf eine 5-Tage-Woche (Haustarifvertrag Ziff.&nbsp;31&ndash;34).</p>'
            '<p>Der volle Urlaubsanspruch entsteht erstmals nach einer Wartezeit von sechs Monaten (Ziff.&nbsp;36). '
            'Bruchteile von Urlaubstagen, die mindestens einen halben Tag ergeben, werden auf volle Urlaubstage aufgerundet (Ziff.&nbsp;39).</p>'
            '<p>Der Urlaub ist grunds&auml;tzlich im laufenden Kalenderjahr zu nehmen. '
            'Eine &Uuml;bertragung auf das n&auml;chste Kalenderjahr ist nur zul&auml;ssig, wenn dringende betriebliche oder in der Person des Arbeitnehmers liegende Gr&uuml;nde dies rechtfertigen. '
            '&Uuml;bertragener Urlaub ist bis zum 31.&nbsp;M&auml;rz des Folgejahres zu nehmen (Ziff.&nbsp;41).</p>'
            '<p>Die zeitliche Festlegung des Urlaubs erfolgt unter Ber&uuml;cksichtigung der betrieblichen Belange und der W&uuml;nsche des Arbeitnehmers. Im &Uuml;brigen gelten die tarifvertraglichen Bestimmungen.</p>',
        "category": "Arbeitsrecht", "tags": ["urlaub", "urlaubstage", "urlaubsanspruch"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 11,
    },
    # ── § 12 Sonderurlaub (NEU — TV Ziff. 56–58) ────────────────────────
    {
        "title": "Sonderurlaub und bezahlte Freistellung",
        "content_html": '<p><strong>&sect; 12 Sonderurlaub und bezahlte Freistellung</strong></p>'
            '<p>Der Arbeitnehmer hat gem&auml;&szlig; Haustarifvertrag (Ziff.&nbsp;56&ndash;58) Anspruch auf bezahlte Freistellung von der Arbeit in folgenden F&auml;llen:</p>'
            '<ul>'
            '<li>Eigene Eheschlie&szlig;ung: 2 Arbeitstage</li>'
            '<li>Niederkunft der Ehefrau/Lebenspartnerin: 1 Arbeitstag</li>'
            '<li>Tod des Ehegatten/Lebenspartners oder eines Kindes: 2 Arbeitstage</li>'
            '<li>Tod eines Elternteils oder Schwiegerelternteils: 1 Arbeitstag</li>'
            '<li>Umzug aus betrieblichen Gr&uuml;nden: 1 Arbeitstag</li>'
            '<li>Schwere Erkrankung eines im Haushalt lebenden Angeh&ouml;rigen: bis zu 1 Arbeitstag</li>'
            '<li>25-j&auml;hriges Arbeitsjubil&auml;um: 1 Arbeitstag</li>'
            '</ul>'
            '<p>Dar&uuml;ber hinaus wird der Arbeitnehmer unter Fortzahlung des Entgelts f&uuml;r die Aus&uuml;bung &ouml;ffentlicher Ehren&auml;mter und zur Wahrnehmung gesetzlich vorgeschriebener Pflichten freigestellt, soweit gesetzlich vorgeschrieben.</p>',
        "category": "Arbeitsrecht", "tags": ["sonderurlaub", "freistellung", "tarifvertrag"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 12,
    },
    # ── § 13 Krankheit (KORRIGIERT — konfigurierbare AU-Frist) ───────────
    {
        "title": "Krankheit und Arbeitsverhinderung",
        "content_html": '<p><strong>&sect; 13 Krankheit und Arbeitsverhinderung</strong></p>'
            '<p>Im Falle der Arbeitsunf&auml;higkeit durch Krankheit ist der Arbeitnehmer verpflichtet, den Arbeitgeber unverz&uuml;glich zu informieren. '
            'Eine &auml;rztliche Arbeitsunf&auml;higkeitsbescheinigung ist sp&auml;testens <strong>[au_frist]</strong> der Erkrankung vorzulegen.</p>'
            '<p>Die Entgeltfortzahlung im Krankheitsfall richtet sich nach den gesetzlichen Bestimmungen des Entgeltfortzahlungsgesetzes (EFZG).</p>',
        "category": "Arbeitsrecht", "tags": ["krankheit", "krankmeldung", "arbeitsunfähigkeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 13,
    },
    # ── § 14 Verschwiegenheitspflicht ─────────────────────────────────────
    {
        "title": "Verschwiegenheitspflicht",
        "content_html": '<p><strong>&sect; 14 Verschwiegenheitspflicht</strong></p>'
            '<p>Der Arbeitnehmer verpflichtet sich, &uuml;ber alle Betriebs- und Gesch&auml;ftsgeheimnisse sowie vertrauliche Informationen Stillschweigen zu bewahren. '
            'Diese Verschwiegenheitspflicht gilt auch nach Beendigung des Arbeitsverh&auml;ltnisses.</p>',
        "category": "Arbeitsrecht", "tags": ["verschwiegenheit", "geheimhaltung"], "tone": "streng",
        "is_mandatory": True, "display_order": 14,
    },
    # ── § 15 Nebentätigkeit ───────────────────────────────────────────────
    {
        "title": "Nebentätigkeit",
        "content_html": '<p><strong>&sect; 15 Nebent&auml;tigkeit</strong></p>'
            '<p>Jede entgeltliche oder zeitlich umfangreiche Nebent&auml;tigkeit bedarf der vorherigen schriftlichen Zustimmung des Arbeitgebers. '
            'Die Zustimmung ist zu erteilen, wenn berechtigte Interessen des Arbeitgebers nicht beeintr&auml;chtigt werden.</p>',
        "category": "Arbeitsrecht", "tags": ["nebentätigkeit"], "tone": "neutral",
        "is_mandatory": True, "display_order": 15,
    },
    # ── § 16 Kündigung (KORRIGIERT — konfigurierbare Frist + TV-Verweis) ─
    {
        "title": "Kündigung",
        "content_html": '<p><strong>&sect; 16 K&uuml;ndigung</strong></p>'
            '<p>Nach Ablauf der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von <strong>[kuendigungsfrist]</strong> gek&uuml;ndigt werden. '
            'Es gelten im &Uuml;brigen die gesetzlichen K&uuml;ndigungsfristen gem&auml;&szlig; &sect;&nbsp;622 BGB sowie die tarifvertraglichen Regelungen (Haustarifvertrag Ziff.&nbsp;65&ndash;70).</p>'
            '<p>Die K&uuml;ndigung bedarf der Schriftform. Das Recht zur fristlosen K&uuml;ndigung aus wichtigem Grund (&sect;&nbsp;626 BGB) bleibt unber&uuml;hrt.</p>',
        "category": "Arbeitsrecht", "tags": ["kündigung", "kündigungsfrist"], "tone": "neutral",
        "is_mandatory": True, "display_order": 16,
    },
    # ── § 17 Firmenwagen (conditional) ────────────────────────────────────
    {
        "title": "Firmenwagen",
        "content_html": '<p><strong>&sect; 17 Firmenwagen</strong></p>'
            '<p>Dem Arbeitnehmer wird ein Firmenfahrzeug zur Verf&uuml;gung gestellt, das auch zur privaten Nutzung verwendet werden darf. '
            'Die private Nutzung wird gem&auml;&szlig; der 1-%-Regelung als geldwerter Vorteil versteuert.</p>'
            '<p>Bei Beendigung des Arbeitsverh&auml;ltnisses ist das Fahrzeug unverz&uuml;glich zur&uuml;ckzugeben.</p>',
        "category": "Zusatzleistungen", "tags": ["firmenwagen", "benefit"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False, "display_order": 17,
        "clause_type": "conditional",
        "condition": '{"field": "firmenwagen", "operator": "=", "value": true}',
    },
    # ── § 18 Home Office (conditional) ────────────────────────────────────
    {
        "title": "Home Office",
        "content_html": '<p><strong>&sect; 18 Mobiles Arbeiten (Home Office)</strong></p>'
            '<p>Der Arbeitnehmer hat die M&ouml;glichkeit, nach Abstimmung mit dem Vorgesetzten teilweise im Home Office zu arbeiten. '
            'Der Arbeitgeber stellt die daf&uuml;r erforderliche technische Ausstattung zur Verf&uuml;gung.</p>'
            '<p>Der Arbeitnehmer verpflichtet sich, auch bei mobiler Arbeit die datenschutzrechtlichen Bestimmungen einzuhalten.</p>',
        "category": "Zusatzleistungen", "tags": ["homeoffice", "remote", "benefit"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False, "display_order": 18,
        "clause_type": "conditional",
        "condition": '{"field": "homeoffice", "operator": "=", "value": true}',
    },
    # ── § 19 Datenschutz ─────────────────────────────────────────────────
    {
        "title": "Datenschutz",
        "content_html": '<p><strong>&sect; 19 Datenschutz</strong></p>'
            '<p>Der Arbeitnehmer verpflichtet sich, die geltenden Datenschutzbestimmungen (DSGVO, BDSG) einzuhalten und personenbezogene Daten nur im Rahmen der dienstlichen Erfordernis zu verarbeiten.</p>',
        "category": "Arbeitsrecht", "tags": ["datenschutz", "dsgvo"], "tone": "neutral",
        "is_mandatory": True, "display_order": 19,
    },
    # ── § 20 Arbeitsergebnisse und Erfindungen (NEU — ArbNErfG) ──────────
    {
        "title": "Arbeitsergebnisse und Erfindungen",
        "content_html": '<p><strong>&sect; 20 Arbeitsergebnisse und Erfindungen</strong></p>'
            '<p>Alle Arbeitsergebnisse, die der Arbeitnehmer im Rahmen seiner T&auml;tigkeit f&uuml;r den Arbeitgeber erstellt, geh&ouml;ren dem Arbeitgeber. '
            'Dies umfasst insbesondere Berichte, Konzepte, Software, technische Zeichnungen und sonstige Unterlagen.</p>'
            '<p>F&uuml;r Erfindungen und technische Verbesserungsvorschl&auml;ge gelten die Bestimmungen des Gesetzes &uuml;ber Arbeitnehmererfindungen (ArbNErfG). '
            'Der Arbeitnehmer ist verpflichtet, Diensterfindungen dem Arbeitgeber unverz&uuml;glich schriftlich zu melden.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitsergebnisse", "erfindungen", "urheberrecht", "arbnerfg"], "tone": "neutral",
        "is_mandatory": True, "display_order": 20,
    },
    # ── § 21 Vertragsstrafe (KORRIGIERT — jetzt conditional) ─────────────
    {
        "title": "Vertragsstrafe",
        "content_html": '<p><strong>&sect; 21 Vertragsstrafe</strong></p>'
            '<p>Tritt der Arbeitnehmer das Arbeitsverh&auml;ltnis nicht an oder l&ouml;st er es vertragswidrig, so hat er eine Vertragsstrafe in H&ouml;he eines Bruttomonatsgehalts zu zahlen.</p>',
        "category": "Arbeitsrecht", "tags": ["vertragsstrafe"], "tone": "streng",
        "is_mandatory": False, "display_order": 21,
        "clause_type": "conditional",
        "condition": '{"field": "vertragsstrafe", "operator": "=", "value": true}',
    },
    # ── § 22 Ausschlussfristen (KORRIGIERT — differenziert nach TV) ──────
    {
        "title": "Ausschlussfristen",
        "content_html": '<p><strong>&sect; 22 Ausschlussfristen</strong></p>'
            '<p>F&uuml;r die Geltendmachung von Anspr&uuml;chen aus dem Arbeitsverh&auml;ltnis gelten die tarifvertraglichen Ausschlussfristen (Haustarifvertrag Ziff.&nbsp;71&ndash;75):</p>'
            '<ul>'
            '<li>Anspr&uuml;che auf Zuschl&auml;ge f&uuml;r Mehr-, Nacht-, Sonn- und Feiertagsarbeit verfallen, wenn sie nicht innerhalb von <strong>einem Monat</strong> nach F&auml;lligkeit schriftlich geltend gemacht werden (Ziff.&nbsp;71).</li>'
            '<li>Alle &uuml;brigen beiderseitigen Anspr&uuml;che aus dem Arbeitsverh&auml;ltnis verfallen, wenn sie nicht innerhalb von <strong>drei Monaten</strong> nach F&auml;lligkeit schriftlich geltend gemacht werden (Ziff.&nbsp;72).</li>'
            '<li>Im Falle der Beendigung des Arbeitsverh&auml;ltnisses sind Anspr&uuml;che innerhalb von <strong>einem Monat</strong> nach Beendigung geltend zu machen (Ziff.&nbsp;73).</li>'
            '</ul>'
            '<p>Diese Ausschlussfristen gelten nicht f&uuml;r Anspr&uuml;che aus vors&auml;tzlicher Vertragsverletzung, f&uuml;r den gesetzlichen Mindestlohn sowie f&uuml;r Anspr&uuml;che, die kraft Gesetzes unabdingbar sind.</p>',
        "category": "Arbeitsrecht", "tags": ["ausschlussfrist", "verfall", "tarifvertrag"], "tone": "neutral",
        "is_mandatory": True, "display_order": 22,
    },
    # ── § 23 Schlussbestimmungen (immer letzter §) ───────────────────────
    {
        "title": "Schlussbestimmungen",
        "content_html": '<p><strong>&sect; 23 Schlussbestimmungen</strong></p>'
            '<p>&Auml;nderungen und Erg&auml;nzungen dieses Vertrages bed&uuml;rfen der Schriftform. M&uuml;ndliche Nebenabreden bestehen nicht.</p>'
            '<p>Sollte eine Bestimmung dieses Vertrages unwirksam sein oder werden, so wird die Wirksamkeit der &uuml;brigen Bestimmungen dadurch nicht ber&uuml;hrt.</p>'
            '<p>Es gilt das Recht der Bundesrepublik Deutschland.</p>',
        "category": "Arbeitsrecht", "tags": ["schlussbestimmungen", "salvatorisch"], "tone": "neutral",
        "is_mandatory": True, "display_order": 23,
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

    Creates 23 IGBCE-compliant German employment contract clauses and links them
    to the Arbeitsvertrag document type. Includes NachwG-Pflichtangaben,
    Haustarifvertrag-Regelungen (Zuschläge, Sonderurlaub, VWL etc.).
    Safe to run multiple times - updates existing clauses and skips existing links.
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


# Mapping of old ASCII-encoded titles to correct German umlaut titles
UMLAUT_TITLE_MIGRATIONS = {
    "Beginn und Dauer des Arbeitsverhaltnisses": "Beginn und Dauer des Arbeitsverhältnisses",
    "Taetigkeit und Aufgabengebiet": "Tätigkeit und Aufgabengebiet",
    "Verguetung": "Vergütung",
    "Nebentaetigkeit": "Nebentätigkeit",
    "Kuendigung": "Kündigung",
}

UMLAUT_TAG_MIGRATIONS = {
    "taetigkeit": "tätigkeit",
    "verguetung": "vergütung",
    "nebentaetigkeit": "nebentätigkeit",
    "kuendigung": "kündigung",
    "kuendigungsfrist": "kündigungsfrist",
}


@router.post("/fix-umlauts")
async def fix_clause_umlauts(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Fix ASCII-encoded umlauts in existing clause titles and tags (admin-only).

    Renames titles like 'Taetigkeit' → 'Tätigkeit' and tags like 'kuendigung' → 'kündigung'.
    Safe to run multiple times.
    """
    fixed_titles = 0
    fixed_tags = 0

    for old_title, new_title in UMLAUT_TITLE_MIGRATIONS.items():
        result = await db.execute(
            select(Clause).where(
                Clause.title == old_title,
                Clause.country_code == "DE",
            )
        )
        clause = result.scalar_one_or_none()
        if clause:
            clause.title = new_title
            fixed_titles += 1
            logger.info(f"Fixed title: '{old_title}' → '{new_title}'")

    # Fix tags on all DE clauses
    result = await db.execute(
        select(Clause).where(Clause.country_code == "DE")
    )
    clauses = result.scalars().all()
    for clause in clauses:
        if clause.tags:
            new_tags = [UMLAUT_TAG_MIGRATIONS.get(t, t) for t in clause.tags]
            if new_tags != clause.tags:
                clause.tags = new_tags
                fixed_tags += 1

    await db.commit()

    return {
        "status": "success",
        "titles_fixed": fixed_titles,
        "tags_fixed": fixed_tags,
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE SEEDING - Professional Kündigung Arbeitnehmer clauses
# ══════════════════════════════════════════════════════════════════════════════

KUENDIGUNG_CLAUSES = [
    {
        "title": "Kündigungserklärung",
        "content_html": '<p><strong>&sect; 1 K&uuml;ndigungserkl&auml;rung</strong></p><p>[anrede_brief] <strong>[vorname] [nachname]</strong>,</p><p>hiermit k&uuml;ndigen wir das zwischen Ihnen und unserem Unternehmen bestehende Arbeitsverh&auml;ltnis ordentlich und fristgerecht zum n&auml;chstm&ouml;glichen Termin.</p>',
        "category": "Arbeitsrecht", "tags": ["kündigung", "kündigungserklärung"], "tone": "neutral",
        "is_mandatory": True, "display_order": 1,
    },
    {
        "title": "Kündigungsfrist und letzter Arbeitstag",
        "content_html": '<p><strong>&sect; 2 K&uuml;ndigungsfrist und letzter Arbeitstag</strong></p><p>Unter Einhaltung der vertraglichen bzw. gesetzlichen K&uuml;ndigungsfrist gem&auml;&szlig; &sect; 622 BGB endet Ihr Arbeitsverh&auml;ltnis mit Ablauf des in der K&uuml;ndigung genannten Termins. Ihr Arbeitsverh&auml;ltnis besteht seit dem <strong>[eintrittsdatum]</strong>.</p>',
        "category": "Arbeitsrecht", "tags": ["kündigungsfrist", "letzter arbeitstag"], "tone": "neutral",
        "is_mandatory": True, "display_order": 2,
    },
    {
        "title": "Freistellung",
        "content_html": '<p><strong>&sect; 3 Freistellung</strong></p><p>Wir stellen Sie ab sofort unwiderruflich von der Erbringung Ihrer Arbeitsleistung frei. Die Freistellung erfolgt unter Fortzahlung der vereinbarten Verg&uuml;tung und unter Anrechnung etwaiger Resturlaubs- und &Uuml;berstundenanspr&uuml;che.</p>',
        "category": "Arbeitsrecht", "tags": ["freistellung"], "tone": "neutral",
        "is_mandatory": False, "display_order": 3,
        "clause_type": "conditional",
        "condition": '{"field": "freistellung", "operator": "=", "value": true}',
    },
    {
        "title": "Resturlaub und Überstunden",
        "content_html": '<p><strong>&sect; 4 Resturlaub und &Uuml;berstunden</strong></p><p>Etwaige Resturlaubsanspr&uuml;che werden Ihnen w&auml;hrend der K&uuml;ndigungsfrist gew&auml;hrt bzw. bei Freistellung auf diese angerechnet. Verbleibende &Uuml;berstunden werden ebenfalls w&auml;hrend der K&uuml;ndigungsfrist abgebaut oder mit der letzten Gehaltsabrechnung verg&uuml;tet.</p>',
        "category": "Arbeitsrecht", "tags": ["resturlaub", "überstunden"], "tone": "neutral",
        "is_mandatory": True, "display_order": 4,
    },
    {
        "title": "Arbeitspapiere und Zeugnis",
        "content_html": '<p><strong>&sect; 5 Arbeitspapiere und Zeugnis</strong></p><p>Sie erhalten sp&auml;testens am letzten Arbeitstag alle Ihnen zustehenden Arbeitspapiere (Lohnsteuerbescheinigung, Sozialversicherungsnachweis, ggf. Arbeitsbescheinigung nach &sect; 312 SGB III). Auf Wunsch stellen wir Ihnen ein qualifiziertes Arbeitszeugnis aus.</p>',
        "category": "Arbeitsrecht", "tags": ["arbeitspapiere", "zeugnis"], "tone": "neutral",
        "is_mandatory": True, "display_order": 5,
    },
    {
        "title": "Rückgabe von Firmeneigentum",
        "content_html": '<p><strong>&sect; 6 R&uuml;ckgabe von Firmeneigentum</strong></p><p>Wir bitten Sie, s&auml;mtliches Firmeneigentum (Schl&uuml;ssel, Zugangsausweise, Laptop, Mobiltelefon, Unterlagen und sonstige Gegenst&auml;nde) sp&auml;testens am letzten Arbeitstag vollst&auml;ndig an uns zur&uuml;ckzugeben.</p>',
        "category": "Arbeitsrecht", "tags": ["firmeneigentum", "rückgabe"], "tone": "neutral",
        "is_mandatory": True, "display_order": 6,
    },
    {
        "title": "Hinweis auf Meldepflicht bei der Arbeitsagentur",
        "content_html": '<p><strong>&sect; 7 Hinweis auf Meldepflicht bei der Arbeitsagentur</strong></p><p>Gem&auml;&szlig; &sect; 38 Abs. 1 SGB III sind Sie verpflichtet, sich unverz&uuml;glich, sp&auml;testens jedoch drei Monate vor Beendigung des Arbeitsverh&auml;ltnisses, pers&ouml;nlich bei der Agentur f&uuml;r Arbeit arbeitsuchend zu melden. Sofern zwischen der Kenntnis des Beendigungszeitpunkts und der Beendigung weniger als drei Monate liegen, hat die Meldung innerhalb von drei Tagen zu erfolgen.</p><p>Bei versp&auml;teter Meldung kann eine Sperrzeit beim Bezug von Arbeitslosengeld eintreten.</p>',
        "category": "Arbeitsrecht", "tags": ["meldepflicht", "arbeitsagentur", "sgb"], "tone": "neutral",
        "is_mandatory": True, "display_order": 7,
        "is_order_locked": True,
    },
]


@router.post("/seed-kuendigung-clauses")
async def seed_kuendigung_clauses(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Seed professional Kündigung Arbeitnehmer clauses (admin-only).

    Creates 7 standard German termination letter clauses and links them
    to the Kündigung Arbeitnehmer document type. Safe to run multiple times.
    """
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.name.ilike("%kündigung%"),
            DocumentType.country_code == "DE",
        )
    )
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        doc_type = DocumentType(
            name="Kündigung Arbeitnehmer",
            country_code="DE",
            category="Beendigung",
            is_active=True,
        )
        db.add(doc_type)
        await db.flush()
        logger.info(f"Created DocumentType 'Kündigung Arbeitnehmer' (ID: {doc_type.id})")

    created = 0
    updated = 0
    linked = 0

    for clause_data in KUENDIGUNG_CLAUSES:
        existing = await db.execute(
            select(Clause).where(
                Clause.title == clause_data["title"],
                Clause.country_code == "DE",
            )
        )
        clause = existing.scalar_one_or_none()

        if clause:
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
        "total_clauses": len(KUENDIGUNG_CLAUSES),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE SEEDING - Professional Abmahnung clauses
# ══════════════════════════════════════════════════════════════════════════════

ABMAHNUNG_CLAUSES = [
    {
        "title": "Sachverhalt und Pflichtverletzung",
        "content_html": '<p><strong>&sect; 1 Sachverhalt und Pflichtverletzung</strong></p><p>[anrede_brief] <strong>[vorname] [nachname]</strong>,</p><p>wir m&uuml;ssen Sie hiermit wegen eines Versto&szlig;es gegen Ihre arbeitsvertraglichen Pflichten abmahnen.</p><p>Am <strong>[vorfall_datum]</strong> haben Sie folgende Pflichtverletzung begangen: Sie sind Ihrem Arbeitsplatz unentschuldigt ferngeblieben, ohne Ihren Vorgesetzten rechtzeitig zu informieren oder eine Arbeitsunf&auml;higkeitsbescheinigung vorzulegen.</p>',
        "category": "Arbeitsrecht", "tags": ["abmahnung", "pflichtverletzung", "sachverhalt"], "tone": "streng",
        "is_mandatory": True, "display_order": 1,
    },
    {
        "title": "Vertragliche und gesetzliche Grundlage",
        "content_html": '<p><strong>&sect; 2 Vertragliche und gesetzliche Grundlage</strong></p><p>Gem&auml;&szlig; Ihrem Arbeitsvertrag vom <strong>[eintrittsdatum]</strong> sind Sie als <strong>[position]</strong> verpflichtet, Ihre Arbeitsleistung ordnungsgem&auml;&szlig; zu erbringen und bei Verhinderung den Arbeitgeber unverz&uuml;glich zu benachrichtigen. Dieses Verhalten verst&ouml;&szlig;t gegen Ihre arbeitsvertraglichen Haupt- und Nebenpflichten gem&auml;&szlig; &sect;&sect; 611a, 241 Abs. 2 BGB.</p>',
        "category": "Arbeitsrecht", "tags": ["vertragsgrundlage", "pflichten"], "tone": "streng",
        "is_mandatory": True, "display_order": 2,
    },
    {
        "title": "Aufforderung zur Verhaltensänderung",
        "content_html": '<p><strong>&sect; 3 Aufforderung zur Verhaltens&auml;nderung</strong></p><p>Wir fordern Sie hiermit ausdr&uuml;cklich auf, das beanstandete Verhalten ab sofort zu unterlassen und Ihren arbeitsvertraglichen Pflichten k&uuml;nftig vollumf&auml;nglich nachzukommen. Insbesondere erwarten wir, dass Sie Ihre Arbeitszeiten zuverl&auml;ssig einhalten und im Verhinderungsfall unverz&uuml;glich Ihren Vorgesetzten informieren.</p>',
        "category": "Arbeitsrecht", "tags": ["verhaltensänderung", "aufforderung"], "tone": "streng",
        "is_mandatory": True, "display_order": 3,
    },
    {
        "title": "Androhung arbeitsrechtlicher Konsequenzen",
        "content_html": '<p><strong>&sect; 4 Androhung arbeitsrechtlicher Konsequenzen</strong></p><p>Wir weisen Sie ausdr&uuml;cklich darauf hin, dass wir im Wiederholungsfall oder bei vergleichbaren Verst&ouml;&szlig;en weitere arbeitsrechtliche Ma&szlig;nahmen ergreifen werden, die bis hin zur ordentlichen oder au&szlig;erordentlichen (fristlosen) K&uuml;ndigung des Arbeitsverh&auml;ltnisses reichen k&ouml;nnen.</p>',
        "category": "Arbeitsrecht", "tags": ["konsequenzen", "androhung", "kündigung"], "tone": "streng",
        "is_mandatory": True, "display_order": 4,
    },
    {
        "title": "Empfangsbestätigung",
        "content_html": '<p><strong>&sect; 5 Empfangsbest&auml;tigung</strong></p><p>Bitte best&auml;tigen Sie den Erhalt dieser Abmahnung durch Ihre Unterschrift. Die Unterschrift best&auml;tigt lediglich den Empfang und stellt kein Einverst&auml;ndnis mit dem Inhalt dar.</p><p>Eine Kopie dieser Abmahnung wird zu Ihrer Personalakte genommen.</p>',
        "category": "Arbeitsrecht", "tags": ["empfangsbestätigung", "personalakte"], "tone": "neutral",
        "is_mandatory": True, "display_order": 5,
        "is_order_locked": True,
    },
]


@router.post("/seed-abmahnung-clauses")
async def seed_abmahnung_clauses(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Seed professional Abmahnung clauses (admin-only).

    Creates 5 standard German written warning clauses and links them
    to the Abmahnung document type. Safe to run multiple times.
    """
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.name.ilike("%abmahnung%"),
            DocumentType.country_code == "DE",
        )
    )
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        doc_type = DocumentType(
            name="Abmahnung",
            country_code="DE",
            category="Disziplinar",
            is_active=True,
        )
        db.add(doc_type)
        await db.flush()
        logger.info(f"Created DocumentType 'Abmahnung' (ID: {doc_type.id})")

    created = 0
    updated = 0
    linked = 0

    for clause_data in ABMAHNUNG_CLAUSES:
        existing = await db.execute(
            select(Clause).where(
                Clause.title == clause_data["title"],
                Clause.country_code == "DE",
            )
        )
        clause = existing.scalar_one_or_none()

        if clause:
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
        "total_clauses": len(ABMAHNUNG_CLAUSES),
    }


# ══════════════════════════════════════════════════════════════════════════════
# CLAUSE SEEDING - Professional Arbeitszeugnis Qualifiziert clauses
# ══════════════════════════════════════════════════════════════════════════════

ARBEITSZEUGNIS_CLAUSES = [
    {
        "title": "Einleitung und Beschäftigungsdaten",
        "content_html": '<p><strong>&sect; 1 Einleitung und Besch&auml;ftigungsdaten</strong></p><p>[anrede] <strong>[vorname] [nachname]</strong>, geboren am <strong>[geburtsdatum]</strong>, war in unserem Unternehmen vom <strong>[eintrittsdatum]</strong> bis zum <strong>[beschaeftigung_bis]</strong> als <strong>[position]</strong> besch&auml;ftigt.</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "einleitung", "beschäftigungsdaten"], "tone": "neutral",
        "is_mandatory": True, "display_order": 1,
    },
    {
        "title": "Tätigkeitsbeschreibung",
        "content_html": '<p><strong>&sect; 2 T&auml;tigkeitsbeschreibung</strong></p><p>Zu den Aufgaben von [anrede_dativ] <strong>[nachname]</strong> geh&ouml;rten insbesondere:</p><ul><li>Eigenverantwortliche Bearbeitung aller Aufgaben im Bereich <strong>[position]</strong></li><li>Planung, Organisation und Durchf&uuml;hrung von Projekten im Zust&auml;ndigkeitsbereich</li><li>Zusammenarbeit mit internen Abteilungen und externen Partnern</li><li>Erstellung von Berichten, Analysen und Pr&auml;sentationen</li></ul>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "tätigkeitsbeschreibung"], "tone": "neutral",
        "is_mandatory": True, "display_order": 2,
    },
    {
        "title": "Leistungsbeurteilung",
        "content_html": '<p><strong>&sect; 3 Leistungsbeurteilung</strong></p><p>[anrede] <strong>[nachname]</strong> verf&uuml;gt &uuml;ber ein fundiertes und umfassendes Fachwissen, das stets auf dem neuesten Stand gehalten wurde. Neue Aufgabenstellungen wurden schnell und sicher erfasst und eigenst&auml;ndig umgesetzt.</p><p>Die Arbeitsergebnisse waren stets von sehr hoher Qualit&auml;t und &uuml;bertrafen regelm&auml;&szlig;ig die Erwartungen. Auch unter schwierigen Bedingungen und bei hohem Arbeitsaufkommen erzielte [anrede] [nachname] stets sehr gute Ergebnisse.</p><p>[anrede] [nachname] hat die &uuml;bertragenen Aufgaben stets zu unserer vollsten Zufriedenheit erf&uuml;llt.</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "leistungsbeurteilung"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 3,
    },
    {
        "title": "Arbeitsweise",
        "content_html": '<p><strong>&sect; 4 Arbeitsweise</strong></p><p>[anrede] <strong>[nachname]</strong> arbeitete stets &auml;u&szlig;erst zuverl&auml;ssig, gewissenhaft und selbstst&auml;ndig. Die Arbeitsweise zeichnete sich durch hohe Sorgfalt, Effizienz und ein ausgepr&auml;gtes Qualit&auml;tsbewusstsein aus. Auch komplexe Aufgaben wurden strukturiert und zielorientiert bearbeitet.</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "arbeitsweise"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 4,
    },
    {
        "title": "Verhalten gegenüber Vorgesetzten, Kollegen und Kunden",
        "content_html": '<p><strong>&sect; 5 Verhalten gegen&uuml;ber Vorgesetzten, Kollegen und Kunden</strong></p><p>Das Verhalten von [anrede_dativ] <strong>[nachname]</strong> gegen&uuml;ber Vorgesetzten, Kolleginnen und Kollegen sowie externen Partnern und Kunden war jederzeit vorbildlich. Durch die freundliche, aufgeschlossene und kooperative Art wurde [anrede] [nachname] von allen sehr gesch&auml;tzt.</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "verhalten", "sozialverhalten"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 5,
    },
    {
        "title": "Schlussformel und Zukunftswünsche",
        "content_html": '<p><strong>&sect; 6 Schlussformel und Zukunftsw&uuml;nsche</strong></p><p>[anrede] <strong>[vorname] [nachname]</strong> verl&auml;sst unser Unternehmen auf eigenen Wunsch. Wir bedauern diese Entscheidung sehr und danken f&uuml;r die stets hervorragende und engagierte Zusammenarbeit.</p><p>F&uuml;r den weiteren beruflichen und pers&ouml;nlichen Lebensweg w&uuml;nschen wir [anrede_dativ] [nachname] alles Gute und weiterhin viel Erfolg.</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "schlussformel", "zukunftswünsche"], "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True, "display_order": 6,
    },
    {
        "title": "Ausstellungsort und Datum",
        "content_html": '<p><strong>&sect; 7 Ausstellungsort und Datum</strong></p><p>&nbsp;</p><p>Sulzberg, den ________________</p><p>&nbsp;</p><p>&nbsp;</p><p>____________________________________</p><p>Gesch&auml;ftsf&uuml;hrung</p>',
        "category": "Arbeitsrecht", "tags": ["zeugnis", "ausstellungsort", "datum"], "tone": "neutral",
        "is_mandatory": True, "display_order": 7,
        "is_order_locked": True,
    },
]


@router.post("/seed-zeugnis-clauses")
async def seed_zeugnis_clauses(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Seed professional Arbeitszeugnis Qualifiziert clauses (admin-only).

    Creates 7 standard German qualified employment reference clauses and links them
    to the Arbeitszeugnis Qualifiziert document type. Safe to run multiple times.
    """
    result = await db.execute(
        select(DocumentType).where(
            DocumentType.name.ilike("%arbeitszeugnis%qualifiziert%"),
            DocumentType.country_code == "DE",
        )
    )
    doc_type = result.scalar_one_or_none()

    if not doc_type:
        doc_type = DocumentType(
            name="Arbeitszeugnis Qualifiziert",
            country_code="DE",
            category="Beendigung",
            is_active=True,
        )
        db.add(doc_type)
        await db.flush()
        logger.info(f"Created DocumentType 'Arbeitszeugnis Qualifiziert' (ID: {doc_type.id})")

    created = 0
    updated = 0
    linked = 0

    for clause_data in ARBEITSZEUGNIS_CLAUSES:
        existing = await db.execute(
            select(Clause).where(
                Clause.title == clause_data["title"],
                Clause.country_code == "DE",
            )
        )
        clause = existing.scalar_one_or_none()

        if clause:
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
        "total_clauses": len(ARBEITSZEUGNIS_CLAUSES),
    }
