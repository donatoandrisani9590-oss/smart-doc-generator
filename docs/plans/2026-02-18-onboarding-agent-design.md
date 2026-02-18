# Onboarding-Paket-Agent — Design

**Datum:** 2026-02-18
**Ansatz:** Hybrid — Deterministische Pipeline + Agent-Nachbesserung

## Zusammenfassung

KI-Agent der im bestehenden ChatAssistent lebt und komplette Dokumentpakete (z.B. Onboarding: Arbeitsvertrag + Verschwiegenheit + Homeoffice) in einem Schritt erstellt. Phase 1 nutzt eine schnelle deterministische Pipeline (~2s), Phase 2 ermöglicht Agent-gestützte Nachbesserung über den bestehenden Agent-Orchestrator.

## Anforderungen

- **Einstieg:** Neuer Modus "onboarding" im ChatAssistent (5. Modus neben general/clause/formal/document)
- **Input:** Natürliche Sprache, z.B. "Onboarding für Anna Müller, Senior Developer, 70k, Start 1. Mai"
- **Output:** Alle Dokumente als Entwürfe (DocumentDraft), Übersichtskarte im Chat
- **Pakete:** Feste, vordefinierte Pakete (Onboarding, Kündigung, Beförderung)
- **Nachbesserung:** Agent kann Drafts einzeln oder alle gleichzeitig aktualisieren

## Architektur

```
                    ChatAssistent.tsx
                         │
                         ▼
              ┌─── Intent erkennen ───┐
              │   "Onboarding" Keyword │
              └──────────┬────────────┘
                         │
          Phase 1 (Pipeline, ~2s)
                         │
                         ▼
              POST /smart/onboarding (SSE)
                         │
                         ▼
              onboarding_service.py
              ┌──────────────────────┐
              │ 1. LLM: Text→Daten   │  ← 1 LLM-Call
              │ 2. Paket auflösen    │  ← Konstante
              │ 3. Historie suchen   │  ← DB Query
              │ 4. Drafts erstellen  │  ← DB Inserts
              │ 5. Compliance-Check  │  ← Pattern-only
              └──────────┬───────────┘
                         │
                         ▼
              OnboardingResultCard.tsx
              ┌──────────────────────┐
              │ ✅ 3 Drafts erstellt  │
              │ 📄 Vertrag    [Öffnen]│
              │ 📄 NDA        [Öffnen]│
              │ 📄 Homeoffice [Öffnen]│
              └──────────┬───────────┘
                         │
          Phase 2 (Agent, optional)
                         │
                         ▼
              POST /agent/chat
              ┌──────────────────────┐
              │ Bestehender Agent-    │
              │ Orchestrator mit      │
              │ +2 neuen Tools        │
              │ (update_package_draft,│
              │  apply_to_all_drafts) │
              └──────────────────────┘
```

## Paket-Definitionen

```python
ONBOARDING_PACKAGES = {
    "onboarding": {
        "name": "Onboarding",
        "description": "Neuen Mitarbeiter einstellen",
        "document_types": ["Arbeitsvertrag", "Verschwiegenheit", "Homeoffice"],
        "shared_fields": ["vorname", "nachname", "position", "gehalt", "eintrittsdatum"],
    },
    "kuendigung": {
        "name": "Kündigung",
        "description": "Mitarbeiter kündigen",
        "document_types": ["Kündigung", "Freistellung", "Zeugnis"],
        "shared_fields": ["vorname", "nachname", "position"],
    },
    "befoerderung": {
        "name": "Beförderung",
        "description": "Mitarbeiter befördern",
        "document_types": ["Beförderung", "Gehaltserhöhung", "Nachtrag"],
        "shared_fields": ["vorname", "nachname", "position"],
    },
}
```

## Datenmodell

### Neues Modell: `OnboardingJob`

```python
class OnboardingJob(Base):
    __tablename__ = "onboarding_jobs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    package_key = Column(String(50))          # "onboarding", "kuendigung"
    employee_name = Column(String(255))
    country_code = Column(String(2))
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    input_data = Column(Text)                 # JSON: extrahierte Daten vom LLM
    draft_ids = Column(Text)                  # JSON: [draft_id_1, draft_id_2, ...]
    created_at = Column(DateTime, server_default=func.now())
```

Entwürfe werden als reguläre `DocumentDraft` Einträge gespeichert.

## Backend-Pipeline (Phase 1)

### Endpoint: `POST /api/v1/smart/onboarding`

**Request:**
```json
{
  "message": "Onboarding für Anna Müller, Senior Developer, 70k, Start 1. Mai",
  "package_key": "onboarding",
  "country_code": "DE"
}
```

**Response (SSE-Stream):**
```
data: {"type": "status", "step": "extracting", "message": "Extrahiere Mitarbeiterdaten..."}
data: {"type": "status", "step": "history", "message": "Suche frühere Dokumente..."}
data: {"type": "employee_history", "documents": [...]}
data: {"type": "status", "step": "creating", "message": "Erstelle Arbeitsvertrag..."}
data: {"type": "draft_created", "draft": {id, title, type, missing_fields}}
data: {"type": "draft_created", "draft": {id, title, type, missing_fields}}
data: {"type": "draft_created", "draft": {id, title, type, missing_fields}}
data: {"type": "done", "job_id": 7, "summary": "...", "drafts": [...]}
```

### Pipeline-Schritte:

1. **LLM-Extraktion** (einziger LLM-Call): User-Text → strukturierte Daten + Paket-Erkennung
2. **Paket auflösen:** `package_key` → Dokumenttyp-Namen → DocumentType IDs aus DB
3. **Mitarbeiter-Historie:** DB-Query auf `generated_documents` nach employee_name
4. **Für jeden Dokumenttyp:**
   - FormField-Definitionen laden
   - Felder mergen: Defaults < Historie < LLM-extrahiert
   - Pflichtfeld-Check → `missing_fields` berechnen
   - `DocumentDraft` erstellen
   - Optional: Compliance-Pattern-Check (kein LLM)
5. **OnboardingJob** speichern mit allen `draft_ids`

### Service: `onboarding_service.py`

```python
async def extract_employee_data(message: str, country_code: str) -> dict
async def create_package_drafts(
    package_key: str,
    extracted_data: dict,
    user_id: int,
    country_code: str,
    db: AsyncSession,
) -> OnboardingJob
```

## Chat-Integration (Phase 2)

### ChatAssistent Erweiterung

- Neuer 5. Modus: `"onboarding"` (neben general/clause/formal/document)
- Intent-Erkennung: Keywords "Onboarding", "einstellen", "kündigen", "befördern"
- Nach Pipeline (Phase 1): automatischer Wechsel in onboarding-Modus
- Im onboarding-Modus: Requests gehen an `POST /agent/chat` (bestehender Orchestrator)

### Neue Agent-Tools (in `agent_tools.py`)

**`update_package_draft`** — Einzelnen Draft bearbeiten:
```python
{
    "name": "update_package_draft",
    "parameters": {
        "draft_id": int,
        "field_updates": dict,
        "add_clauses": list[int],
        "remove_clauses": list[int]
    }
}
```

**`apply_to_all_drafts`** — Alle Drafts im Paket aktualisieren:
```python
{
    "name": "apply_to_all_drafts",
    "parameters": {
        "job_id": int,
        "field_updates": dict
    }
}
```

### OnboardingResultCard.tsx

Neue Komponente für die Ergebnis-Anzeige im Chat:
- Draft-Liste mit Status-Icons (vollständig/fehlende Felder)
- "[Öffnen]"-Buttons navigieren zu `/generate?draft={id}`
- Fehlende Felder als Warn-Badges

## Datei-Übersicht

### Neue Dateien (4)

| Datei | Zweck |
|-------|-------|
| `backend/app/services/onboarding_service.py` | Kern-Service: LLM-Extraktion, Draft-Erstellung, Historie-Merge |
| `backend/app/services/onboarding_packages.py` | Paket-Definitionen (Konstante) |
| `backend/app/api/v1/endpoints/smart/onboarding.py` | SSE-Endpoint + Job-Status-Endpoint |
| `frontend/src/components/chat/OnboardingResultCard.tsx` | Ergebnis-Karte im Chat |

### Bestehende Dateien (6 Änderungen)

| Datei | Änderung |
|-------|----------|
| `backend/app/models/enterprise.py` | +`OnboardingJob` Model |
| `backend/app/models/__init__.py` | +Import OnboardingJob |
| `backend/app/main.py` | +Onboarding-Router registrieren |
| `backend/app/services/agent_tools.py` | +2 Tools: `update_package_draft`, `apply_to_all_drafts` |
| `frontend/src/components/chat/ChatAssistent.tsx` | +Modus "onboarding", Pipeline-SSE, Ergebnis-Anzeige |
| `backend/migrations/versions/007_add_onboarding_jobs.py` | DB-Migration |

### Feature-Flag

`enable_onboarding_agent` in `user_settings.py` — standardmäßig `true`.

## Error Handling

- **Kein LLM verfügbar:** Fehler-Event im SSE-Stream, Chat zeigt Fehlermeldung
- **Dokumenttyp nicht gefunden:** Draft wird übersprungen, Warnung im Stream
- **Kein Mitarbeiter in Historie:** Nur extrahierte + Default-Daten werden verwendet
- **Draft-Erstellung fehlschlägt:** Job-Status = "partial", erfolgreiche Drafts bleiben
