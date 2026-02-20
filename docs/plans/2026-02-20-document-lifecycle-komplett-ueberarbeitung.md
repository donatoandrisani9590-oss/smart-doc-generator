# Document Lifecycle Management — Komplett-Überarbeitung

**Erstellt:** 2026-02-20
**Status:** Genehmigt, bereit zur Implementierung

## Context

Die aktuelle "Meine Dokumente"-Seite ist unübersichtlich und unlogisch aufgebaut. Status-Karten im Repository existieren (Ohne Versand, Rücksendung ausstehend, etc.), aber beim Erstellen/Bearbeiten eines Dokuments fehlt ein klarer Workflow, um diese Zustände zu setzen. Es gibt keine intuitive Möglichkeit, den Versand, die Rücksendung, Wiedervorlagen oder Freigaben zu verwalten.

**Überraschende Erkenntnis:** Das Backend hat bereits umfangreiche Infrastruktur (DocumentAction Event-Log mit 11 Typen, DocumentApproval State Machine, Notifications mit SSE, Document Locking, Guest Review, Versioning). Das Problem ist dreifach: (1) die UX macht diese Features nicht zugänglich, (2) der `workflow_status` (erstellt/in_bearbeitung/abgeschlossen) ist zu grob für ein Kanban, (3) es fehlen Automatisierungen (E-Mail, Deadline-Enforcement, Eskalation).

**Ziel:** Kanban-Board als Hauptansicht, flexible Pipeline (Stages können übersprungen werden), klare Post-Export-Aktionen im Generator, Comment-basierte Freigabe, E-Mail-Benachrichtigungen und automatische Deadline-Überwachung.

### Kernentscheidungen des Users

1. **Komplett-Überarbeitung** — UX-Redesign UND Backend-Erweiterungen UND Automatisierungen
2. **Kanban als Standard** — Board-Ansicht ist Standard, Listen-Ansicht optional (Toggle)
3. **Flexible Pipeline** — Stages können übersprungen werden (ein einfaches Schreiben kann direkt von "Erstellt" zu "Abgeschlossen" gehen)
4. **Comment-basierter Review** — Genehmigender nutzt Inline-Kommentare (nicht Track Changes)

---

## Deployment 1: Backend Pipeline-Status-Modell

### Neue `pipeline_stage` Spalte auf GeneratedDocument

**Datei:** `backend/app/models/enterprise.py`

Neues Feld neben dem bestehenden `workflow_status` (für Backward-Compatibility):

```python
pipeline_stage = Column(String(30), default="entwurf", nullable=False, index=True)
```

| Stage | Label | Beschreibung | Farbe |
|-------|-------|--------------|-------|
| `entwurf` | Entwurf | Neu erstellt, noch nicht versendet/freigegeben | Amber |
| `freigabe` | Freigabe | Zur Genehmigung gesendet, wartet auf Entscheidung | Purple |
| `versendet` | Versendet | Exportiert und verschickt | Blue |
| `ruecklauf` | Rücklauf | Versendet, wartet auf unterschriebene Rücksendung | Orange |
| `abgeschlossen` | Abgeschlossen | Workflow komplett | Green |
| `archiv` | Archiv | Archiviert zur Aufbewahrung | Warm-400 |

### Ableitung aus Events (Event-Sourcing)

**Datei:** `backend/app/api/v1/endpoints/documents/document_actions.py` — `recalculate_document_lifecycle()`

Prioritäts-Logik (höchste zuerst):
1. `is_archived` → `archiv`
2. Letzte Aktion `completed` oder `returned` → `abgeschlossen`
3. Offene `return_pending` Aktion → `ruecklauf`
4. `sent` Aktion vorhanden (keine return_pending/completed danach) → `versendet`
5. Offene `approval_requested` → `freigabe`
6. Sonst → `entwurf`

### Neue API-Endpoints

**Datei:** `backend/app/api/v1/endpoints/documents/repository.py`

- `GET /repository/kanban` — Dokumente gruppiert nach `pipeline_stage`, pro Spalte paginiert (erste 20)
- `PATCH /repository/{document_id}/stage` — Drag-and-Drop Stage-Wechsel, erzeugt DocumentAction Event

**Flexible Transitions (keine erzwungene Reihenfolge):**
- `entwurf` → jeder Stage außer `archiv`
- `freigabe` → `entwurf` (abgelehnt), `versendet`, `abgeschlossen`
- `versendet` → `ruecklauf`, `abgeschlossen`
- `ruecklauf` → `abgeschlossen`, `versendet` (erneut versendet)
- `abgeschlossen` → `archiv`
- `archiv` → `abgeschlossen` (Entarchivieren)

### Migration

**Neue Datei:** `backend/migrations/versions/NNN_add_pipeline_stage.py`
- Spalte + Index hinzufügen
- Datenmigration: Für jedes bestehende Dokument `pipeline_stage` aus DocumentAction-Historie ableiten

---

## Deployment 2: Kanban-Board Frontend

### Komponenten

| Neue Datei | Beschreibung |
|-----------|-------------|
| `frontend/src/components/documents/KanbanBoard.tsx` | Board mit 6 Spalten, `@dnd-kit/core` für Drag-and-Drop |
| `frontend/src/components/documents/KanbanColumn.tsx` | Spalte mit Header (Icon + Label + Count), Droppable Area, "Mehr laden" |
| `frontend/src/components/documents/KanbanCard.tsx` | Karte: Titel, Mitarbeitername, Typ-Badge, Alter, Fälligkeits-Indikator |
| `frontend/src/hooks/api/useKanbanQueries.ts` | TanStack Query Hooks: `useKanbanBoard()`, `useMoveDocument()` |

### KanbanCard Design

```
┌──────────────────────────────────┐
│ [Arbeitsvertrag]  [🔴 überfällig]│
│ Max Mustermann                    │
│ vor 3 Tagen                       │
│ [🕐] Rücklauf bis: 15.03.2026    │
└──────────────────────────────────┘
```

- Linker Rand: Dokumenttyp-Farbe (bestehende `DOC_TYPE_COLORS`)
- Status-Indikatoren: Rot = überfällig, Purple = Freigabe ausstehend, Amber = Rücklauf ausstehend

### Drag-and-Drop Dialoge

- Drop auf "Versendet" → Dialog: "Wann versendet?" (Datum, Versandart, Empfänger)
- Drop auf "Rücklauf" → Dialog: "Rücklauffrist?" (Datum-Picker, Standard: +14 Tage)
- Drop auf "Abgeschlossen" → Bestätigungsdialog
- Drop auf "Archiv" → Bestätigungsdialog

### Repository.tsx Integration

**Datei:** `frontend/src/pages/Repository.tsx`

- View-Toggle oben rechts (Kanban | Liste), in `localStorage` gespeichert
- Standard: Kanban
- Gemeinsame Filter-Leiste für beide Ansichten
- Archiv-Spalte standardmäßig eingeklappt

### Dependency

```
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## Deployment 3: Generator-Aktionen Überarbeitung

### ActionBar Redesign

**Datei:** `frontend/src/components/generator/panels/ActionBar.tsx`

Neues Layout — vertikaler Stack mit klar getrennten Bereichen:

```
┌──────────────────────────────────┐
│ [Auto-Save Indikator]            │
│ [Validierungs-Fortschritt]       │
│                                  │
│ [Speichern]  [Exportieren ▼]     │
│               PDF / DOCX / Druck │
│                                  │
│ ── Nach dem Export ──────────── │
│ [📧] Als versendet markieren     │
│ [🕐] Wiedervorlage setzen        │
│ [🛡] Zur Freigabe senden         │
│ [✓] Abschließen                  │
└──────────────────────────────────┘
```

"Nach dem Export"-Bereich erscheint nur nach erstem erfolgreichen Export (nutzt bestehendes `lastExportedDocumentId` aus WizardContext).

### PostExportActions Komponente

**Neue Datei:** `frontend/src/components/generator/panels/PostExportActions.tsx`

- **"Als versendet markieren"**: `POST /documents/{id}/actions` mit `action_type: "sent"`, optionaler Mini-Dialog für Versandart (Post/E-Mail/Bote) und Empfänger
- **"Wiedervorlage setzen"**: Datum-Picker-Popover (Standard: +14 Tage), `action_type: "reminder_set"` + `due_date`
- **"Zur Freigabe senden"**: Öffnet ApprovalRequestDialog (User-Picker + Priorität + Kommentar)
- **"Abschließen"**: Direkt `action_type: "completed"`

### ExportSuccessModal Erweiterung

**Datei:** `frontend/src/components/generator/ExportSuccessModal.tsx`

PostExportActions auch im Erfolgs-Modal inline anzeigen, damit der User sofort seine Optionen sieht.

### WorkflowStepper Dual-Mode

**Datei:** `frontend/src/components/generator/WorkflowStepper.tsx`

- **Pre-Export**: Formular-Fortschritt (Entwurf → Inhalte → Prüfung → Export) — wie bisher
- **Post-Export**: Lifecycle-Fortschritt (Entwurf → Freigabe → Versendet → Abgeschlossen)

---

## Deployment 4: Freigabe-Workflow Erweiterung

### Comment-basierter Review

**Datei:** `frontend/src/pages/DocumentDetail.tsx`

Wenn ein Genehmigender "Änderungen anfordern" klickt:
1. Automatisch zum Kommentare-Tab wechseln
2. Guidance-Banner: "Bitte markieren Sie die relevanten Textstellen und fügen Sie Kommentare hinzu."
3. "Änderungen anfordern" Button erst aktivieren, wenn mindestens ein neuer ungelöster Kommentar existiert

### Genehmigungsgruppen

**Neue Datei:** `backend/app/models/approval_groups.py`

```python
class ApprovalGroup(Base):
    id, name, description, country_code, is_active

class ApprovalGroupMember(Base):
    id, group_id, user_id, is_primary
```

**Datei:** `backend/app/api/v1/endpoints/documents/approvals.py`

`RequestApprovalInput` akzeptiert entweder `approver_id` (Einzelperson) oder `approval_group_id` (Gruppe). Bei Gruppe: Benachrichtigung an alle Mitglieder, erster Reagierender übernimmt.

**Migration:** `backend/migrations/versions/NNN_add_approval_groups.py`

### Eskalations-Service

**Neue Datei:** `backend/app/services/escalation_service.py`

- Genehmigung nicht innerhalb `due_date` beantwortet → Erinnerung an Genehmigenden
- `due_date` + 2 Tage ohne Aktion → Benachrichtigung an Gruppenadmin/Vorgesetzten
- Erzeugt `DocumentAction` Event `escalated`

### Frontend Gruppen-Auswahl

**Datei:** `frontend/src/components/documents/DocumentApprovalPanel.tsx`

Dropdown zeigt sowohl einzelne User als auch Genehmigungsgruppen (mit Gruppen-Icon und Mitglieder-Anzahl).

---

## Deployment 5: Benachrichtigungen und Automatisierung

### E-Mail-Templates

**Neue Datei:** `backend/app/services/email_templates.py`

| Template | Betreff |
|----------|---------|
| `approval_requested` | "Genehmigung erforderlich: {doc_title}" |
| `approval_decided` | "Ihr Dokument wurde {genehmigt/abgelehnt}: {doc_title}" |
| `reminder_due` | "Wiedervorlage fällig: {doc_title}" |
| `return_overdue` | "Rücksendung überfällig: {doc_title} (Frist: {date})" |
| `escalation` | "Eskalation: Genehmigung überfällig für {doc_title}" |

Jedes Template respektiert `NotificationPreference.email_enabled` und `email_digest`.

### E-Mail-Trigger in DocumentActions

**Datei:** `backend/app/api/v1/endpoints/documents/document_actions.py`

Nach Erstellung einer DocumentAction: E-Mail basierend auf `action_type` auslösen (fire-and-forget via `asyncio.create_task()`).

### Background Scheduler

**Neue Datei:** `backend/app/services/scheduler.py`

APScheduler (AsyncIO, in-process — kein separater Worker nötig):

Alle 15 Minuten scannen:
1. Überfällige Wiedervorlagen (`reminder_set` + `due_date` < jetzt + nicht completed)
2. Überfällige Rücksendungen (`return_pending` + `due_date` < jetzt)
3. Überfällige Genehmigungen (`approval.due_date` < jetzt + noch `pending_approval`)
4. Ablaufende Aufbewahrungsfristen (`retention_date` innerhalb 30 Tage)

Für jedes: Notification + E-Mail erstellen.

**Datei:** `backend/app/main.py` — Scheduler bei App-Start starten.

### Erweiterte Action-Summary

**Datei:** `backend/app/api/v1/endpoints/documents/repository.py`

Zusätzliche Zähler: `ruecksendung_ueberfaellig`, `freigabe_ueberfaellig`

---

## Deployment 6: Listen-Ansicht Verbesserung

### Pipeline-Stage-Badges

**Datei:** `frontend/src/pages/Repository.tsx`

Bisherige binäre "Entwurf"/"Fertig" Badges ersetzen durch `PipelineStageBadge`:

| Stage | Farbe | Icon |
|-------|-------|------|
| entwurf | Amber | Edit3 |
| freigabe | Purple | ShieldCheck |
| versendet | Blue | Send |
| ruecklauf | Orange | RotateCcw |
| abgeschlossen | Green | CheckCircle |
| archiv | Warm-400 | Archive |

### Handlungsbedarf-Indikatoren

Rote/Amber/Purple Punkte an Zeilen mit:
- Überfällige Wiedervorlagen (rot)
- Ausstehende Genehmigungen (purple)
- Ausstehende Rücksendungen (amber)

### Erweiterter QuickStatusDropdown

**Datei:** `frontend/src/components/documents/QuickStatusDropdown.tsx`

Zusätzliche Schnellaktionen:
- "Zur Freigabe senden" (→ freigabe)
- "Als versendet markieren" mit Details-Dialog
- "Rücksendung erwartet" mit Frist
- "Abschließen"
- "Archivieren"

---

## Technische Entscheidungen

1. **`pipeline_stage` neben `workflow_status`** statt Ersatz — Backward-Compatibility, schrittweise Migration
2. **`@dnd-kit/core`** statt `react-beautiful-dnd` — React 19 kompatibel, aktiv gepflegt, bessere Accessibility
3. **Dedizierter `/kanban` Endpoint** statt Client-Side-Gruppierung — ermöglicht Spalten-Pagination und genaue Counts
4. **APScheduler** statt Celery — läuft in-process auf Railway, kein separater Worker nötig
5. **Stage-Änderungen als Events** — jeder Drag-and-Drop erzeugt DocumentAction, Audit-Trail bleibt lückenlos
6. **Feature-Flag `enable_kanban_view`** — ermöglicht schrittweises Rollout

## Verifikation

Für jedes Deployment:
1. `cd backend && python -m pytest tests/ -x -q` — Backend-Tests
2. `cd frontend && npm run build` — Frontend-Build prüfen
3. Manueller Test auf Vercel Preview + Railway Staging:
   - Dokument erstellen → Kanban-Board prüfen (Stage "entwurf")
   - Drag auf "Versendet" → Dialog ausfüllt → Action-Event prüfen
   - Drag auf "Rücklauf" → Frist setzen → Überfälligkeits-Anzeige nach Ablauf
   - Freigabe anfordern → Genehmigender sieht Notification + E-Mail
   - Genehmigender kommentiert → Änderungen anfordern → Kommentar-Tab öffnet sich
   - Listen-Ansicht: Stage-Badges und Handlungsbedarf-Punkte prüfen

---

## Bestehende Backend-Infrastruktur (Referenz)

### Bereits implementierte Models
- `GeneratedDocument` — `enterprise.py` (workflow_status, has_open_actions, next_due_date, is_archived, retention_date)
- `DocumentAction` — `enterprise.py` (11 action_types: created, sent, return_pending, returned, approval_requested, approved, rejected, note, completed, reminder_set, reminder_done)
- `DocumentApproval` — `enterprise.py` (pending_approval, approved, changes_requested, rejected)
- `DocumentVersion` — `enterprise.py` (version_number, form_data_snapshot, change_reason, changed_fields)
- `DocumentCorrectionRequest` — `enterprise.py` (pending, in_progress, completed, cancelled)
- `DocumentLock` — `enterprise.py` (pessimistic locking)
- `Notification` — `enterprise.py` (in-app + SSE real-time)
- `NotificationPreference` — `enterprise.py` (email_enabled, email_digest)
- `GuestReviewLink` + `GuestReviewComment` — `enterprise.py` (external review)
- `AuditLog` — `enterprise.py` (immutable audit trail)
- `Comment` — `collaboration.py` (inline + block-level comments)

### Bereits implementierte Endpoints
- `POST/GET/PATCH /documents/{id}/actions` — document_actions.py
- `GET /repository/action-summary` — repository.py (5 Zähler)
- `POST /approvals/request`, `approve`, `reject`, `request-changes`, `resubmit` — approvals.py
- `GET/POST/PATCH /notifications` — notifications.py
- `POST/DELETE /documents/{id}/lock` — locks.py
- `POST/GET /documents/{id}/guest-links` — guest_review.py
- `POST /corrections/start`, `/submit` — corrections.py

### Bereits implementierte Frontend-Komponenten
- `Repository.tsx` (882 Zeilen) — Listen-Ansicht mit Tabs + ActionSummaryCards
- `DocumentDetail.tsx` (740 Zeilen) — 5 Sidebar-Tabs (Details, Verwaltung, Verlauf, Kommentare, Freigabe)
- `ActionBar.tsx` — Speichern + Exportieren Buttons
- `WorkflowStepper.tsx` — 4-Step Formular-Fortschritt
- `SplitScreenEditor.tsx` — 30/70 Split Layout
- `DocumentApprovalPanel.tsx` — Freigabe-UI mit Dialogen
- `QuickStatusDropdown.tsx` — 4 Schnellaktionen pro Zeile
- `DocumentLifecycleTab.tsx` — Timeline im Detail-Sidebar
- `ActionSummaryCards.tsx` — 5 Filter-Karten
- `DocumentStatusBadge.tsx` — Status-Visualisierung
- `CommentThread.tsx` / `CommentSidebar.tsx` — Inline-Kommentare
