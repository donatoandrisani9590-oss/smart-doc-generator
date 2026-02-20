# UX Workflow Redesign: Tonalität, Dokumenten-Bibliothek, Editor & Freigabe

**Datum:** 2026-02-20
**Ansatz:** A — Evolutionary Upgrade (bestehende Seiten erweitern)
**Status:** Genehmigt

---

## 1. Tonalität-Karten mit Live-Preview

### Ersetzt: `ToneSlider.tsx` (5-Punkt-Slider)

**Neue Komponente: `ToneCards.tsx`**

5 klickbare Karten mit Icon, Titel und Kurzbeschreibung:
- Formal (Juristisch exakt, sachlich)
- Professionell (Klar und höflich, Standard)
- Warm-professionell (Wertschätzend, willkommen)
- Persönlich (Warme Ansprache, menschliche Nähe)
- Empathisch (Einfühlsam, sensible Themen)

**Live-Preview-System:**
1. Nutzer klickt auf neue Tonalität
2. Bestehender `/smart/refine/stream` Endpoint wird aufgerufen mit passendem Preset
3. Text im Editor wird per SSE gestreamt umgeschrieben
4. Preview-Banner erscheint: "Vorschau aktiv: [Tonname]"
5. Zwei Buttons: "Übernehmen" (setzt neue Version) und "Original wiederherstellen"
6. Undo-Stack speichert letzte 3 Versionen in `useRef`

**Technisch:**
- Nutzt bestehenden `/smart/refine/stream` Endpoint
- Bestehende `api-stream.ts` SSE-Utility
- Gleiche Props wie ToneSlider (`value`, `onChange`) + WizardContext-Integration
- Aktive Karte: `border-primary` + `bg-primary/5` + Scale
- Inaktive: `border-warm-200` + Hover

---

## 2. Meine Dokumente — Erweiterte Filter + Quick-Actions

### 2a) Filter-Leiste (Repository.tsx)

**Neuer Tab:** "Freigabe offen" — Zeigt Dokumente mit `pending_approval` Status
**Filter immer sichtbar:** Typ-Dropdown, Zeitraum, Suche — nicht hinter "Erweiterte Filter" versteckt
**Persistente Filter:** Letzte Filtereinstellung in `localStorage`

### 2b) Quick-Actions pro Dokument-Zeile

Bei Hover erscheinen 3 Buttons:

1. **"Status ändern"** (Dropdown/Popover):
   - Versendet markieren
   - Wiedervorlage setzen (mit Datepicker)
   - Abschließen
   - Notiz hinzufügen

2. **"Zur Freigabe senden"** (blauer Button):
   - Öffnet Freigabe-Dialog (Approver, Priorität, Kommentar)

3. **"Download"** — Direkter Download

Quick-Actions ergänzen den Zeilen-Klick (navigiert weiterhin zur Detail-Ansicht).

---

## 3. Editor — Immer vollständiges Dokument mit Logo

### Permanente Briefkopf-Vorschau

Der Editor im Wizard zeigt immer das komplette Dokument:

- **Header-Zone** (nicht editierbar): Logo, Firmenname, Adresse
- **Content-Zone** (TinyMCE editierbar): Dokumentinhalt
- **Footer-Zone** (nicht editierbar): Firmendaten, Bankverbindung, Geschäftsführer

**Datenquelle für Header/Footer:**
1. Primär: Gewähltes Briefpapier via `GET /user-templates/{id}/zones`
2. Fallback: `DesignSettings` aus Company-Settings

**Technisch:**
- Header/Footer als statische HTML-Blöcke über/unter dem TinyMCE-Editor
- A4-Proportionen (210mm × 297mm scaled) mit Schatten
- Gleiche Ansicht für Freigeber (Read-Only-Modus)

---

## 4. Prominenter Freigabe-Workflow

### 4a) Im Generierungsbereich (Wizard)

Nach Dokumentgenerierung: Success-Banner mit gleichwertigen Buttons:
- **"Herunterladen"** (sekundär)
- **"Zur Freigabe senden"** (primär, blau)
- Links: "Neues Dokument", "In Bibliothek öffnen"

### 4b) In der Detail-Ansicht (DocumentDetail.tsx)

**Status-Banner + Aktionen direkt oben** (nicht im "Verwaltung"-Tab versteckt):
- **"Zur Freigabe senden"** als primärer blauer Button
- **"Als versendet markieren"** als sekundärer Button
- Weitere: Wiedervorlage, Notiz, Abschließen als kleinere Buttons

### 4c) Freigeber-Ansicht

Wenn Freigeber Dokument öffnet:
- Freigabe-Info-Banner oben: Anfrager, Zeitpunkt, Priorität
- 3 Action-Buttons: Freigeben (grün), Änderungen anfordern (orange), Ablehnen (rot)
- **Vollständiges Dokument** im Read-Only-Modus mit Logo

### 4d) Kommentar-System (Google-Docs-Stil)

- Freigeber markiert Text → Popover: "Kommentar hinzufügen"
- Kommentar als Karte in **rechter Seitenleiste**
- **Verbindungslinie** zwischen markiertem Text und Kommentar-Karte
- Markierter Text: **gelbe Hintergrundfarbe**
- Kommentar-Karten: Textstelle, Kommentar, Autor, Zeitstempel
- Thread-basierte Antworten
- "Lösen" (Resolve) markiert Kommentar als erledigt

**Nutzt bestehendes Backend:** `Comment`-Modell mit `selection_range`, `parent_id` (Threads), `is_resolved`

---

## 5. End-to-End Workflow

```
Ersteller                               Freigeber
  │                                        │
  ├─ 1. Dokument erstellen (Wizard)        │
  │   → Volles Dokument mit Logo sichtbar  │
  │   → Tonalität wählen mit Live-Preview  │
  │                                        │
  ├─ 2. Generieren → Success-Banner        │
  │   → [Download] [Zur Freigabe senden]   │
  │                                        │
  ├─ 3. "Zur Freigabe senden" ────────────→ Benachrichtigung (SSE)
  │                                        │
  │   Status: Freigabe offen               ├─ 4. Dokument öffnen
  │                                        │   → Volles Dokument sichtbar
  │                                        │   → Kommentare an Textstellen
  │                                        │
  │                                        ├─ 5a. Freigeben → Status: Freigegeben
  │   ← Benachrichtigung ─────────────────┤
  │                                        ├─ 5b. Änderungen anfordern
  │   ← Benachrichtigung + Kommentare ────┤
  │                                        │
  ├─ 6. Änderungen vornehmen              │
  │   → Kommentare sehen + lösen          │
  │                                        │
  ├─ 7. "Erneut einreichen" ──────────────→ Erneut prüfen
  │                                        │
  ├─ ODER: In "Meine Dokumente"           │
  │   → Quick-Action: Status ändern        │
  │   → Quick-Action: Zur Freigabe         │
  │   → Detail: Alles verwalten            │
```

**UX-Prinzipien:**
1. Kein Sackgassen-Gefühl — von überall Freigabe anstoßbar
2. Voller Kontext — Freigeber sieht immer komplettes Dokument
3. Bidirektionale Kommunikation — Kommentare wie Google Docs
4. Status immer sichtbar — Farbcodierte Badges überall
5. Minimal Clicks — Quick-Actions reduzieren Umwege

---

## Betroffene Dateien

### Neue Dateien
- `frontend/src/components/generator/ToneCards.tsx` (ersetzt ToneSlider.tsx)
- `frontend/src/components/documents/InlineCommentSidebar.tsx` (Google-Docs-Kommentare)
- `frontend/src/components/documents/QuickStatusDropdown.tsx` (Quick-Action in Liste)
- `frontend/src/components/documents/ApprovalActionBar.tsx` (prominente Freigabe-Buttons)
- `frontend/src/components/editor/FullDocumentPreview.tsx` (Header/Footer-Wrapper für Editor)

### Geänderte Dateien
- `frontend/src/pages/Repository.tsx` (Filter, Quick-Actions, neuer Tab)
- `frontend/src/pages/DocumentDetail.tsx` (prominente Status/Freigabe-Buttons oben)
- `frontend/src/components/generator/editor/RightEditorPanel.tsx` (FullDocumentPreview-Wrapper)
- `frontend/src/components/generator/panels/LeftControlPanel.tsx` (ToneCards statt ToneSlider)
- `frontend/src/components/editor/DocumentEditor.tsx` (A4-Wrapper mit Header/Footer)
- `frontend/src/components/documents/DocumentApprovalPanel.tsx` (Freigeber-Kommentar-Integration)

### Backend (minimal)
- Keine neuen Endpoints nötig — alles existiert bereits
- Ggf. `DesignSettings`-Endpoint erweitern für Header/Footer-HTML-Daten
