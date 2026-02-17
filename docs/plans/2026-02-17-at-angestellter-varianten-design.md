# AT-Angestellter Vertrag via Varianten-System

**Datum:** 2026-02-17
**Status:** Genehmigt
**Ansatz:** B — Varianten-System (eine Klausel, mehrere Varianten)

## Zusammenfassung

Statt einen separaten Dokumenttyp für AT-Angestellte zu erstellen, erweitern wir den bestehenden Arbeitsvertrag um ein Varianten-System. Jede Klausel, die sich zwischen Tarifvertrag und AT-Vertrag unterscheidet, bekommt mehrere Varianten. Ein Formularfeld "Vertragsart" steuert, welche Variante automatisch vorausgewählt wird.

## Grundprinzip

```
Klausel "Kündigung"
  ├── Variante 1: Tarif (Standard bei vertragsart=tarifgebunden)
  │   → "gemäß Haustarifvertrag Ziff. 65-70..."
  └── Variante 2: AT (Standard bei vertragsart=at_angestellter)
      → "individuell vereinbarte Kündigungsfrist von 3 Monaten..."
```

**Vorteile:**
- Einmalige Pflege pro Klausel-Bereich
- Ein-Klick-Verknüpfung mit Vertragsarten
- KI versteht die Verknüpfung (description + auto_select_condition)
- Kein neuer Dokumenttyp, keine DB-Migration

## Betroffene Klauseln (10 von 23)

Diese Klauseln referenzieren den Haustarifvertrag/IG BCE und brauchen AT-Varianten:

| # | display_order | Klausel | Änderung für AT |
|---|---|---|---|
| 1 | 2 | Hinweis auf Tarifverträge | → "Es finden keine Tarifverträge Anwendung. Das Arbeitsverhältnis wird ausschließlich durch diesen Vertrag geregelt." |
| 2 | 3 | Probezeit | → Ohne "Haustarifvertrag Ziff. 63"-Referenz, individuelle Probezeit |
| 3 | 5 | Eingruppierung | → Ersetzt durch individuelle Gehaltsvereinbarung (keine Tarifgruppe) |
| 4 | 7 | Arbeitszeit | → Vertrauensarbeitszeit statt tariflicher 37,5h-Regelung |
| 5 | 9 | Vergütung | → Jahresgehalt + optionaler Zielbonus statt Tarifgruppe/Lohntabelle |
| 6 | 10 | Zuschläge | → Überstundenpauschale statt tariflicher Zuschläge (Mehr-/Nachtarbeit) |
| 7 | 11 | Urlaub | → Individuell vereinbarter Urlaub (typisch 30 Tage) ohne Tarifverweis |
| 8 | 12 | Sonderurlaub | → Ohne Haustarifvertrag-Referenz (Ziff. 56-58) |
| 9 | 16 | Kündigung | → Individuelle Kündigungsfristen + optionale Freistellungsklausel |
| 10 | 22 | Ausschlussfristen | → Ohne tarifliche Ausschlussfristen (Ziff. 71-75) |

**13 Klauseln bleiben unverändert** (gelten identisch für Tarif und AT):
Beginn/Dauer, Tätigkeit, Arbeitsort, Arbeitszeitkonto, Krankheit, Verschwiegenheit, Nebentätigkeit, Firmenwagen, Home Office, Datenschutz, Arbeitsergebnisse, Vertragsstrafe, Schlussbestimmungen.

## Neue AT-spezifische Klauseln (4)

Klauseln, die nur bei AT-Verträgen erscheinen (conditional auf vertragsart):

| Klausel | clause_type | show_condition | Inhalt |
|---------|------------|----------------|--------|
| Zielbonus / Variable Vergütung | conditional | `vertragsart=at_angestellter AND zielbonus=true` | Jährliche Zielvereinbarung, Auszahlungsmodus, Stichtagsregelung |
| Freistellung bei Kündigung | conditional | `vertragsart=at_angestellter AND freistellung=true` | Unwiderrufliche Freistellung (Garden Leave) unter Anrechnung von Urlaub |
| Renteneintrittsklausel | conditional | `vertragsart=at_angestellter` | Automatisches Ende bei Erreichen der Regelaltersgrenze |
| Spesen & Reisekosten | conditional | `vertragsart=at_angestellter AND spesen=true` | Pauschal- oder Einzelabrechnung von Reisekosten |

## Datenbank-Design

### Keine Migration nötig

Alle Tabellen und Felder existieren bereits:
- `clause_variant_groups` — 10 neue Gruppen
- `clause_variants` — 20 neue Einträge (2 pro Gruppe)
- `document_type_variant_groups` — 10 Verknüpfungen zum Arbeitsvertrag
- `clauses` — 14 neue Klauseln (10 AT-Varianten + 4 AT-only)
- `form_fields` — 5 neue Felder

### auto_select_condition

Jede ClauseVariant bekommt eine JSON-Bedingung:

```json
// Tarif-Variante (is_default=true für Arbeitsvertrag):
{
  "field": "vertragsart",
  "operator": "=",
  "value": "tarifgebunden"
}

// AT-Variante:
{
  "field": "vertragsart",
  "operator": "=",
  "value": "at_angestellter"
}
```

### Neue FormFields

| field_name | field_label | field_type | options | display_group | show_condition |
|---|---|---|---|---|---|
| vertragsart | Vertragsart | select | `["Tarifgebunden", "AT-Angestellter"]` | Vertragsdaten | — (immer sichtbar) |
| zielbonus | Zielbonus / Variable Vergütung | checkbox | — | Vergütung | `vertragsart=at_angestellter` |
| freistellung | Freistellungsklausel | checkbox | — | Kündigung | `vertragsart=at_angestellter` |
| spesen | Spesen & Reisekosten | checkbox | — | Vergütung | `vertragsart=at_angestellter` |
| renteneintritt | Renteneintrittsklausel | checkbox | — | Vertragsdaten | `vertragsart=at_angestellter` |

## Backend-Änderungen

### 1. Preview-Engine erweitern (preview.py + preview endpoint)

Aktuell unterstützt nur der Composer Varianten. Die Standard-Preview und Generation müssen erweitert werden:

- `generate_preview()` lädt `DocumentTypeVariantGroup` für den Dokumenttyp
- Wenn eine Klausel `clause_type="variant"` hat:
  1. Prüfe `auto_select_condition` gegen form_data → wähle passende Variante
  2. Falls `selected_variant_id` übergeben → nutze diese stattdessen
  3. Fallback: `is_default=True` Variante der Gruppe
- `assemble_html_preview()` rendert die gewählte Varianten-Klausel statt der Basis-Klausel

### 2. Generation-Engine erweitern (generation.py)

- `GenerateDocumentRequest` bekommt optionales Feld: `selected_variants: list[SelectedVariant]`
- `generate_document_by_type()` lädt Varianten analog zur Preview-Logik
- Varianten-Klauseln werden in den DOCX-Export übernommen

### 3. Setup.py Seed-Data erweitern

- 10 bestehende Tarif-Klauseln werden in je einer Varianten-Gruppe als Variante 1 registriert
- 10 neue AT-Klauseln werden als Variante 2 angelegt
- 4 neue conditional Klauseln für AT-only Features
- 10 Varianten-Gruppen mit auto_select_condition
- 5 neue FormFields
- Verknüpfung aller Gruppen mit DocumentType "Arbeitsvertrag"

## Frontend-Änderungen

### 1. Formular (LeftControlPanel / WizardContext)

- Neues Select-Feld "Vertragsart" prominent oben im Formular
- Bei Wechsel der Vertragsart: Varianten-Vorauswahl automatisch aktualisiert
- Bedingte Felder (Zielbonus, Freistellung, Spesen) erscheinen nur bei AT

### 2. Preview (RightEditorPanel)

- VariantSelector.tsx ist bereits fertig gebaut (RadioGroup + Dropdown)
- Integration: Zeige VariantSelector bei Klauseln mit clause_type="variant"
- Dezentes Badge an Varianten-Klauseln ("Tarif" / "AT")
- Nutzer kann manuell zwischen Varianten wechseln

### 3. Kein neuer DocumentType

Es bleibt ein einziger "Arbeitsvertrag" — die Vertragsart wird über das Formularfeld gesteuert.

## KI-Integration

Die KI versteht die Verknüpfung automatisch:
- `ClauseVariant.description` erklärt, wann welche Variante passt
- `auto_select_condition` ist maschinenlesbar
- Der Ghostwriter sieht das Feld `vertragsart` im form_data-Kontext
- Der Brief-Assistent kann erklären, warum eine bestimmte Variante gewählt wurde
- AI Instructions können um AT-spezifische Hinweise erweitert werden

## Aufwandsschätzung

| Bereich | Geschätzter Aufwand |
|---------|-------------------|
| 10 AT-Klauseltexte schreiben | ~300 LOC (HTML-Content) |
| 4 neue AT-only Klauseln | ~100 LOC (HTML-Content) |
| Preview/Generation um Varianten erweitern | ~150 LOC Backend |
| Setup.py Seed-Data | ~300 LOC Backend |
| FormField "Vertragsart" + bedingte Felder | ~50 LOC Backend |
| VariantSelector Integration im Wizard | ~100 LOC Frontend |
| Varianten-Badge im Preview | ~50 LOC Frontend |
| **Gesamt** | **~1050 LOC, keine DB-Migration** |
