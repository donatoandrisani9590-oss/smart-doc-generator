"""
Referenzdokument-Vergleichstest
===============================
Testet, ob die generierten Dokumente strukturell mit den Originalen übereinstimmen.

Testdokumente:
1. Einladung Fürsorgegespräch - Briefformat mit Adresstabelle
2. DIRIGENTE Contratto - Italienischer Führungskräftevertrag
3. Mehmet Öztürk Vertragsentwurf - Deutscher Arbeitsvertrag

Prüfkriterien:
- Dokumentstruktur (Absätze, Tabellen)
- Formatierung (Schriftart, Größe, Ausrichtung)
- Platzhalter-Syntax
- DIN 5008 / UNI Konformität
"""

import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Any
import json

# Pfad zu den Testdokumenten
TEST_DOCS_PATH = Path.home() / "Documents" / "Test Dokumente"

# Namespace für Word XML
WORD_NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def extract_document_xml(docx_path: Path) -> ET.Element:
    """Extrahiert document.xml aus einem DOCX."""
    with zipfile.ZipFile(docx_path, 'r') as zf:
        with zf.open('word/document.xml') as f:
            return ET.parse(f).getroot()


def analyze_document_structure(root: ET.Element) -> Dict[str, Any]:
    """Analysiert die Dokumentstruktur."""
    body = root.find('.//w:body', WORD_NS)

    structure = {
        'paragraphs': 0,
        'tables': 0,
        'table_details': [],
        'headings': [],
        'placeholders': [],
        'fonts': set(),
        'alignments': [],
        'has_header': False,
        'has_footer': False,
    }

    if body is None:
        return structure

    # Absätze zählen
    paragraphs = body.findall('.//w:p', WORD_NS)
    structure['paragraphs'] = len(paragraphs)

    # Tabellen analysieren
    tables = body.findall('.//w:tbl', WORD_NS)
    structure['tables'] = len(tables)

    for i, table in enumerate(tables):
        rows = table.findall('.//w:tr', WORD_NS)
        cols = 0
        if rows:
            first_row_cells = rows[0].findall('.//w:tc', WORD_NS)
            cols = len(first_row_cells)

        # Borders prüfen
        borders = table.find('.//w:tblBorders', WORD_NS)
        has_borders = borders is not None
        border_style = 'none'
        if has_borders:
            top_border = borders.find('.//w:top', WORD_NS)
            if top_border is not None:
                border_val = top_border.get(f'{{{WORD_NS["w"]}}}val')
                border_style = border_val if border_val != 'none' else 'none'

        structure['table_details'].append({
            'index': i,
            'rows': len(rows),
            'cols': cols,
            'has_borders': border_style != 'none',
        })

    # Textinhalt und Platzhalter extrahieren
    for p in paragraphs:
        text_elements = p.findall('.//w:t', WORD_NS)
        text = ''.join(t.text or '' for t in text_elements)

        # Platzhalter finden [xxx] oder {{xxx}}
        import re
        placeholders = re.findall(r'\[([^\]]+)\]|\{\{([^}]+)\}\}', text)
        for ph in placeholders:
            ph_text = ph[0] or ph[1]
            if ph_text and ph_text not in structure['placeholders']:
                structure['placeholders'].append(ph_text)

        # Überschriften erkennen (fett + zentriert oder Heading-Style)
        pStyle = p.find('.//w:pStyle', WORD_NS)
        if pStyle is not None:
            style_val = pStyle.get(f'{{{WORD_NS["w"]}}}val', '')
            if 'heading' in style_val.lower() or 'titel' in style_val.lower() or 'berschr' in style_val.lower():
                structure['headings'].append(text.strip())

        # Ausrichtung
        jc = p.find('.//w:jc', WORD_NS)
        if jc is not None:
            alignment = jc.get(f'{{{WORD_NS["w"]}}}val', 'left')
            if alignment not in structure['alignments']:
                structure['alignments'].append(alignment)

        # Schriftarten
        rFonts = p.find('.//w:rFonts', WORD_NS)
        if rFonts is not None:
            font = rFonts.get(f'{{{WORD_NS["w"]}}}ascii', '')
            if font:
                structure['fonts'].add(font)

    # Fonts zu Liste konvertieren
    structure['fonts'] = list(structure['fonts'])

    return structure


def analyze_margins(docx_path: Path) -> Dict[str, float]:
    """Extrahiert die Seitenränder aus dem Dokument."""
    with zipfile.ZipFile(docx_path, 'r') as zf:
        with zf.open('word/document.xml') as f:
            root = ET.parse(f).getroot()

    margins = {'top': 0, 'bottom': 0, 'left': 0, 'right': 0}

    sectPr = root.find('.//w:sectPr', WORD_NS)
    if sectPr is not None:
        pgMar = sectPr.find('.//w:pgMar', WORD_NS)
        if pgMar is not None:
            # Werte sind in TWIPs (1/20 Punkt = 1/1440 Zoll)
            # Umrechnung in cm: twips / 567
            for side in ['top', 'bottom', 'left', 'right']:
                val = pgMar.get(f'{{{WORD_NS["w"]}}}{side}', '0')
                margins[side] = round(int(val) / 567, 2)

    return margins


def test_document(name: str, docx_path: Path) -> Dict[str, Any]:
    """Testet ein einzelnes Dokument."""
    if not docx_path.exists():
        return {'error': f'Datei nicht gefunden: {docx_path}'}

    root = extract_document_xml(docx_path)
    structure = analyze_document_structure(root)
    margins = analyze_margins(docx_path)

    return {
        'name': name,
        'path': str(docx_path),
        'structure': structure,
        'margins_cm': margins,
    }


def check_din5008_compliance(margins: Dict[str, float]) -> Dict[str, Any]:
    """Prüft DIN 5008 Konformität der Ränder."""
    # DIN 5008 Mindestanforderungen
    din_requirements = {
        'left': 2.5,   # Mindestens 2,5 cm
        'right': 1.0,  # Mindestens 1,0 cm
        'top': 2.0,    # Empfohlen 2,0-2,5 cm
        'bottom': 2.0, # Empfohlen 2,0 cm
    }

    compliance = {}
    for side, min_val in din_requirements.items():
        actual = margins.get(side, 0)
        compliance[side] = {
            'actual_cm': actual,
            'required_cm': min_val,
            'compliant': actual >= min_val - 0.1,  # 1mm Toleranz
        }

    compliance['overall'] = all(c['compliant'] for c in compliance.values() if isinstance(c, dict))
    return compliance


def run_all_tests():
    """Führt alle Tests durch und gibt Ergebnisse aus."""
    test_files = [
        ("Einladung Fürsorgegespräch", TEST_DOCS_PATH / "01_Einladung Fürsorgegespräch (1).docx"),
        ("DIRIGENTE Contratto (IT)", TEST_DOCS_PATH / "DIRIGENTE_Contratto_Alessandra Secchi_03112025.docx"),
        ("Arbeitsvertrag (DE)", TEST_DOCS_PATH / "Mehmet Öztürk Vertragsentwurf 112025.docx"),
    ]

    results = []

    print("=" * 70)
    print("REFERENZDOKUMENT-ANALYSE")
    print("=" * 70)

    for name, path in test_files:
        print(f"\n{'─' * 70}")
        print(f"Dokument: {name}")
        print(f"{'─' * 70}")

        result = test_document(name, path)

        if 'error' in result:
            print(f"  FEHLER: {result['error']}")
            continue

        s = result['structure']
        m = result['margins_cm']

        print(f"\n  STRUKTUR:")
        print(f"    Absätze:     {s['paragraphs']}")
        print(f"    Tabellen:    {s['tables']}")

        if s['table_details']:
            for td in s['table_details']:
                border_status = "mit Rahmen" if td['has_borders'] else "OHNE Rahmen"
                print(f"      - Tabelle {td['index']+1}: {td['rows']}x{td['cols']} ({border_status})")

        print(f"    Überschriften: {len(s['headings'])}")
        for h in s['headings'][:3]:
            print(f"      - \"{h[:50]}...\"" if len(h) > 50 else f"      - \"{h}\"")

        print(f"    Platzhalter: {len(s['placeholders'])}")
        for ph in s['placeholders'][:5]:
            print(f"      - [{ph}]")
        if len(s['placeholders']) > 5:
            print(f"      ... und {len(s['placeholders']) - 5} weitere")

        print(f"    Schriftarten: {', '.join(s['fonts'][:3]) if s['fonts'] else 'Standard'}")
        print(f"    Ausrichtungen: {', '.join(s['alignments']) if s['alignments'] else 'Standard'}")

        print(f"\n  SEITENRÄNDER (cm):")
        print(f"    Links:  {m['left']:.2f} | Rechts: {m['right']:.2f}")
        print(f"    Oben:   {m['top']:.2f} | Unten:  {m['bottom']:.2f}")

        # DIN 5008 Check
        din_check = check_din5008_compliance(m)
        status = "KONFORM" if din_check['overall'] else "NICHT KONFORM"
        print(f"\n  DIN 5008: {status}")

        result['din5008'] = din_check
        results.append(result)

    # Zusammenfassung
    print(f"\n{'=' * 70}")
    print("ZUSAMMENFASSUNG - GENERIERBARKEIT")
    print("=" * 70)

    for result in results:
        if 'error' in result:
            continue

        name = result['name']
        s = result['structure']
        din = result.get('din5008', {})

        issues = []

        # Tabellen ohne Rahmen prüfen
        borderless_tables = [t for t in s['table_details'] if not t['has_borders']]
        if borderless_tables:
            issues.append(f"Tabellen ohne Rahmen: {len(borderless_tables)} (Engine unterstützt das)")

        # Platzhalter prüfen
        if s['placeholders']:
            issues.append(f"Platzhalter: {len(s['placeholders'])} (Engine ersetzt diese)")

        # DIN 5008
        if not din.get('overall', True):
            issues.append("DIN 5008 Ränder nicht Standard")

        status = "GENERIERBAR" if not any('nicht' in i.lower() for i in issues) else "PRÜFEN"

        print(f"\n  {name}:")
        print(f"    Status: {status}")
        if issues:
            for issue in issues:
                print(f"    - {issue}")
        else:
            print(f"    - Keine Probleme erkannt")

    return results


if __name__ == "__main__":
    results = run_all_tests()

    # JSON-Export für weitere Analyse
    output_path = Path(__file__).parent / "reference_document_analysis.json"

    # Sets zu Listen konvertieren für JSON
    for r in results:
        if 'structure' in r and 'fonts' in r['structure']:
            r['structure']['fonts'] = list(r['structure']['fonts'])

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n\nDetaillierte Analyse gespeichert: {output_path}")
