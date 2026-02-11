#!/usr/bin/env python3
"""
Seed professional Arbeitsvertrag (employment contract) clauses.

Creates comprehensive German employment contract clauses following
standard HR/legal practice with proper placeholders for dynamic data.

Run after seed_initial_data.py:
    python scripts/seed_arbeitsvertrag_clauses.py

Environment variables required:
    - DATABASE_URL: PostgreSQL connection string
"""

import asyncio
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db import async_session_factory
from app.models.documents import Clause, DocumentType, DocumentTypeClause


# ══════════════════════════════════════════════════════════════════════════════
# PROFESSIONAL ARBEITSVERTRAG CLAUSES (DE)
# ══════════════════════════════════════════════════════════════════════════════

ARBEITSVERTRAG_CLAUSES = [
    {
        "title": "Beginn und Dauer des Arbeitsverhältnisses",
        "content_html": """<p><strong>&sect; 1 Beginn und Dauer des Arbeitsverh&auml;ltnisses</strong></p>
<p>Das Arbeitsverh&auml;ltnis beginnt am <strong>[eintrittsdatum]</strong> und wird auf unbestimmte Zeit geschlossen.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["beginn", "dauer", "arbeitsverhältnis", "eintrittsdatum"],
        "description": "Regelung zu Beginn und Dauer des Arbeitsverhältnisses",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 1,
    },
    {
        "title": "Probezeit",
        "content_html": """<p><strong>&sect; 2 Probezeit</strong></p>
<p>Die ersten <strong>[probezeit]</strong> des Arbeitsverh&auml;ltnisses gelten als Probezeit. W&auml;hrend der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von zwei Wochen gek&uuml;ndigt werden.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["probezeit", "kündigung"],
        "description": "Probezeitregelung mit gesetzlicher Kündigungsfrist",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 2,
        "condition": '{"field": "probezeit", "operator": "!=", "value": "Keine"}',
    },
    {
        "title": "Tätigkeit und Aufgabengebiet",
        "content_html": """<p><strong>&sect; 3 T&auml;tigkeit und Aufgabengebiet</strong></p>
<p>Der Arbeitnehmer wird als <strong>[position]</strong> eingestellt. Der Arbeitgeber beh&auml;lt sich vor, dem Arbeitnehmer im Rahmen des Direktionsrechts auch andere zumutbare T&auml;tigkeiten zuzuweisen, die seinen Kenntnissen und F&auml;higkeiten entsprechen.</p>
<p>Der Arbeitnehmer verpflichtet sich, die ihm &uuml;bertragenen Aufgaben gewissenhaft und sorgf&auml;ltig auszuf&uuml;hren und die Interessen des Arbeitgebers zu wahren.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["tätigkeit", "position", "aufgaben", "direktionsrecht"],
        "description": "Beschreibung der Tätigkeit und des Direktionsrechts des Arbeitgebers",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 3,
    },
    {
        "title": "Arbeitsort",
        "content_html": """<p><strong>&sect; 4 Arbeitsort</strong></p>
<p>Der Arbeitsort ist der Sitz des Arbeitgebers. Der Arbeitgeber beh&auml;lt sich vor, den Arbeitnehmer auch an anderen Betriebsst&auml;tten oder bei Kunden einzusetzen, soweit dies zumutbar ist.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["arbeitsort", "einsatzort"],
        "description": "Regelung zum Arbeitsort mit Versetzungsklausel",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 4,
    },
    {
        "title": "Arbeitszeit",
        "content_html": """<p><strong>&sect; 5 Arbeitszeit</strong></p>
<p>Die regelm&auml;&szlig;ige w&ouml;chentliche Arbeitszeit betr&auml;gt <strong>[wochenstunden]</strong> Stunden, ohne Ber&uuml;cksichtigung der Pausen. Die Verteilung der Arbeitszeit richtet sich nach den betrieblichen Erfordernissen.</p>
<p>Der Arbeitnehmer erkl&auml;rt sich bereit, im Rahmen der gesetzlichen Bestimmungen &Uuml;berstunden zu leisten, soweit dies betrieblich erforderlich ist. &Uuml;berstunden werden durch Freizeitausgleich abgegolten oder nach Absprache verg&uuml;tet.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["arbeitszeit", "wochenstunden", "überstunden"],
        "description": "Arbeitszeitregelung mit Überstundenklausel",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 5,
    },
    {
        "title": "Vergütung",
        "content_html": """<p><strong>&sect; 6 Verg&uuml;tung</strong></p>
<p>Der Arbeitnehmer erh&auml;lt ein monatliches Bruttogehalt in H&ouml;he von <strong>[bruttogehalt]</strong>. Die Zahlung erfolgt bargeldlos jeweils zum Ende eines Kalendermonats auf ein vom Arbeitnehmer benanntes Konto.</p>
<p>Mit der vereinbarten Verg&uuml;tung sind etwaige &Uuml;berstunden bis zu einem Umfang von 10 % der vereinbarten w&ouml;chentlichen Arbeitszeit abgegolten.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["vergütung", "gehalt", "bruttogehalt", "zahlung"],
        "description": "Gehaltsregelung mit Überstundenpauschale",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 6,
    },
    {
        "title": "Urlaub",
        "content_html": """<p><strong>&sect; 7 Urlaub</strong></p>
<p>Der Arbeitnehmer hat Anspruch auf einen j&auml;hrlichen Erholungsurlaub von <strong>[urlaubstage]</strong> Arbeitstagen, bezogen auf eine 5-Tage-Woche. Der Urlaub ist grunds&auml;tzlich im laufenden Kalenderjahr zu nehmen und kann nur in Ausnahmef&auml;llen bis zum 31. M&auml;rz des Folgejahres &uuml;bertragen werden.</p>
<p>Die zeitliche Festlegung des Urlaubs erfolgt unter Ber&uuml;cksichtigung der betrieblichen Belange und der W&uuml;nsche des Arbeitnehmers.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["urlaub", "urlaubstage", "erholung"],
        "description": "Urlaubsregelung mit Übertragungsmöglichkeit",
        "tone": "arbeitnehmerfreundlich",
        "is_mandatory": True,
        "display_order": 7,
    },
    {
        "title": "Krankheit und Arbeitsverhinderung",
        "content_html": """<p><strong>&sect; 8 Krankheit und Arbeitsverhinderung</strong></p>
<p>Im Falle der Arbeitsunf&auml;higkeit durch Krankheit ist der Arbeitnehmer verpflichtet, den Arbeitgeber unverz&uuml;glich, sp&auml;testens jedoch vor Arbeitsbeginn, &uuml;ber die Arbeitsunf&auml;higkeit und deren voraussichtliche Dauer zu informieren.</p>
<p>Eine &auml;rztliche Arbeitsunf&auml;higkeitsbescheinigung ist sp&auml;testens am dritten Tag der Erkrankung vorzulegen. Der Arbeitgeber ist berechtigt, die Vorlage der Bescheinigung fr&uuml;her zu verlangen.</p>
<p>Die Entgeltfortzahlung im Krankheitsfall richtet sich nach den gesetzlichen Bestimmungen.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["krankheit", "arbeitsunfähigkeit", "krankmeldung"],
        "description": "Regelung bei Krankheit und Arbeitsverhinderung",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 8,
    },
    {
        "title": "Verschwiegenheitspflicht",
        "content_html": """<p><strong>&sect; 9 Verschwiegenheitspflicht</strong></p>
<p>Der Arbeitnehmer verpflichtet sich, &uuml;ber alle Betriebs- und Gesch&auml;ftsgeheimnisse sowie vertrauliche Informationen, die ihm im Rahmen seiner T&auml;tigkeit bekannt werden, Stillschweigen zu bewahren. Diese Verschwiegenheitspflicht gilt auch nach Beendigung des Arbeitsverh&auml;ltnisses.</p>
<p>Ein Versto&szlig; gegen die Verschwiegenheitspflicht kann eine fristlose K&uuml;ndigung und Schadensersatzanspr&uuml;che nach sich ziehen.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["verschwiegenheit", "geheimhaltung", "betriebsgeheimnis"],
        "description": "Verschwiegenheitsklausel mit Nachvertragswirkung",
        "tone": "streng",
        "is_mandatory": True,
        "display_order": 9,
    },
    {
        "title": "Nebentätigkeit",
        "content_html": """<p><strong>&sect; 10 Nebent&auml;tigkeit</strong></p>
<p>Jede entgeltliche oder zeitlich umfangreiche Nebent&auml;tigkeit bedarf der vorherigen schriftlichen Zustimmung des Arbeitgebers. Die Zustimmung ist zu erteilen, wenn berechtigte Interessen des Arbeitgebers nicht beeintr&auml;chtigt werden.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["nebentätigkeit", "nebenjob"],
        "description": "Regelung von Nebentätigkeiten",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 10,
    },
    {
        "title": "Kündigung",
        "content_html": """<p><strong>&sect; 11 K&uuml;ndigung</strong></p>
<p>Nach Ablauf der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von vier Wochen zum F&uuml;nfzehnten oder zum Ende eines Kalendermonats gek&uuml;ndigt werden. Es gelten im &Uuml;brigen die gesetzlichen K&uuml;ndigungsfristen gem&auml;&szlig; &sect; 622 BGB, die sich mit zunehmender Betriebszugeh&ouml;rigkeit verl&auml;ngern.</p>
<p>Die K&uuml;ndigung bedarf der Schriftform. Das Recht zur fristlosen K&uuml;ndigung aus wichtigem Grund bleibt unber&uuml;hrt.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["kündigung", "kündigungsfrist", "schriftform"],
        "description": "Kündigungsregelungen mit gesetzlichen Fristen",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 11,
    },
    {
        "title": "Firmenwagen",
        "content_html": """<p><strong>&sect; 12 Firmenwagen</strong></p>
<p>Dem Arbeitnehmer wird ein Firmenfahrzeug zur Verf&uuml;gung gestellt, das auch zur privaten Nutzung verwendet werden darf. Die private Nutzung wird gem&auml;&szlig; der 1-%-Regelung als geldwerter Vorteil versteuert.</p>
<p>Der Arbeitnehmer verpflichtet sich zur pfleglichen Behandlung des Fahrzeugs und zur Einhaltung der Stra&szlig;enverkehrsordnung. Bei Beendigung des Arbeitsverh&auml;ltnisses ist das Fahrzeug unverz&uuml;glich zur&uuml;ckzugeben.</p>""",
        "category": "Zusatzleistungen",
        "tags": ["firmenwagen", "dienstwagen", "benefit"],
        "description": "Firmenwagenregelung mit Privatnutzung und 1%-Regelung",
        "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False,
        "display_order": 12,
        "clause_type": "conditional",
        "condition": '{"field": "firmenwagen", "operator": "=", "value": true}',
    },
    {
        "title": "Home Office",
        "content_html": """<p><strong>&sect; 13 Mobiles Arbeiten (Home Office)</strong></p>
<p>Der Arbeitnehmer hat die M&ouml;glichkeit, nach Abstimmung mit dem Vorgesetzten teilweise im Home Office zu arbeiten. Der Arbeitgeber stellt die daf&uuml;r erforderliche technische Ausstattung zur Verf&uuml;gung.</p>
<p>Der Arbeitnehmer verpflichtet sich, auch bei mobiler Arbeit die datenschutzrechtlichen Bestimmungen einzuhalten und einen geeigneten Arbeitsplatz vorzuhalten. Die n&auml;heren Regelungen sind in der Betriebsvereinbarung zum mobilen Arbeiten festgelegt.</p>""",
        "category": "Zusatzleistungen",
        "tags": ["homeoffice", "mobiles-arbeiten", "remote", "benefit"],
        "description": "Home-Office-Regelung mit Datenschutzhinweis",
        "tone": "arbeitnehmerfreundlich",
        "is_mandatory": False,
        "display_order": 13,
        "clause_type": "conditional",
        "condition": '{"field": "homeoffice", "operator": "=", "value": true}',
    },
    {
        "title": "Datenschutz",
        "content_html": """<p><strong>&sect; 14 Datenschutz</strong></p>
<p>Der Arbeitnehmer verpflichtet sich, die geltenden Datenschutzbestimmungen (DSGVO, BDSG) einzuhalten und personenbezogene Daten nur im Rahmen der dienstlichen Erfordernis zu verarbeiten. Er wird gesondert auf das Datengeheimnis verpflichtet.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["datenschutz", "dsgvo", "bdsg"],
        "description": "Datenschutzklausel gemäß DSGVO/BDSG",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 14,
    },
    {
        "title": "Vertragsstrafe",
        "content_html": """<p><strong>&sect; 15 Vertragsstrafe</strong></p>
<p>Tritt der Arbeitnehmer das Arbeitsverh&auml;ltnis nicht an oder l&ouml;st er es vertragswidrig, so hat er eine Vertragsstrafe in H&ouml;he eines Bruttomonatsgehalts zu zahlen. Das Recht des Arbeitgebers, dar&uuml;ber hinausgehende Schadensersatzanspr&uuml;che geltend zu machen, bleibt unber&uuml;hrt.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["vertragsstrafe", "nichtantritt"],
        "description": "Vertragsstrafenklausel bei Nichtantritt oder vertragswidriger Lösung",
        "tone": "streng",
        "is_mandatory": True,
        "display_order": 15,
    },
    {
        "title": "Ausschlussfristen",
        "content_html": """<p><strong>&sect; 16 Ausschlussfristen</strong></p>
<p>Alle beiderseitigen Anspr&uuml;che aus dem Arbeitsverh&auml;ltnis und solche, die mit dem Arbeitsverh&auml;ltnis in Verbindung stehen, verfallen, wenn sie nicht innerhalb von drei Monaten nach F&auml;lligkeit gegen&uuml;ber der anderen Vertragspartei schriftlich geltend gemacht werden. Lehnt die andere Vertragspartei den Anspruch ab, so verfallen die Anspr&uuml;che, wenn sie nicht innerhalb von drei Monaten nach der Ablehnung gerichtlich geltend gemacht werden.</p>
<p>Diese Ausschlussfrist gilt nicht f&uuml;r Anspr&uuml;che aus vors&auml;tzlicher Vertragsverletzung und f&uuml;r den gesetzlichen Mindestlohn.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["ausschlussfrist", "verfall", "fristen"],
        "description": "Zweistufige Ausschlussfristenregelung",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 16,
    },
    {
        "title": "Schlussbestimmungen",
        "content_html": """<p><strong>&sect; 17 Schlussbestimmungen</strong></p>
<p>&Auml;nderungen und Erg&auml;nzungen dieses Vertrages bed&uuml;rfen der Schriftform. Dies gilt auch f&uuml;r die Aufhebung des Schriftformerfordernisses. M&uuml;ndliche Nebenabreden bestehen nicht.</p>
<p>Sollte eine Bestimmung dieses Vertrages unwirksam sein oder werden, so wird die Wirksamkeit der &uuml;brigen Bestimmungen dadurch nicht ber&uuml;hrt. Anstelle der unwirksamen Bestimmung gilt eine wirksame Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am n&auml;chsten kommt.</p>
<p>Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist der Sitz des Arbeitgebers, soweit gesetzlich zul&auml;ssig.</p>""",
        "category": "Arbeitsrecht",
        "tags": ["schlussbestimmungen", "schriftform", "salvatorisch"],
        "description": "Schlussbestimmungen mit Schriftformklausel und salvatorischer Klausel",
        "tone": "neutral",
        "is_mandatory": True,
        "display_order": 17,
        "is_order_locked": True,
    },
]


async def seed_arbeitsvertrag_clauses():
    """Create comprehensive Arbeitsvertrag clauses and link them to the document type."""
    async with async_session_factory() as session:
        # 1. Find or create "Arbeitsvertrag" document type
        result = await session.execute(
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
            session.add(doc_type)
            await session.commit()
            await session.refresh(doc_type)
            print(f"Created DocumentType 'Arbeitsvertrag' (ID: {doc_type.id})")
        else:
            print(f"Found existing DocumentType '{doc_type.name}' (ID: {doc_type.id})")

        # 2. Check existing clauses for this document type
        existing_links = await session.execute(
            select(DocumentTypeClause).where(
                DocumentTypeClause.document_type_id == doc_type.id
            )
        )
        existing_clause_count = len(existing_links.scalars().all())

        if existing_clause_count >= 10:
            print(f"Document type already has {existing_clause_count} clauses. Skipping to avoid duplicates.")
            print("To re-seed, delete existing clauses first.")
            return True

        # 3. Create clauses and link them
        created_count = 0
        for clause_data in ARBEITSVERTRAG_CLAUSES:
            # Check if clause with this title already exists
            existing_clause = await session.execute(
                select(Clause).where(
                    Clause.title == clause_data["title"],
                    Clause.country_code == "DE",
                )
            )
            clause = existing_clause.scalar_one_or_none()

            if clause:
                print(f"  Clause '{clause_data['title']}' already exists (ID: {clause.id}), updating content...")
                clause.content_html = clause_data["content_html"]
                clause.category = clause_data.get("category", "Arbeitsrecht")
                clause.tags = clause_data.get("tags", [])
                clause.description = clause_data.get("description")
                clause.tone = clause_data.get("tone", "neutral")
                clause.is_active = True
            else:
                clause = Clause(
                    title=clause_data["title"],
                    content_html=clause_data["content_html"],
                    country_code="DE",
                    category=clause_data.get("category", "Arbeitsrecht"),
                    is_active=True,
                    tags=clause_data.get("tags", []),
                    description=clause_data.get("description"),
                    tone=clause_data.get("tone", "neutral"),
                    approval_status="active",
                    user_id=None,  # Global clause
                )
                session.add(clause)
                await session.flush()
                print(f"  Created clause '{clause_data['title']}' (ID: {clause.id})")

            # Check if link already exists
            existing_link = await session.execute(
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
                session.add(link)
                created_count += 1

        await session.commit()
        print(f"\nSuccessfully seeded {created_count} new clause links for 'Arbeitsvertrag'")
        print(f"Total clauses: {len(ARBEITSVERTRAG_CLAUSES)} (with {len([c for c in ARBEITSVERTRAG_CLAUSES if not c.get('is_mandatory', True)])} conditional)")
        return True


async def main():
    """Run clause seeding."""
    print("=" * 60)
    print("Arbeitsvertrag Clause Seeding Script")
    print("=" * 60)

    success = await seed_arbeitsvertrag_clauses()

    print("\n" + "=" * 60)
    if success:
        print("Clause seeding completed successfully!")
    else:
        print("Clause seeding completed with errors.")
    print("=" * 60)

    return success


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
