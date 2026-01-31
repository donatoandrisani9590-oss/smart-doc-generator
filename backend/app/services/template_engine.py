"""
Smart Document Generator - Template Engine
=========================================
Implements the "Datei statt Logik" strategy from v3.0:
- Dedicated master templates per country (DE/IT) and category (contract/letter)
- No complex Jinja2 logic in templates
- Template selection based on country_code and document_category
"""

import os
import subprocess
from pathlib import Path
from typing import Literal, Optional
from docxtpl import DocxTemplate
from fastapi import HTTPException

# Use paths relative to this file
BASE_DIR = Path(__file__).parent.parent.parent

# ═══════════════════════════════════════════════════════════════════════════════
# MASTER-TEMPLATE MAPPING (v3.0 Strategie: Datei statt Logik)
#
# Jedes Land und jede Dokumentkategorie hat ein dediziertes Template.
# Keine komplexe Jinja2-Logik im Template selbst!
# ═══════════════════════════════════════════════════════════════════════════════

TEMPLATE_MAPPING: dict[tuple[str, str], str] = {
    # Deutschland (DE)
    ("DE", "contract"): "template_contract_de.docx",   # DIN 5008 Typ A/B, deutsche Ränder
    ("DE", "letter"): "template_letter_de.docx",       # DIN 5008 Geschäftsbrief
    ("DE", "certificate"): "template_certificate_de.docx",  # Bescheinigungen
    ("DE", "amendment"): "template_amendment_de.docx",  # Vertragsänderungen

    # Italien (IT)
    ("IT", "contract"): "template_contract_it.docx",   # Italienische Norm (UNI)
    ("IT", "letter"): "template_letter_it.docx",       # Italienisches Briefformat
    ("IT", "certificate"): "template_certificate_it.docx",  # Certificati
    ("IT", "amendment"): "template_amendment_it.docx",  # Modifiche contrattuali
}

# Fallback Template wenn keine spezifische Kategorie existiert
DEFAULT_TEMPLATE_MAPPING: dict[str, str] = {
    "DE": "template_default_de.docx",
    "IT": "template_default_it.docx",
}

# Kategorien nach Dokumenttyp-Name (Heuristik)
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "contract": ["vertrag", "arbeitsvertrag", "contract", "contratto", "anstellung"],
    "letter": ["brief", "schreiben", "letter", "lettera", "mahnung", "mitteilung", "kündigung", "licenziamento"],
    "certificate": ["bescheinigung", "zeugnis", "certificate", "certificato", "attestato"],
    "amendment": ["änderung", "ergänzung", "nachtrag", "amendment", "modifica", "integrazione"],
}


def detect_document_category(document_type_name: str) -> str:
    """
    Erkennt die Dokumentkategorie anhand des Dokumenttyp-Namens.

    Args:
        document_type_name: Name des Dokumenttyps (z.B. "Arbeitsvertrag (Vollzeit)")

    Returns:
        Kategorie: "contract", "letter", "certificate", "amendment"
    """
    name_lower = document_type_name.lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name_lower:
                return category

    # Default: Verträge für alles mit "vertrag", sonst Briefe
    if "vertrag" in name_lower or "contract" in name_lower or "contratto" in name_lower:
        return "contract"

    return "letter"  # Default-Fallback


def get_master_template(
    country_code: Literal["DE", "IT"],
    document_category: Optional[str] = None,
    document_type_name: Optional[str] = None
) -> str:
    """
    Wählt das passende Master-Template basierend auf Land und Kategorie.

    Vorteile dieser Strategie:
    - Keine If-Then-Logik im Template selbst
    - Wenn sich das italienische Briefpapier ändert, tauscht man nur
      template_letter_it.docx aus - kein Code-Deployment nötig
    - Klare Trennung: Layout im Template, Logik im Code

    Args:
        country_code: 'DE' oder 'IT'
        document_category: 'contract', 'letter', 'certificate', 'amendment'
        document_type_name: Name des Dokumenttyps (für Auto-Detection)

    Returns:
        Dateiname des passenden Templates

    Raises:
        ValueError: Wenn kein Template für die Kombination existiert
    """
    # Auto-Detect Kategorie wenn nicht angegeben
    if not document_category and document_type_name:
        document_category = detect_document_category(document_type_name)

    # Fallback auf "letter" wenn keine Kategorie erkannt
    if not document_category:
        document_category = "letter"

    # Template-Lookup
    template_key = (country_code, document_category)
    template_filename = TEMPLATE_MAPPING.get(template_key)

    if not template_filename:
        # Fallback auf Default-Template für das Land
        template_filename = DEFAULT_TEMPLATE_MAPPING.get(country_code)

    if not template_filename:
        raise ValueError(f"Kein Template für {country_code}/{document_category} konfiguriert")

    return template_filename


class TemplateEngine:
    """
    Document Assembly Engine für die Generierung von DOCX/PDF Dokumenten.

    Implementiert die v3.0 Strategie mit dedizierten Master-Templates:
    1. Wähle Master-Template basierend auf country_code und category
    2. Lade design_settings aus DB
    3. Assembliere Klauseln
    4. Ersetze Platzhalter
    5. Exportiere als DOCX/PDF
    """

    def __init__(self, templates_dir: str = None, output_dir: str = None):
        self.templates_dir = Path(templates_dir) if templates_dir else BASE_DIR / "storage" / "master-templates"
        self.output_dir = Path(output_dir) if output_dir else BASE_DIR / "storage" / "generated"
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def get_template_path(
        self,
        country_code: Literal["DE", "IT"],
        document_category: Optional[str] = None,
        document_type_name: Optional[str] = None
    ) -> Path:
        """
        Ermittelt den vollständigen Pfad zum passenden Master-Template.

        Args:
            country_code: Land ('DE' oder 'IT')
            document_category: Kategorie ('contract', 'letter', etc.)
            document_type_name: Name des Dokumenttyps (für Auto-Detection)

        Returns:
            Path zum Template

        Raises:
            HTTPException: Wenn Template nicht gefunden
        """
        template_filename = get_master_template(
            country_code=country_code,
            document_category=document_category,
            document_type_name=document_type_name
        )

        template_path = self.templates_dir / template_filename

        if not template_path.exists():
            # Versuche Fallback auf Default-Template
            fallback_filename = DEFAULT_TEMPLATE_MAPPING.get(country_code, "template_default_de.docx")
            fallback_path = self.templates_dir / fallback_filename

            if fallback_path.exists():
                return fallback_path

            raise HTTPException(
                status_code=404,
                detail=f"Master-Template {template_filename} nicht gefunden. "
                       f"Bitte laden Sie das Template in {self.templates_dir} hoch."
            )

        return template_path

    def assemble_document(
        self,
        template_name: str,
        context: dict,
        output_filename: str
    ) -> Path:
        """
        Loads a master DOCX template, renders Jinja2 context variables, and saves the DOCX.

        Args:
            template_name: Name der Template-Datei
            context: Dictionary mit Platzhalter-Werten
            output_filename: Name der Ausgabedatei

        Returns:
            Path zur generierten DOCX-Datei
        """
        template_path = self.templates_dir / template_name
        if not template_path.exists():
            raise HTTPException(status_code=404, detail=f"Template {template_name} not found")

        doc = DocxTemplate(template_path)

        # Merge rich HTML content if needed (requires subdoc functionality)
        # For now, assuming context contains plain strings or simple variables
        doc.render(context)

        output_path = self.output_dir / output_filename
        doc.save(output_path)

        return output_path

    def assemble_document_for_country(
        self,
        country_code: Literal["DE", "IT"],
        document_type_name: str,
        context: dict,
        output_filename: str,
        document_category: Optional[str] = None
    ) -> Path:
        """
        Assembliert ein Dokument mit automatischer Template-Auswahl nach Land.

        Diese Methode implementiert die v3.0 "Datei statt Logik" Strategie:
        - Wählt automatisch das richtige Template basierend auf Land und Kategorie
        - Kein manuelles Template-Mapping im aufrufenden Code nötig

        Args:
            country_code: 'DE' oder 'IT'
            document_type_name: Name des Dokumenttyps (für Kategorie-Detection)
            context: Dictionary mit Platzhalter-Werten
            output_filename: Name der Ausgabedatei
            document_category: Optionale explizite Kategorie

        Returns:
            Path zur generierten DOCX-Datei
        """
        template_path = self.get_template_path(
            country_code=country_code,
            document_category=document_category,
            document_type_name=document_type_name
        )

        doc = DocxTemplate(template_path)
        doc.render(context)

        output_path = self.output_dir / output_filename
        doc.save(output_path)

        return output_path

    def convert_to_pdf(self, docx_path: Path) -> Path:
        """
        Converts a DOCX file to PDF using LibreOffice headless mode.

        Args:
            docx_path: Path zur DOCX-Datei

        Returns:
            Path zur generierten PDF-Datei
        """
        if not docx_path.exists():
            raise FileNotFoundError(f"Source file {docx_path} does not exist")

        # LibreOffice output dir is same as source
        cmd = [
            "soffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(docx_path.parent),
            str(docx_path)
        ]

        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"PDF Conversion failed: {e.stderr.decode()}")

        pdf_path = docx_path.with_suffix(".pdf")
        if not pdf_path.exists():
            raise RuntimeError("PDF file was not created by LibreOffice")

        return pdf_path

    def list_available_templates(self) -> dict[str, list[str]]:
        """
        Listet alle verfügbaren Master-Templates auf.

        Returns:
            Dictionary mit Land als Key und Liste von Templates als Value
        """
        templates = {"DE": [], "IT": []}

        for file in self.templates_dir.glob("*.docx"):
            filename = file.name
            if "_de" in filename.lower():
                templates["DE"].append(filename)
            elif "_it" in filename.lower():
                templates["IT"].append(filename)

        return templates
