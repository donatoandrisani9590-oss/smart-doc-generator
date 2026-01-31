"""
Document Analyzer with Position Tracking for Side-by-Side Mapping

Implements the "Magic Word Import" feature for v4.2:
- Parses DOCX files and extracts text with position information
- Detects potential placeholder values (dates, names, currencies, etc.)
- Generates HTML preview with interactive markers for visual mapping
- Supports PDF generation for exact document preview

This service enables the Side-by-Side Mapping-Assistent where users can:
- See original document on the left
- See detected values/placeholders on the right
- Click to confirm or modify mappings
"""

import re
import os
import uuid
import subprocess
import tempfile
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from difflib import SequenceMatcher

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.services.placeholder_validator import (
    KNOWN_PLACEHOLDERS,
    PLACEHOLDER_LOOKUP,
    PlaceholderInfo,
    levenshtein_distance
)

logger = logging.getLogger(__name__)

# Base directory for temporary files
BASE_DIR = Path(__file__).parent.parent.parent
TEMP_DIR = BASE_DIR / "storage" / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════════
# DATA CLASSES
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class TextPosition:
    """Tracks the exact position of text in the document."""
    paragraph_index: int
    run_index: int
    char_start: int
    char_end: int
    table_info: Optional[Dict[str, int]] = None  # {table_idx, row_idx, cell_idx}


@dataclass
class DetectedValue:
    """A detected potential placeholder value with its position and suggestions."""
    id: str
    text: str
    value_type: str  # date, currency, name, number, text, email, phone
    position: TextPosition
    confidence: float  # 0.0 - 1.0
    suggested_placeholder: Optional[str] = None
    suggested_label: Optional[str] = None
    alternatives: List[str] = field(default_factory=list)
    is_confirmed: bool = False
    user_override: Optional[str] = None


@dataclass
class DocumentSection:
    """A logical section of the document (paragraph, table, etc.)."""
    id: str
    section_type: str  # paragraph, table, heading, list_item
    content: str
    html_content: str
    position_start: int
    position_end: int
    detected_values: List[DetectedValue] = field(default_factory=list)


@dataclass
class AnalysisResult:
    """Complete result of document analysis."""
    document_id: str
    original_filename: str
    preview_html: str
    preview_pdf_path: Optional[str]
    sections: List[DocumentSection]
    detected_values: List[DetectedValue]
    statistics: Dict[str, Any]
    created_at: str


# ═══════════════════════════════════════════════════════════════════════════════
# DETECTION PATTERNS
# ═══════════════════════════════════════════════════════════════════════════════

# German date formats
DATE_PATTERNS = [
    # DD.MM.YYYY
    (r'\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b', 'date'),
    # DD. Month YYYY (German)
    (r'\b(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})\b', 'date'),
    # YYYY-MM-DD (ISO)
    (r'\b(\d{4})-(\d{2})-(\d{2})\b', 'date'),
]

# Currency patterns (EUR focused)
CURRENCY_PATTERNS = [
    # 1.234,56 € or 1.234,56 EUR
    (r'\b(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:€|EUR|Euro)\b', 'currency'),
    # € 1.234,56 or EUR 1.234,56
    (r'(?:€|EUR|Euro)\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\b', 'currency'),
    # Simple: 50.000 €
    (r'\b(\d+(?:\.\d{3})*)\s*(?:€|EUR|Euro)\b', 'currency'),
]

# Number patterns (hours, days, percentages)
NUMBER_PATTERNS = [
    # XX Stunden/Tage/Wochen/Monate
    (r'\b(\d+)\s*(?:Stunden?|Tage?|Wochen?|Monate?|Jahre?)\b', 'number'),
    # XX % or XX Prozent
    (r'\b(\d+(?:,\d+)?)\s*(?:%|Prozent)\b', 'number'),
    # Plain numbers in context
    (r'\b(\d+)\s+(?:Urlaubstage|Arbeitstage|Werktage)\b', 'number'),
]

# Name patterns (Title + Name)
NAME_PATTERNS = [
    # Herr/Frau + Name
    (r'\b((?:Herr|Frau|Dr\.|Prof\.)\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b', 'name'),
    # Two capitalized words (potential names)
    (r'\b([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)\b', 'name'),
]

# Address patterns
ADDRESS_PATTERNS = [
    # Street + Number, PLZ City
    (r'\b([A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|allee|ring)\s+\d+[a-z]?(?:,?\s+\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+)?)\b', 'address'),
    # PLZ + City
    (r'\b(\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)?)\b', 'address'),
]

# Contact patterns
CONTACT_PATTERNS = [
    # Email
    (r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b', 'email'),
    # Phone (German formats)
    (r'\b((?:\+49|0049|0)\s*\d{2,4}[\s/-]?\d{3,}[\s/-]?\d{0,})\b', 'phone'),
]

# All patterns combined with priority (higher = more specific)
ALL_PATTERNS = [
    *[(p, t, 0.9) for p, t in DATE_PATTERNS],
    *[(p, t, 0.85) for p, t in CURRENCY_PATTERNS],
    *[(p, t, 0.8) for p, t in NUMBER_PATTERNS],
    *[(p, t, 0.7) for p, t in CONTACT_PATTERNS],
    *[(p, t, 0.6) for p, t in ADDRESS_PATTERNS],
    *[(p, t, 0.5) for p, t in NAME_PATTERNS],
]


# ═══════════════════════════════════════════════════════════════════════════════
# PLACEHOLDER SUGGESTION MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

# Keywords in surrounding text that suggest specific placeholders
CONTEXT_KEYWORDS = {
    'eintrittsdatum': ['eintritt', 'beginn', 'arbeitsverhältnis beginnt', 'start'],
    'austrittsdatum': ['austritt', 'ende', 'arbeitsverhältnis endet', 'beendigung'],
    'gehalt_brutto': ['brutto', 'gehalt', 'vergütung', 'entgelt', 'lohn'],
    'gehalt_brutto_monat': ['monatlich', 'pro monat', 'mtl'],
    'urlaubstage': ['urlaub', 'urlaubstage', 'urlaubsanspruch', 'erholungsurlaub'],
    'wochenstunden': ['stunden', 'arbeitszeit', 'wöchentlich', 'wochenstunden'],
    'position': ['position', 'stelle', 'tätigkeit', 'funktion', 'aufgabe'],
    'abteilung': ['abteilung', 'bereich', 'team', 'department'],
    'arbeitsort': ['arbeitsort', 'dienstort', 'einsatzort', 'standort'],
    'probezeit_monate': ['probezeit', 'probe'],
    'kuendigungsfrist': ['kündigung', 'kündigungsfrist', 'frist'],
    'mitarbeiter_name': ['mitarbeiter', 'arbeitnehmer', 'angestellte'],
    'firma_name': ['arbeitgeber', 'firma', 'unternehmen', 'gesellschaft'],
    'datum_heute': ['datum', 'heute', 'unterschrift'],
    'ort_unterschrift': ['ort', 'unterschrift'],
}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN ANALYZER CLASS
# ═══════════════════════════════════════════════════════════════════════════════

class DocumentAnalyzerWithPositions:
    """
    Analyzes DOCX documents and extracts text with position information.

    Key features:
    - Preserves document structure (paragraphs, tables, lists)
    - Detects potential placeholder values with regex patterns
    - Generates HTML preview with clickable markers
    - Supports PDF generation for exact visual preview
    - Provides intelligent placeholder suggestions based on context
    """

    def __init__(self, docx_path: str, original_filename: str = None):
        """
        Initialize analyzer with a DOCX file.

        Args:
            docx_path: Path to the DOCX file
            original_filename: Original filename for display
        """
        self.docx_path = Path(docx_path)
        self.original_filename = original_filename or self.docx_path.name
        self.document_id = str(uuid.uuid4())
        self.doc = Document(docx_path)

        self.sections: List[DocumentSection] = []
        self.detected_values: List[DetectedValue] = []
        self._value_counter = 0

    def analyze(self, generate_pdf: bool = False) -> AnalysisResult:
        """
        Perform full document analysis.

        Args:
            generate_pdf: Whether to generate PDF preview (requires LibreOffice)

        Returns:
            AnalysisResult with all detected values and preview HTML
        """
        # Step 1: Extract document structure
        self._extract_sections()

        # Step 2: Detect potential values in each section
        self._detect_values_in_sections()

        # Step 3: Generate HTML preview with markers
        preview_html = self._generate_preview_html()

        # Step 4: Optionally generate PDF
        pdf_path = None
        if generate_pdf:
            pdf_path = self._generate_pdf_preview()

        # Step 5: Calculate statistics
        statistics = self._calculate_statistics()

        return AnalysisResult(
            document_id=self.document_id,
            original_filename=self.original_filename,
            preview_html=preview_html,
            preview_pdf_path=pdf_path,
            sections=self.sections,
            detected_values=self.detected_values,
            statistics=statistics,
            created_at=datetime.utcnow().isoformat()
        )

    def _extract_sections(self):
        """Extract document structure into sections."""
        section_index = 0

        for elem in self.doc.element.body:
            if elem.tag.endswith('p'):
                # Paragraph
                para = Paragraph(elem, self.doc)
                text = para.text.strip()

                if text:
                    section = DocumentSection(
                        id=f"section_{section_index}",
                        section_type=self._detect_paragraph_type(para),
                        content=text,
                        html_content=self._paragraph_to_html(para),
                        position_start=section_index,
                        position_end=section_index
                    )
                    self.sections.append(section)
                    section_index += 1

            elif elem.tag.endswith('tbl'):
                # Table
                table = Table(elem, self.doc)
                html_content, text_content = self._table_to_html(table, section_index)

                section = DocumentSection(
                    id=f"section_{section_index}",
                    section_type='table',
                    content=text_content,
                    html_content=html_content,
                    position_start=section_index,
                    position_end=section_index
                )
                self.sections.append(section)
                section_index += 1

    def _detect_paragraph_type(self, para: Paragraph) -> str:
        """Detect if paragraph is heading, list item, or normal text."""
        style_name = para.style.name.lower() if para.style else ""

        if 'heading' in style_name or 'überschrift' in style_name:
            return 'heading'
        elif 'list' in style_name or 'aufzählung' in style_name:
            return 'list_item'
        else:
            return 'paragraph'

    def _paragraph_to_html(self, para: Paragraph) -> str:
        """Convert paragraph to HTML preserving basic formatting."""
        html_parts = []

        for run in para.runs:
            text = run.text
            if not text:
                continue

            # Apply formatting
            if run.bold:
                text = f"<strong>{text}</strong>"
            if run.italic:
                text = f"<em>{text}</em>"
            if run.underline:
                text = f"<u>{text}</u>"

            html_parts.append(text)

        content = ''.join(html_parts)

        # Wrap based on type
        style_name = para.style.name.lower() if para.style else ""
        if 'heading 1' in style_name or 'überschrift 1' in style_name:
            return f"<h1>{content}</h1>"
        elif 'heading 2' in style_name or 'überschrift 2' in style_name:
            return f"<h2>{content}</h2>"
        elif 'heading 3' in style_name or 'überschrift 3' in style_name:
            return f"<h3>{content}</h3>"
        elif 'list' in style_name:
            return f"<li>{content}</li>"
        else:
            return f"<p>{content}</p>"

    def _table_to_html(self, table: Table, section_index: int) -> Tuple[str, str]:
        """Convert table to HTML and extract text content."""
        html_rows = []
        text_parts = []

        for row_idx, row in enumerate(table.rows):
            html_cells = []
            for cell_idx, cell in enumerate(row.cells):
                cell_text = cell.text.strip()
                text_parts.append(cell_text)

                # Use th for header row (first row)
                tag = 'th' if row_idx == 0 else 'td'
                html_cells.append(f"<{tag}>{cell_text}</{tag}>")

            html_rows.append(f"<tr>{''.join(html_cells)}</tr>")

        html = f"<table class='doc-table'>{''.join(html_rows)}</table>"
        text = ' | '.join(text_parts)

        return html, text

    def _detect_values_in_sections(self):
        """Detect potential placeholder values in all sections."""
        for section in self.sections:
            section_values = self._detect_values_in_text(
                section.content,
                section.position_start
            )
            section.detected_values = section_values
            self.detected_values.extend(section_values)

    def _detect_values_in_text(
        self,
        text: str,
        paragraph_index: int
    ) -> List[DetectedValue]:
        """
        Detect potential placeholder values in text using regex patterns.

        Args:
            text: The text to analyze
            paragraph_index: Index of the paragraph for position tracking

        Returns:
            List of detected values with positions
        """
        detected = []
        used_ranges = []  # Prevent overlapping detections

        for pattern, value_type, base_confidence in ALL_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                start, end = match.start(), match.end()

                # Skip if overlaps with existing detection
                if any(s <= start < e or s < end <= e for s, e in used_ranges):
                    continue

                matched_text = match.group(0)

                # Get context for better placeholder suggestion
                context_start = max(0, start - 50)
                context_end = min(len(text), end + 50)
                context = text[context_start:context_end].lower()

                # Suggest placeholder based on type and context
                suggested = self._suggest_placeholder(value_type, context, matched_text)

                # Calculate confidence based on pattern specificity and context match
                confidence = self._calculate_confidence(
                    base_confidence, value_type, context, suggested
                )

                self._value_counter += 1
                detected_value = DetectedValue(
                    id=f"val_{self._value_counter}",
                    text=matched_text,
                    value_type=value_type,
                    position=TextPosition(
                        paragraph_index=paragraph_index,
                        run_index=0,
                        char_start=start,
                        char_end=end
                    ),
                    confidence=confidence,
                    suggested_placeholder=suggested,
                    suggested_label=PLACEHOLDER_LOOKUP[suggested].label if suggested and suggested in PLACEHOLDER_LOOKUP else None,
                    alternatives=self._get_alternative_placeholders(value_type)
                )

                detected.append(detected_value)
                used_ranges.append((start, end))

        # Sort by position
        detected.sort(key=lambda v: v.position.char_start)
        return detected

    def _suggest_placeholder(
        self,
        value_type: str,
        context: str,
        matched_text: str
    ) -> Optional[str]:
        """
        Suggest the most appropriate placeholder based on value type and context.

        Uses keyword matching in surrounding text to determine the semantic meaning.
        """
        # First, try context-based matching
        for placeholder_name, keywords in CONTEXT_KEYWORDS.items():
            placeholder_info = PLACEHOLDER_LOOKUP.get(placeholder_name)
            if not placeholder_info:
                continue

            # Check if value type matches
            if placeholder_info.type != value_type and not (
                placeholder_info.type in ['text', 'select'] and value_type == 'name'
            ):
                continue

            # Check for keyword match in context
            for keyword in keywords:
                if keyword in context:
                    return placeholder_name

        # Fallback: suggest by type
        type_defaults = {
            'date': 'datum_heute',
            'currency': 'gehalt_brutto',
            'number': 'wochenstunden',
            'name': 'mitarbeiter_name',
            'address': 'firma_adresse',
            'email': None,
            'phone': None,
        }

        return type_defaults.get(value_type)

    def _calculate_confidence(
        self,
        base_confidence: float,
        value_type: str,
        context: str,
        suggested_placeholder: Optional[str]
    ) -> float:
        """Calculate confidence score based on multiple factors."""
        confidence = base_confidence

        # Boost if we found a matching placeholder
        if suggested_placeholder:
            confidence += 0.1

        # Boost for specific context matches
        if value_type == 'date':
            if any(word in context for word in ['eintritt', 'beginn', 'start', 'ab dem']):
                confidence += 0.05
        elif value_type == 'currency':
            if any(word in context for word in ['brutto', 'gehalt', 'vergütung']):
                confidence += 0.05

        return min(confidence, 1.0)

    def _get_alternative_placeholders(self, value_type: str) -> List[str]:
        """Get alternative placeholder suggestions for a value type."""
        type_mapping = {
            'date': ['date'],
            'currency': ['currency'],
            'number': ['number'],
            'name': ['text'],
            'address': ['text'],
            'email': ['text'],
            'phone': ['text'],
            'text': ['text', 'select'],
        }

        allowed_types = type_mapping.get(value_type, ['text'])

        alternatives = [
            p.name for p in KNOWN_PLACEHOLDERS
            if p.type in allowed_types
        ][:10]  # Limit to 10 suggestions

        return alternatives

    def _generate_preview_html(self) -> str:
        """
        Generate HTML preview with interactive markers for detected values.

        Each detected value gets a data-attribute for JavaScript interaction.
        """
        html_parts = [
            '<!DOCTYPE html>',
            '<html lang="de">',
            '<head>',
            '<meta charset="UTF-8">',
            '<style>',
            self._get_preview_styles(),
            '</style>',
            '</head>',
            '<body>',
            '<div class="document-preview">',
        ]

        for section in self.sections:
            section_html = section.html_content

            # Insert markers for detected values (in reverse order to preserve positions)
            for value in sorted(section.detected_values,
                              key=lambda v: v.position.char_start,
                              reverse=True):
                marker = self._create_value_marker(value)

                # Find the value text in the HTML and wrap it
                # This is simplified - production code would need proper HTML parsing
                section_html = self._insert_marker_in_html(
                    section_html, value.text, marker, value.id
                )

            html_parts.append(f'<div class="section section-{section.section_type}" data-section-id="{section.id}">')
            html_parts.append(section_html)
            html_parts.append('</div>')

        html_parts.extend([
            '</div>',
            '</body>',
            '</html>'
        ])

        return '\n'.join(html_parts)

    def _create_value_marker(self, value: DetectedValue) -> str:
        """Create HTML marker for a detected value."""
        confidence_class = 'high' if value.confidence >= 0.8 else 'medium' if value.confidence >= 0.6 else 'low'

        return (
            f'<span class="detected-value {confidence_class}" '
            f'data-value-id="{value.id}" '
            f'data-value-type="{value.value_type}" '
            f'data-suggested="{value.suggested_placeholder or ""}" '
            f'data-confidence="{value.confidence:.2f}">'
            f'{value.text}'
            f'</span>'
        )

    def _insert_marker_in_html(
        self,
        html: str,
        text: str,
        marker: str,
        value_id: str
    ) -> str:
        """Insert marker around text in HTML, handling HTML tags carefully."""
        # Simple text replacement - in production, use proper HTML parsing
        # to avoid replacing text inside tags

        # Escape special regex characters in the text
        escaped_text = re.escape(text)

        # Replace only plain text, not already marked text
        pattern = f'(?<![">])({escaped_text})(?![<"])'

        return re.sub(pattern, marker, html, count=1)

    def _get_preview_styles(self) -> str:
        """Return CSS styles for the preview HTML."""
        return '''
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: #fff;
            }

            .document-preview {
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 40px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .section {
                margin-bottom: 1em;
            }

            .section-heading h1, .section-heading h2, .section-heading h3 {
                color: #1a1a1a;
                margin-top: 1.5em;
                margin-bottom: 0.5em;
            }

            .doc-table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
            }

            .doc-table th, .doc-table td {
                border: 1px solid #ddd;
                padding: 8px 12px;
                text-align: left;
            }

            .doc-table th {
                background: #f5f5f5;
                font-weight: 600;
            }

            /* Detected value markers */
            .detected-value {
                position: relative;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 3px;
                transition: all 0.2s ease;
            }

            .detected-value.high {
                background: rgba(34, 197, 94, 0.2);
                border-bottom: 2px solid #22c55e;
            }

            .detected-value.medium {
                background: rgba(234, 179, 8, 0.2);
                border-bottom: 2px solid #eab308;
            }

            .detected-value.low {
                background: rgba(239, 68, 68, 0.2);
                border-bottom: 2px solid #ef4444;
            }

            .detected-value:hover {
                filter: brightness(0.95);
                transform: scale(1.02);
            }

            .detected-value.selected {
                outline: 2px solid #3b82f6;
                outline-offset: 2px;
            }

            .detected-value.confirmed {
                background: rgba(34, 197, 94, 0.3);
                border-bottom-color: #16a34a;
            }

            .detected-value.rejected {
                opacity: 0.5;
                text-decoration: line-through;
            }
        '''

    def _generate_pdf_preview(self) -> Optional[str]:
        """
        Generate PDF preview using LibreOffice for exact visual representation.

        Returns:
            Path to generated PDF or None if conversion fails
        """
        try:
            output_dir = TEMP_DIR / self.document_id
            output_dir.mkdir(parents=True, exist_ok=True)

            cmd = [
                "soffice",
                "--headless",
                "--convert-to", "pdf",
                "--outdir", str(output_dir),
                str(self.docx_path)
            ]

            result = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=60
            )

            # Find the generated PDF
            pdf_files = list(output_dir.glob("*.pdf"))
            if pdf_files:
                return str(pdf_files[0])

            logger.warning("LibreOffice did not generate PDF file")
            return None

        except subprocess.TimeoutExpired:
            logger.error("PDF generation timed out")
            return None
        except subprocess.CalledProcessError as e:
            logger.error(f"PDF generation failed: {e.stderr.decode()}")
            return None
        except FileNotFoundError:
            logger.warning("LibreOffice not installed - PDF preview unavailable")
            return None

    def _calculate_statistics(self) -> Dict[str, Any]:
        """Calculate analysis statistics."""
        type_counts = {}
        confidence_sum = 0

        for value in self.detected_values:
            type_counts[value.value_type] = type_counts.get(value.value_type, 0) + 1
            confidence_sum += value.confidence

        avg_confidence = confidence_sum / len(self.detected_values) if self.detected_values else 0

        return {
            'total_sections': len(self.sections),
            'total_detected_values': len(self.detected_values),
            'values_by_type': type_counts,
            'average_confidence': round(avg_confidence, 2),
            'high_confidence_count': sum(1 for v in self.detected_values if v.confidence >= 0.8),
            'suggested_placeholder_count': sum(1 for v in self.detected_values if v.suggested_placeholder),
        }

    def to_dict(self) -> Dict[str, Any]:
        """Convert analysis result to dictionary for JSON serialization."""
        result = self.analyze()

        return {
            'document_id': result.document_id,
            'original_filename': result.original_filename,
            'preview_html': result.preview_html,
            'preview_pdf_path': result.preview_pdf_path,
            'sections': [asdict(s) for s in result.sections],
            'detected_values': [
                {
                    **asdict(v),
                    'position': asdict(v.position)
                }
                for v in result.detected_values
            ],
            'statistics': result.statistics,
            'created_at': result.created_at
        }


# ═══════════════════════════════════════════════════════════════════════════════
# SIMILARITY DETECTION FOR "FÜR ALLE ERSETZEN"
# ═══════════════════════════════════════════════════════════════════════════════

class SimilarityDetector:
    """
    Detects similar values across the document for batch replacement.

    Enables the "Für alle ersetzen" (Replace All) feature where confirming
    one mapping can auto-apply to similar values.
    """

    def __init__(self, detected_values: List[DetectedValue]):
        self.values = detected_values

    def find_similar(
        self,
        reference_value: DetectedValue,
        threshold: float = 0.85
    ) -> List[DetectedValue]:
        """
        Find values similar to the reference value.

        Args:
            reference_value: The confirmed/reference value
            threshold: Minimum similarity score (0.0 - 1.0)

        Returns:
            List of similar values that could be auto-mapped
        """
        similar = []

        for value in self.values:
            if value.id == reference_value.id:
                continue

            # Must be same type
            if value.value_type != reference_value.value_type:
                continue

            # Calculate text similarity
            similarity = SequenceMatcher(
                None,
                reference_value.text.lower(),
                value.text.lower()
            ).ratio()

            if similarity >= threshold:
                similar.append(value)

        return similar

    def group_similar_values(self, threshold: float = 0.85) -> Dict[str, List[DetectedValue]]:
        """
        Group all values by similarity for batch processing.

        Returns:
            Dictionary mapping group ID to list of similar values
        """
        groups = {}
        processed = set()

        for value in self.values:
            if value.id in processed:
                continue

            similar = self.find_similar(value, threshold)
            if similar:
                group_id = f"group_{value.id}"
                groups[group_id] = [value] + similar
                processed.add(value.id)
                for s in similar:
                    processed.add(s.id)
            else:
                # Single value, not grouped
                groups[f"single_{value.id}"] = [value]
                processed.add(value.id)

        return groups


# ═══════════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_document(
    docx_path: str,
    original_filename: str = None,
    generate_pdf: bool = False
) -> Dict[str, Any]:
    """
    Convenience function to analyze a document and return results as dict.

    Args:
        docx_path: Path to DOCX file
        original_filename: Original filename for display
        generate_pdf: Whether to generate PDF preview

    Returns:
        Analysis result as dictionary
    """
    analyzer = DocumentAnalyzerWithPositions(docx_path, original_filename)
    result = analyzer.analyze(generate_pdf=generate_pdf)

    return {
        'document_id': result.document_id,
        'original_filename': result.original_filename,
        'preview_html': result.preview_html,
        'preview_pdf_path': result.preview_pdf_path,
        'sections': [asdict(s) for s in result.sections],
        'detected_values': [
            {
                'id': v.id,
                'text': v.text,
                'value_type': v.value_type,
                'position': asdict(v.position),
                'confidence': v.confidence,
                'suggested_placeholder': v.suggested_placeholder,
                'suggested_label': v.suggested_label,
                'alternatives': v.alternatives,
                'is_confirmed': v.is_confirmed,
            }
            for v in result.detected_values
        ],
        'statistics': result.statistics,
        'created_at': result.created_at
    }


def confirm_mappings(
    detected_values: List[Dict],
    confirmations: Dict[str, str]
) -> List[Dict]:
    """
    Apply user confirmations to detected values.

    Args:
        detected_values: List of detected value dicts
        confirmations: Dict mapping value_id to confirmed placeholder name

    Returns:
        Updated detected values with confirmations applied
    """
    for value in detected_values:
        if value['id'] in confirmations:
            value['is_confirmed'] = True
            value['user_override'] = confirmations[value['id']]

    return detected_values
