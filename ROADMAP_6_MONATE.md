# 6-Monats-Roadmap: Smart Document Generator
## UX-Verbesserungen & Competitive Parity

---

## Übersicht Timeline

```
        FEB 2026      MÄR 2026      APR 2026      MAI 2026      JUN 2026      JUL 2026
        ─────────────────────────────────────────────────────────────────────────────────
PHASE 1 ████████████
        Quick Wins

PHASE 2               ████████████████████████
                      Drag & Drop

PHASE 3                             ████████████████████████
                                    Conditional Logic

PHASE 4                                           ████████████████████████
                                                  E-Signatur

PHASE 5                                                         ████████████████████████
                                                                Collaboration & KI
```

---

## Phase 1: Quick Wins (Februar 2026)
### Dauer: 2 Wochen | Aufwand: ~40h | Impact: Hoch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE 1-2: SOFORTIGE UX-VERBESSERUNGEN                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 ZIEL: Bestehende Features besser sichtbar machen                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1.1 Smart Mode prominent auf /generate                     [3 Tage] │   │
│  │     • "✨ Mit KI erstellen" Button neben Wizard-Start               │   │
│  │     • Gradient-Styling für Aufmerksamkeit                           │   │
│  │     • Tooltip: "Beschreiben Sie einfach, was Sie brauchen"          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1.2 Klausel-Tooltips mit Vorschau                          [2 Tage] │   │
│  │     • Hover über Klausel zeigt ersten 200 Zeichen                   │   │
│  │     • "Mehr anzeigen" Link zur Vollansicht                          │   │
│  │     • Hilft bei Klausel-Auswahl im Wizard                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1.3 Settings-Suchfunktion                                  [3 Tage] │   │
│  │     • Command Palette (Cmd+K) für Einstellungen                     │   │
│  │     • Fuzzy Search über alle Settings-Tabs                          │   │
│  │     • Direkt-Navigation zu gefundener Einstellung                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1.4 Formular-Labels Kontrast erhöhen                       [1 Tag]  │   │
│  │     • WCAG AA Kontrast-Ratio sicherstellen                          │   │
│  │     • Labels von text-muted auf text-foreground                     │   │
│  │     • Pflichtfeld-Markierung (*) deutlicher                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1.5 "Empfohlene Klauseln" Badge                            [1 Tag]  │   │
│  │     • Standard-Klauseln mit ⭐ markieren                             │   │
│  │     • "Für diesen Vertragstyp empfohlen" Hinweis                    │   │
│  │     • Pre-Selection der empfohlenen Klauseln                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 ERWARTETE ERGEBNISSE:                                                   │
│     • Smart Mode Nutzung: +300%                                             │
│     • Klausel-Auswahl-Zeit: -40%                                            │
│     • Settings-Navigation: -50% Zeit                                        │
│     • Accessibility Score: 85 → 95                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Smart Mode Button auf /generate
- [ ] TooltipProvider für Klauseln
- [ ] CommandPalette für Settings
- [ ] CSS-Update für Label-Kontrast
- [ ] Recommended-Badge Komponente

---

## Phase 2: Drag & Drop Template Builder (März-April 2026)
### Dauer: 6 Wochen | Aufwand: ~150h | Impact: Sehr Hoch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE 3-8: VISUAL TEMPLATE BUILDER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 ZIEL: PandaDoc-ähnlicher Drag & Drop Editor                             │
│                                                                             │
│  MÄRZ: FOUNDATION                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2.1 @dnd-kit Integration                                   [1 Woche]│   │
│  │     • npm install @dnd-kit/core @dnd-kit/sortable                   │   │
│  │     • SortableList Komponente für Klauseln                          │   │
│  │     • DragOverlay für visuelles Feedback                            │   │
│  │     • Keyboard-Navigation (Accessibility)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2.2 Klausel-Reihenfolge per Drag & Drop                    [1 Woche]│   │
│  │     • In Wizard Step 4 (Klauseln)                                   │   │
│  │     • In DocumentTypeEditor (Template Builder)                      │   │
│  │     • Persistenz der Reihenfolge in DB                              │   │
│  │     • Undo/Redo Support                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  APRIL: ADVANCED FEATURES                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2.3 Visual Canvas Editor                                   [2 Wochen│   │
│  │     • Split-Screen: Links Toolbox, Rechts Canvas                    │   │
│  │     • Drag Klauseln von Toolbox auf Canvas                          │   │
│  │     • Snap-to-Grid Positionierung                                   │   │
│  │     • Resize-Handles für Sections                                   │   │
│  │                                                                     │   │
│  │     ┌──────────────┬─────────────────────────────────────┐         │   │
│  │     │  TOOLBOX     │           CANVAS                    │         │   │
│  │     │              │  ┌─────────────────────────────┐    │         │   │
│  │     │  📝 Klauseln │  │ § Einleitung               │    │         │   │
│  │     │  ├─ Arbeits. │  └─────────────────────────────┘    │         │   │
│  │     │  ├─ Vergüt.  │  ┌─────────────────────────────┐    │         │   │
│  │     │  └─ Urlaub   │  │ § Arbeitszeit              │    │         │   │
│  │     │              │  └─────────────────────────────┘    │         │   │
│  │     │  📋 Felder   │  ┌─────────────────────────────┐    │         │   │
│  │     │  ├─ Text     │  │ [Hier Klausel ablegen]     │    │         │   │
│  │     │  └─ Datum    │  └─────────────────────────────┘    │         │   │
│  │     └──────────────┴─────────────────────────────────────┘         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2.4 Live-Vorschau während Editing                          [1 Woche]│   │
│  │     • Rechte Spalte zeigt gerenderten Output                        │   │
│  │     • Debounced Updates (300ms)                                     │   │
│  │     • Syntax-Highlighting für Platzhalter                           │   │
│  │     • Print-Preview Mode                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 2.5 Template Sections & Grouping                           [1 Woche]│   │
│  │     • Klauseln in Sections gruppieren                               │   │
│  │     • Collapsible Sections                                          │   │
│  │     • Section-weises Aktivieren/Deaktivieren                        │   │
│  │     • Copy/Paste zwischen Templates                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 ERWARTETE ERGEBNISSE:                                                   │
│     • Template-Erstellung: -60% Zeit (17 → 7 Klicks)                        │
│     • User Satisfaction: +40%                                               │
│     • Feature Parity mit PandaDoc: 70%                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] @dnd-kit Sortable für Klauseln
- [ ] Visual Template Builder Page
- [ ] Canvas mit Drag & Drop
- [ ] Live-Preview Panel
- [ ] Section Grouping

**Technische Dependencies:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @dnd-kit/modifiers  # für Snap-to-Grid
```

---

## Phase 3: Conditional Logic Engine (April-Mai 2026)
### Dauer: 6 Wochen | Aufwand: ~160h | Impact: Sehr Hoch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE 9-14: WENN-DANN-LOGIK FÜR KLAUSELN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 ZIEL: Conga-ähnliche bedingte Klausel-Steuerung                         │
│                                                                             │
│  APRIL: BACKEND & DATENMODELL                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3.1 Erweitertes Condition Schema                           [1 Woche]│   │
│  │                                                                     │   │
│  │     // Aktuell (einfach):                                          │   │
│  │     show_condition: { clause_id: 5 }                               │   │
│  │                                                                     │   │
│  │     // Neu (komplex):                                              │   │
│  │     show_condition: {                                              │   │
│  │       type: "AND" | "OR",                                          │   │
│  │       conditions: [                                                │   │
│  │         { field: "employment_type", op: "=", value: "fulltime" },  │   │
│  │         { field: "salary", op: ">", value: 50000 },                │   │
│  │         { clause_enabled: "probation_clause" },                    │   │
│  │         { variant_selected: "standard_hours" }                     │   │
│  │       ]                                                            │   │
│  │     }                                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3.2 Condition Evaluator Service                            [1 Woche]│   │
│  │     • evaluateCondition(condition, context) → boolean               │   │
│  │     • Support für nested AND/OR                                     │   │
│  │     • Operatoren: =, !=, >, <, >=, <=, contains, startsWith        │   │
│  │     • Null-Safety und Typ-Coercion                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MAI: FRONTEND UI                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3.3 Condition Builder UI                                   [2 Wochen│   │
│  │                                                                     │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  Klausel anzeigen wenn:                                 │    │   │
│  │     │  ┌─────────────────────────────────────────────────────┐│    │   │
│  │     │  │ [Feld: Beschäftigungsart ▼] [ist gleich ▼] [Vollzeit]││   │   │
│  │     │  └─────────────────────────────────────────────────────┘│    │   │
│  │     │                         UND                             │    │   │
│  │     │  ┌─────────────────────────────────────────────────────┐│    │   │
│  │     │  │ [Feld: Gehalt ▼] [ist größer als ▼] [50000]        ││    │   │
│  │     │  └─────────────────────────────────────────────────────┘│    │   │
│  │     │                                                         │    │   │
│  │     │  [+ Weitere Bedingung]  [+ Gruppe hinzufügen]           │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3.4 Auto-Save & Draft-Recovery                             [1 Woche]│   │
│  │     • Auto-Save alle 30 Sekunden                                    │   │
│  │     • LocalStorage Fallback bei Netzwerk-Fehler                     │   │
│  │     • "Entwurf wiederherstellen?" Dialog                            │   │
│  │     • Optimistic UI Updates                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3.5 Condition Testing & Preview                            [1 Woche]│   │
│  │     • "Bedingung testen" Button                                     │   │
│  │     • Simulations-Mode mit Test-Daten                               │   │
│  │     • Visuelles Highlighting welche Klauseln aktiv                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 ERWARTETE ERGEBNISSE:                                                   │
│     • Manuelle Varianten-Pflege: -80%                                       │
│     • Dokumenten-Konsistenz: +50%                                           │
│     • Feature Parity mit Conga: 60%                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Erweitertes JSON Schema für Conditions
- [ ] ConditionEvaluator Service
- [ ] ConditionBuilder UI Komponente
- [ ] Auto-Save mit LocalStorage Fallback
- [ ] Test/Preview Mode

---

## Phase 4: E-Signatur Integration (Mai-Juni 2026)
### Dauer: 6 Wochen | Aufwand: ~180h | Impact: Kritisch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE 15-20: DIGITALE UNTERSCHRIFT                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 ZIEL: Verträge ohne externe Tools signieren                             │
│                                                                             │
│  MAI: API INTEGRATION                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4.1 Provider-Auswahl & Setup                               [1 Woche]│   │
│  │                                                                     │   │
│  │     Option A: DocuSign eSignature API                              │   │
│  │     ├─ Pro: Marktführer, 1 Mrd+ Signaturen                         │   │
│  │     ├─ Pro: eIDAS, UETA, ESIGN compliant                           │   │
│  │     └─ Con: Teuer ($25/User/Monat)                                 │   │
│  │                                                                     │   │
│  │     Option B: Adobe Sign API                                       │   │
│  │     ├─ Pro: Adobe Ecosystem Integration                            │   │
│  │     └─ Con: Komplexere API                                         │   │
│  │                                                                     │   │
│  │     Option C: SignNow (Budget)                                     │   │
│  │     ├─ Pro: Günstig ($8/User/Monat)                                │   │
│  │     └─ Con: Weniger Features                                       │   │
│  │                                                                     │   │
│  │     EMPFEHLUNG: DocuSign (Enterprise) oder SignNow (SMB)           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4.2 Backend Integration                                    [2 Wochen│   │
│  │     • OAuth2 Flow für Provider-Auth                                 │   │
│  │     • Envelope Creation API                                         │   │
│  │     • Webhook Handler für Status-Updates                            │   │
│  │     • Document Storage (signierte PDFs)                             │   │
│  │                                                                     │   │
│  │     Endpoints:                                                     │   │
│  │     POST /api/v1/documents/{id}/send-for-signature                 │   │
│  │     GET  /api/v1/documents/{id}/signature-status                   │   │
│  │     POST /api/v1/webhooks/signature-completed                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  JUNI: FRONTEND UX                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4.3 Signatur-Flow UI                                       [2 Wochen│   │
│  │                                                                     │   │
│  │     SCHRITT 1: Unterzeichner hinzufügen                            │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  Wer soll unterschreiben?                               │    │   │
│  │     │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │     │  │ 👤 Max Mustermann (Mitarbeiter)                   │  │    │   │
│  │     │  │    max.mustermann@firma.de                        │  │    │   │
│  │     │  └───────────────────────────────────────────────────┘  │    │   │
│  │     │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │     │  │ 👤 HR Manager                                     │  │    │   │
│  │     │  │    hr@niederwieser.com                            │  │    │   │
│  │     │  └───────────────────────────────────────────────────┘  │    │   │
│  │     │  [+ Weiteren Unterzeichner hinzufügen]                  │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  │                                                                     │   │
│  │     SCHRITT 2: Signatur-Felder platzieren                          │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  [PDF-Vorschau mit Drag & Drop Signatur-Feldern]        │    │   │
│  │     │                                                         │    │   │
│  │     │  ┌─────────────────────────────────┐                    │    │   │
│  │     │  │                                 │                    │    │   │
│  │     │  │    Arbeitsvertrag               │                    │    │   │
│  │     │  │    ...                          │                    │    │   │
│  │     │  │                                 │                    │    │   │
│  │     │  │    ┌──────────────┐             │                    │    │   │
│  │     │  │    │ ✍️ Signatur  │ ← Drag here │                    │    │   │
│  │     │  │    │ Mitarbeiter  │             │                    │    │   │
│  │     │  │    └──────────────┘             │                    │    │   │
│  │     │  └─────────────────────────────────┘                    │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 4.4 Status-Tracking Dashboard                              [1 Woche]│   │
│  │     • "Zur Unterschrift gesendet" Status                            │   │
│  │     • "Teilweise unterschrieben" (1/2)                              │   │
│  │     • "Vollständig unterschrieben" ✅                                │   │
│  │     • Reminder-Funktion für ausstehende Signaturen                  │   │
│  │     • Audit-Trail mit Timestamps                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 ERWARTETE ERGEBNISSE:                                                   │
│     • Time-to-Signature: Tage → Stunden                                     │
│     • Papier-Reduktion: 100%                                                │
│     • Rechtskonformität: eIDAS/UETA compliant                               │
│     • Feature Parity mit DocuSign: 50%                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] E-Signatur Provider Integration
- [ ] Unterzeichner-Management UI
- [ ] Signatur-Feld Platzierung (Drag & Drop)
- [ ] Status-Tracking Dashboard
- [ ] Webhook Handler für Completion

**Kosten-Schätzung:**
| Provider | Preis/Monat | Setup |
|----------|-------------|-------|
| DocuSign Business | €40/User | 1 Woche |
| SignNow | €15/User | 3 Tage |
| Adobe Sign | €30/User | 1 Woche |

---

## Phase 5: Real-Time Collaboration & KI (Juni-Juli 2026)
### Dauer: 6 Wochen | Aufwand: ~200h | Impact: Hoch

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WOCHE 21-26: KOLLABORATION & INTELLIGENZ                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 ZIEL: Google Docs-ähnliche Zusammenarbeit + KI-Unterstützung            │
│                                                                             │
│  JUNI: REAL-TIME SYNC                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5.1 Yjs CRDT Integration                                   [2 Wochen│   │
│  │     • Yjs für konfliktfreie Sync                                    │   │
│  │     • WebSocket Provider (y-websocket)                              │   │
│  │     • Awareness API für Cursor-Präsenz                              │   │
│  │                                                                     │   │
│  │     npm install yjs y-websocket y-prosemirror                      │   │
│  │                                                                     │   │
│  │     Features:                                                      │   │
│  │     • Mehrere User editieren gleichzeitig                          │   │
│  │     • Farbige Cursor mit Namen                                     │   │
│  │     • Offline-Support mit Auto-Sync                                │   │
│  │     • Konflikt-Auflösung automatisch                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5.2 Cursor-Presence & User-Awareness                       [1 Woche]│   │
│  │                                                                     │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  📄 Arbeitsvertrag - Max Mustermann                     │    │   │
│  │     │  ┌─────────────────────────────────────────────────┐    │    │   │
│  │     │  │                                                 │    │    │   │
│  │     │  │  Der Arbeitnehmer verpflic|                    │    │    │   │
│  │     │  │                           ▲                     │    │    │   │
│  │     │  │                      [Maria HR]                 │    │    │   │
│  │     │  │                                                 │    │    │   │
│  │     │  │  Diese Verpflichtung gi|t auch nach...         │    │    │   │
│  │     │  │                        ▲                        │    │    │   │
│  │     │  │                   [Thomas Legal]                │    │    │   │
│  │     │  └─────────────────────────────────────────────────┘    │    │   │
│  │     │                                                         │    │   │
│  │     │  👥 Aktive Bearbeiter: Maria (HR), Thomas (Legal)       │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  JULI: KI-FEATURES                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5.3 KI-Klausel-Vorschläge                                  [2 Wochen│   │
│  │     • Basierend auf Dokumenttyp & Kontext                           │   │
│  │     • "Diese Klausel könnte relevant sein" Suggestions              │   │
│  │     • Ein-Klick-Einfügen                                            │   │
│  │                                                                     │   │
│  │     Prompt-Engineering für:                                        │   │
│  │     • Vollzeit-Vertrag → Urlaubsklausel empfehlen                  │   │
│  │     • Führungsposition → Wettbewerbsverbot vorschlagen             │   │
│  │     • IT-Bereich → Geheimhaltung priorisieren                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5.4 Risk Scoring & Compliance Check                        [1 Woche]│   │
│  │     • Automatische Prüfung auf fehlende Pflichtklauseln             │   │
│  │     • Warnung bei widersprüchlichen Klauseln                        │   │
│  │     • Compliance-Score (0-100%)                                     │   │
│  │     • Rechtliche Hinweise (nicht Rechtsberatung!)                   │   │
│  │                                                                     │   │
│  │     ┌─────────────────────────────────────────────────────────┐    │   │
│  │     │  ⚠️ Compliance-Check                                    │    │   │
│  │     │  ┌───────────────────────────────────────────────────┐  │    │   │
│  │     │  │ Score: 85/100                          [███████░░]│  │    │   │
│  │     │  └───────────────────────────────────────────────────┘  │    │   │
│  │     │  ⚠️ Fehlend: Datenschutz-Klausel (DSGVO)                │    │   │
│  │     │  ✅ Vorhanden: Kündigungsfrist konform                  │    │   │
│  │     │  ✅ Vorhanden: Arbeitszeit im Rahmen                    │    │   │
│  │     └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  📊 ERWARTETE ERGEBNISSE:                                                   │
│     • Team-Produktivität: +60%                                              │
│     • Dokument-Konsistenz: +40%                                             │
│     • Compliance-Fehler: -70%                                               │
│     • Feature Parity mit Marktführern: 85%                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Deliverables:**
- [ ] Yjs CRDT Backend
- [ ] WebSocket Server
- [ ] Cursor Presence UI
- [ ] KI-Klausel-Suggestions
- [ ] Compliance Risk Scoring

---

## Ressourcen-Planung

### Team-Anforderungen

```
┌────────────────────────────────────────────────────────────────────────────┐
│  RESSOURCEN PRO PHASE                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Phase 1 (Quick Wins):        1 Frontend-Dev              40h             │
│  Phase 2 (Drag & Drop):       1 Frontend-Dev, 0.5 Backend 150h            │
│  Phase 3 (Conditional):       1 Full-Stack Dev            160h            │
│  Phase 4 (E-Signatur):        1 Backend, 1 Frontend       180h            │
│  Phase 5 (Collab + KI):       2 Full-Stack, 1 DevOps      200h            │
│  ─────────────────────────────────────────────────────────────────────    │
│  TOTAL:                       ~730 Entwicklerstunden                      │
│                               = ~4.5 Entwickler-Monate                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Budget-Schätzung

| Posten | Kosten |
|--------|--------|
| Entwicklung (730h × €80/h) | €58.400 |
| E-Signatur API (DocuSign, 10 User, 6 Monate) | €2.400 |
| WebSocket Server (Hosting) | €300 |
| KI API (OpenAI/Claude) | €500 |
| **TOTAL** | **~€61.600** |

---

## Erfolgsmetriken

### KPIs nach 6 Monaten

| Metrik | Aktuell | Ziel | Messmethode |
|--------|---------|------|-------------|
| Time-to-First-Contract | 7 min | 3 min | Analytics |
| Klicks pro Vertrag | 17 | 8 | Event Tracking |
| User Satisfaction (NPS) | - | 50+ | Survey |
| Feature Adoption (Smart Mode) | 5% | 40% | Usage Stats |
| Signatur-Completion-Rate | 0% | 80% | E-Sign Provider |
| Monthly Active Users | - | +50% | Auth Logs |

### Meilenstein-Review-Termine

```
📅 28.02.2026 - Phase 1 Review (Quick Wins)
📅 15.04.2026 - Phase 2 Review (Drag & Drop)
📅 31.05.2026 - Phase 3 Review (Conditional Logic)
📅 30.06.2026 - Phase 4 Review (E-Signatur)
📅 31.07.2026 - Phase 5 Review (Collaboration) + Final Audit
```

---

## Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| E-Signatur API-Kosten höher als erwartet | Mittel | Mittel | Budget-Puffer 20% |
| Yjs Learning Curve | Hoch | Niedrig | 1 Woche Prototyping |
| DocuSign Approval dauert | Mittel | Hoch | Parallel SignNow evaluieren |
| Team-Kapazität | Mittel | Hoch | Externe Unterstützung einplanen |

---

*Roadmap erstellt: 01.02.2026*
*Nächstes Update: Nach Phase 1 Completion*
