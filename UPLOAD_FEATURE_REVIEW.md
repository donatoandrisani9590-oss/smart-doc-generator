# Upload Feature Review - Smart Document Generator

**Reviewer:** Senior Fullstack Reviewer & QA-Architect (Claude)
**Datum:** 2026-02-07
**Scope:** Vollstaendige Pruefung der "Hochladen"-Funktion ueber alle 5 Implementierungsebenen

---

## Zusammenfassung (Executive Summary)

| Ebene | Status | Bewertung |
|-------|--------|-----------|
| 1. Frontend (UI/UX) | Teilweise implementiert | C+ |
| 2. API Route / Server Action | Kritische Luecken | D |
| 3. Storage Integration | Funktional, aber fragil | C |
| 4. Datenbank & Metadaten | Unvollstaendig | D |
| 5. Smart Trigger (OCR/Ingestion) | Nicht implementiert | F |

**Gesamtbewertung: Nicht Enterprise-Ready.** Die Upload-Funktion existiert auf Frontend- und API-Ebene, aber es fehlen Authentifizierung auf kritischen Endpoints, persistente Speicherung der extrahierten Inhalte, und eine automatische Ingestion-Pipeline. Hochgeladene Dateien sind fuer KI-Funktionen "tot".

---

## Ebene 1: Frontend Komponente (UI/UX)

### Gefundene Upload-Komponenten

Alle Upload-Komponenten befinden sich im **Vite+React Frontend** (`frontend/src/`). Das Next.js Frontend (`src/`) enthaelt **keine** Upload-Funktionalitaet.

| Komponente | Pfad | Zweck |
|------------|------|-------|
| `DocumentUploadDialog.tsx` | `frontend/src/components/documents/` | Haupt-Upload fuer PDF/DOCX mit KI-Extraktion |
| `LogoUploader.tsx` | `frontend/src/components/admin/` | Logo-Upload (PNG/JPG/SVG) |
| `BulkUploadValidator.tsx` | `frontend/src/components/bulk/` | CSV/Excel Massen-Import |
| `AttachmentsPage.tsx` | `frontend/src/pages/admin/` | Anhaenge-Verwaltung (PDF/DOCX) |
| `WordImportWizard.tsx` | `frontend/src/components/admin/` | Word-Template Import |
| `DocumentTypeImportWizard.tsx` | `frontend/src/components/admin/` | Dokumenttyp-Import aus DOCX |

### Checkliste

| Kriterium | Status | Details |
|-----------|--------|---------|
| Dateityp-Validierung (PDF/DOCX Whitelist) | ✅ Implementiert | `DocumentUploadDialog`: react-dropzone mit MIME-Whitelist (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) |
| Dateigroessen-Validierung | ⚠️ Inkonsistent | `DocumentUploadDialog`: 25 MB, `LogoUploader`: 2 MB, `WordImportWizard`: 10 MB. **FEHLT** in: `BulkUploadValidator`, `AttachmentsPage` (UI zeigt "max 10 MB" aber keine Pruefung), `DocumentTypeImportWizard` |
| Loading Spinner / Progress Bar | ⚠️ Teilweise | Spinner vorhanden, aber `DocumentUploadDialog` zeigt **hardcoded** `Progress value={66}` - kein realer Upload-Fortschritt |
| Fehlermeldungen | ✅ Implementiert | Toast-Notifications via `sonner`, inline Fehlertexte. Aber **inkonsistente UX** (Toast vs. Inline vs. animierte States je nach Komponente) |
| Drag & Drop | ✅ Implementiert | `DocumentUploadDialog` und `AttachmentsPage` nutzen `react-dropzone`. Andere nutzen manuelle Implementierung - **Code-Duplikation** |

### Bugs & Risiken

1. **Fake Progress Bar** (`DocumentUploadDialog.tsx:393`):
   ```tsx
   <Progress value={66} className="w-48 mx-auto" />
   ```
   Der Wert `66` ist hardcoded - kein realer Upload-/Extraktions-Fortschritt.

2. **Fehlende Groessen-Validierung** in 3 von 6 Komponenten:
   - `BulkUploadValidator`: Kein Limit -> grosse Excel-Dateien koennen den Browser/Server ueberlasten
   - `AttachmentsPage`: UI verspricht 10 MB Limit, Code prueft es nicht
   - `DocumentTypeImportWizard`: Kein Limit

3. **Inkonsistente Fehlerbehandlung**: Jede Komponente zeigt Fehler anders an (Toast, Inline-Text, animierte Boxen). Nutzer erleben unterschiedliche Patterns.

---

## Ebene 2: API Route / Server Action

### Gefundene Endpoints

| Endpoint | Datei | Auth | Dateigroesse |
|----------|-------|------|--------------|
| `POST /api/v1/documents/upload` | `document_upload.py` | ✅ `get_current_user` | ❌ **Kein Limit!** |
| `POST /api/v1/attachments/` | `attachments.py` | ✅ `get_current_active_admin` | ✅ 10 MB |
| `POST /api/v1/word-import/analyze` | `word_import.py` | ❌ **Keine Auth!** | ✅ 10 MB |
| `POST /api/v1/word-import/magic/*` | `word_import.py` | ❌ **Keine Auth!** | ✅ 10 MB |
| `POST /api/v1/document-type-import/analyze` | `document_type_import.py` | ❌ **Keine Auth!** | ✅ 10 MB |
| `POST /api/v1/admin/logo/{code}` | `logo.py` | ✅ `get_current_active_admin` | ✅ 2 MB |
| `POST /api/v1/bulk/validate` | `bulk.py` | ✅ `get_current_user` | ✅ 10 MB |
| `POST /api/v1/admin/templates/` | `templates.py` | ✅ `get_current_active_admin` | ✅ 10 MB |

### Checkliste

| Kriterium | Status | Details |
|-----------|--------|---------|
| multipart/form-data Verarbeitung | ✅ Implementiert | FastAPI `UploadFile` + `python-multipart` korrekt verwendet |
| User-Session/Auth vor Upload | ❌ **KRITISCH** | 3 Endpoints komplett **ohne Authentifizierung**: `word_import.py` (analyze, import, magic/*), `document_type_import.py` (analyze) |
| Dateigroessen-Limit | ❌ **KRITISCH** | Haupt-Upload-Endpoint (`/documents/upload`) hat **kein Limit** - DoS-Risiko |
| MIME-Type Validierung | ❌ Fehlt fast ueberall | Nur `logo.py` prueft `content_type`. Alle anderen pruefen nur die Dateiendung |
| Magic-Bytes Validierung | ❌ Fehlt fast ueberall | Nur `logo.py` prueft PNG/JPEG-Header. PDFs/DOCX werden nicht auf Datei-Signatur geprueft |
| Path-Traversal Schutz | ⚠️ Teilweise | `logo.py`: stark (resolve + is_relative_to). `attachments.py`: regex-Sanitierung. Andere: Standard-Naming |

### KRITISCHE Sicherheitsluecken

**1. Unauthentifizierte Upload-Endpoints** (`word_import.py`):
```python
# Zeile 257 - KEINE Auth!
@router.post("/analyze", response_model=WordAnalysisResult)
async def analyze_word_document(
    file: UploadFile = File(...),
    country_code: str = "DE",
    db: AsyncSession = Depends(get_db),  # Nur DB-Dependency!
):
```

**Fix:**
```python
@router.post("/analyze", response_model=WordAnalysisResult)
async def analyze_word_document(
    file: UploadFile = File(...),
    country_code: str = "DE",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_admin),  # HINZUFUEGEN
):
```

**2. Kein Dateigroessen-Limit auf Haupt-Upload** (`document_upload.py`):
```python
# Zeile 308 - Liest gesamte Datei ohne Groessen-Check
with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
    chunk_size = 1024 * 1024  # 1MB
    while chunk := await file.read(chunk_size):
        tmp.write(chunk)  # Kein Groessen-Check!
```

**Fix:**
```python
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
total_size = 0
with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_ext}") as tmp:
    chunk_size = 1024 * 1024
    while chunk := await file.read(chunk_size):
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            os.unlink(tmp.name)
            raise HTTPException(status_code=413, detail="Datei zu gross")
        tmp.write(chunk)
```

**3. Debug-Modus umgeht Authentifizierung** (`deps.py:30-31`):
```python
# Wenn DEBUG=True, wird ein Mock-Admin zurueckgegeben
# Jeder kann dann als Admin auf alle Endpoints zugreifen
```

---

## Ebene 3: Storage Integration

### Wo werden Dateien gespeichert?

| Typ | Pfad | Methode |
|-----|------|---------|
| Generierte Dokumente | `/storage/generated/` | Lokales Dateisystem |
| Logos | `/storage/logos/{country_code}/` | Lokales Dateisystem |
| Anhaenge | `/storage/attachments/{country_code}/` | Lokales Dateisystem |
| Master-Templates | `/storage/master-templates/` | Lokales Dateisystem |
| Bulk-Ergebnisse | `/tmp/bulk_job_{id}/` | Temporaer |
| Upload-Extraktion | `/tmp/` via tempfile | Temporaer (wird geloescht!) |
| Cloud-Sync | SMB/SharePoint | Implementiert, aber **nicht aktiv** |
| Supabase Storage | - | Client initialisiert, **nicht genutzt** |

### Checkliste

| Kriterium | Status | Details |
|-----------|--------|---------|
| Eindeutige Dateipfade/IDs | ❌ **KRITISCH** | Generierungspfad: `Vertrag_{nachname}.docx` - **KEINE UUID/Timestamp** -> Namenskollision bei gleichem Nachnamen! |
| UUID-basierte Pfade | ⚠️ Inkonsistent | Drafts nutzen `uuid.uuid4()[:8]`, aber Generierung und Logos nicht |
| Robustheit bei Netzwerkfehlern | ⚠️ Teilweise | Celery PDF-Tasks: Retry mit Backoff. Generierung/Upload: keine Retry-Logik |
| Speicherplatz-Pruefung | ❌ Fehlt | Kein Check auf verfuegbaren Speicherplatz vor Schreibvorgaengen |
| Orphaned-File-Bereinigung | ⚠️ Teilweise | Temp-Cleanup: 24h Celery-Task. Aber: Soft-Deleted Attachments werden **nie physisch geloescht** |
| Backup/Replikation | ❌ Fehlt | Docker Volume als Single Point of Failure |
| Datei-Integritaet | ❌ Fehlt | Kein Checksum/Hash gespeichert |

### Risiko: Namenskollision bei Dokumenten-Generierung

```python
# generation.py Zeile 681-685
nachname = form_data.get('nachname', 'Dokument')
safe_nachname = re.sub(r'[^\w\s-]', '', nachname).strip().replace(' ', '_')
output_filename = f"Vertrag_{safe_nachname}.docx"  # KEIN Timestamp, KEINE UUID!
```

Zwei Vertraege fuer "Mueller" ueberschreiben sich gegenseitig.

**Fix:**
```python
import uuid
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
unique_id = str(uuid.uuid4())[:8]
output_filename = f"Vertrag_{safe_nachname}_{timestamp}_{unique_id}.docx"
```

---

## Ebene 4: Datenbank & Metadaten

### Relevante Tabellen

| Tabelle | Zweck | Upload-relevant |
|---------|-------|-----------------|
| `GeneratedDocument` | Generierte Vertraege | Ja - speichert `file_path`, `file_format` |
| `Attachment` | Statische Anhaenge | Ja - speichert `file_path`, `file_type`, `file_size_bytes` |
| `BulkJob` | Massen-Generierung | Ja - speichert `status`, `result_file_path` |
| `DocumentVersion` | Versionierung | Ja - speichert `file_path` pro Version |
| `DocumentDraft` | Entwuerfe | Nein - nur `form_data` als JSON |

### Checkliste

| Kriterium | Status | Details |
|-----------|--------|---------|
| DB-Eintrag bei Upload erstellt | ❌ **KRITISCH** | Der Haupt-Upload-Endpoint (`/documents/upload`) erstellt **KEINEN** Datenbank-Eintrag! Extrahierte Daten werden nur als HTTP-Response zurueckgegeben |
| Original-Dateiname gespeichert | ❌ Fehlt | Kein `original_filename`-Feld in irgendeiner Tabelle |
| Upload-Datum | ⚠️ Indirekt | `created_at` existiert, aber es gibt kein separates `uploaded_at` |
| Uploader-ID | ⚠️ Inkonsistent | `GeneratedDocument.created_by_id` ist **nullable**. `DocumentDraft.user_id` ist ein **String** statt Integer FK |
| MIME-Type | ❌ Fehlt | Nur `file_format` (pdf/docx), kein vollstaendiger MIME-Type |
| Dateigroesse | ❌ Fehlt in Haupttabelle | Nur `Attachment` hat `file_size_bytes`. `GeneratedDocument` fehlt es |
| Initialer Status | ❌ Fehlt | `GeneratedDocument` hat **kein Status-Feld** (nur `is_deleted`/`is_archived` Booleans). Kein `PENDING`/`PROCESSING`/`COMPLETED` |
| Content-Hash | ❌ Fehlt | Kein SHA256/MD5 fuer Integritaetspruefung |
| Virus-Scan-Status | ❌ Fehlt | Nicht implementiert |

### Fehlende Tabelle: `UploadedDocument`

Es gibt **keine dedizierte Tabelle** fuer importierte/hochgeladene Dokumente. Die Architektur unterscheidet nicht zwischen "generiert" und "importiert".

**Empfohlenes Schema:**
```python
class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id = Column(Integer, primary_key=True)
    original_filename = Column(String(500), nullable=False)
    stored_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    content_hash = Column(String(64))  # SHA256

    # Status-Tracking
    status = Column(String(20), default="PENDING", index=True)
    # PENDING -> SCANNING -> EXTRACTING -> COMPLETED / FAILED

    # Extraction
    extracted_text = Column(Text)
    extracted_metadata = Column(Text)  # JSON
    extraction_provider = Column(String(50))  # pattern/mistral/ollama
    extraction_confidence = Column(Float)
    page_count = Column(Integer)

    # Audit
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True))

    # Retention
    retention_date = Column(DateTime(timezone=True))
    is_deleted = Column(Boolean, default=False)
```

---

## Ebene 5: "Smart" Trigger (OCR/Ingestion)

### Was passiert NACH dem Upload?

```
Nutzer laedt PDF/DOCX hoch
    |
    v
FastAPI empfaengt Datei
    |
    v
Speichert in /tmp/ (temporaer)
    |
    v
Extrahiert Text (PyPDF2/python-docx) - SYNCHRON
    |
    v
Optional: LLM-Analyse (Mistral/Ollama) - SYNCHRON
    |
    v
HTTP Response mit extrahierten Feldern
    |
    v
Temp-Datei geloescht
    |
    v
=== ENDE ===

Kein DB-Eintrag.
Kein Celery-Task.
Kein Webhook.
Kein Index-Update.
Kein Such-Index.

Die Datei ist fuer die KI "tot".
```

### Checkliste

| Kriterium | Status | Details |
|-----------|--------|---------|
| Text-Extraktion (PDF) | ✅ Implementiert | PyPDF2 + pdfplumber Fallback (`document_upload.py:69-103`) |
| Text-Extraktion (DOCX) | ✅ Implementiert | python-docx, aber nur Paragraphen - **keine Tabellen, Header, Footer** |
| OCR fuer gescannte PDFs | ❌ **Fehlt komplett** | Kein Tesseract, kein Azure Form Recognizer, kein AWS Textract |
| Automatische Ingestion nach Upload | ❌ **Fehlt komplett** | Kein Celery-Task wird nach Upload gestartet |
| Persistente Speicherung extrahierter Texte | ❌ **Fehlt komplett** | Kein `text_content`-Feld in der DB |
| Volltext-Suche | ❌ **Fehlt** | Nur einfache SQL `LIKE`-Abfragen auf Mitarbeiternamen |
| Semantische Suche / Embeddings | ❌ **Fehlt** | Keine Vektor-DB-Integration |
| Webhook nach Extraktion | ❌ **Fehlt** | Kein `document.ingested` Event |
| Job-Queue fuer Extraktion | ❌ **Fehlt** | Celery existiert (PDF-Konvertierung, Bulk), aber kein Ingestion-Task |

### Vorhandene Celery-Tasks (KEINE Ingestion)

| Task | Datei | Zweck |
|------|-------|-------|
| `convert_docx_to_pdf` | `pdf_tasks.py` | PDF-Konvertierung (LibreOffice) |
| `process_bulk_job` | `bulk_tasks.py` | Massen-Generierung |
| `enforce_retention_policies` | `retention.py` | Auto-Loesch nach Aufbewahrungsfrist |
| `cleanup_expired_drafts` | `retention.py` | Draft-Bereinigung (30 Tage) |

### Empfohlene Architektur fuer Ingestion-Pipeline

```
Nutzer laedt PDF/DOCX hoch
    |
    v
POST /api/v1/documents/upload
    |
    v
1. Validierung (Typ, Groesse, MIME, Magic Bytes)
    |
    v
2. Speichern in /storage/uploads/{uuid}.{ext}
    |
    v
3. DB: INSERT uploaded_documents (status='PENDING')
    |
    v
4. Celery-Task starten: ingest_document.delay(document_id)
    |
    v
5. Response: { id, status: 'PENDING' }

=== ASYNC (Celery Worker) ===

ingest_document(document_id):
    |
    v
A. Status -> 'EXTRACTING'
    |
    v
B. Text extrahieren (PyPDF2/python-docx)
    |
    +-> Falls Scan-PDF: OCR (Tesseract/Azure)
    |
    v
C. Optional: LLM-Analyse (Feld-Extraktion)
    |
    v
D. DB UPDATE: text_content, extracted_metadata, status='COMPLETED'
    |
    v
E. Webhook: document.ingested
    |
    v
F. Optional: Such-Index aktualisieren
```

**Celery-Task Vorschlag:**
```python
# backend/app/tasks/ingestion.py

from app.worker import celery_app
from app.db import async_session_factory

@celery_app.task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    soft_time_limit=300,
    time_limit=360,
)
def ingest_document(self, document_id: int):
    """Async document ingestion after upload."""
    import asyncio
    asyncio.run(_ingest_document_async(self, document_id))

async def _ingest_document_async(task, document_id: int):
    async with async_session_factory() as db:
        # 1. Load document record
        doc = await db.get(UploadedDocument, document_id)
        if not doc:
            return

        # 2. Update status
        doc.status = "EXTRACTING"
        await db.commit()

        try:
            # 3. Extract text
            if doc.mime_type == "application/pdf":
                text, pages = extract_text_from_pdf(doc.stored_path)
                if len(text.strip()) < 50 * pages:
                    # Likely scanned - needs OCR
                    text = await run_ocr(doc.stored_path)
            else:
                text, pages = extract_text_from_docx(doc.stored_path)

            # 4. Optional LLM analysis
            metadata = await extract_fields_with_llm(text)

            # 5. Persist results
            doc.extracted_text = text
            doc.extracted_metadata = json.dumps(metadata)
            doc.page_count = pages
            doc.status = "COMPLETED"
            doc.processed_at = datetime.utcnow()
            await db.commit()

            # 6. Trigger webhook
            await trigger_webhook("document.ingested", {
                "document_id": document_id,
                "fields_extracted": len(metadata.get("fields", []))
            })

        except Exception as e:
            doc.status = "FAILED"
            doc.extraction_error = str(e)
            await db.commit()
            raise task.retry(exc=e)
```

---

## Gesamtuebersicht: Checkliste

### Legende
- ✅ Implementiert
- ⚠️ Teilweise / Verbesserungswuerdig
- ❌ Fehlt

### Ebene 1: Frontend

| # | Kriterium | Status |
|---|-----------|--------|
| 1.1 | Upload-Komponente existiert | ✅ `DocumentUploadDialog.tsx` mit react-dropzone |
| 1.2 | Dateityp-Whitelist (PDF/DOCX) | ✅ MIME-basierte Filterung |
| 1.3 | Dateigroessen-Validierung | ⚠️ 25 MB im Dialog, fehlt in 3 anderen Komponenten |
| 1.4 | Loading Spinner | ✅ Vorhanden (Loader2 + animierte Klasse) |
| 1.5 | Progress Bar (real) | ❌ Hardcoded auf 66% - kein realer Fortschritt |
| 1.6 | Fehlermeldungen (Toast) | ✅ sonner-Toast bei Fehlern |
| 1.7 | Drag & Drop | ✅ react-dropzone mit visuellem Feedback |
| 1.8 | Konsistente UX | ❌ Jede Komponente zeigt Fehler anders an |

### Ebene 2: API Route

| # | Kriterium | Status |
|---|-----------|--------|
| 2.1 | Upload-Endpoint existiert | ✅ `POST /api/v1/documents/upload` |
| 2.2 | multipart/form-data | ✅ FastAPI UploadFile korrekt |
| 2.3 | Auth auf Upload-Endpoint | ✅ `get_current_user` auf Haupt-Endpoint |
| 2.4 | Auth auf ALLEN Endpoints | ❌ word_import + document_type_import OHNE Auth |
| 2.5 | Dateigroessen-Limit (Backend) | ❌ Haupt-Upload hat KEIN Limit |
| 2.6 | MIME-Type Validierung | ❌ Nur Extension-Check (ausser Logo) |
| 2.7 | Magic-Bytes Pruefung | ❌ Nur Logo-Endpoint prueft Datei-Signatur |
| 2.8 | Rate Limiting auf Uploads | ❌ Nicht implementiert |
| 2.9 | Virus-Scan | ❌ Nicht implementiert |

### Ebene 3: Storage

| # | Kriterium | Status |
|---|-----------|--------|
| 3.1 | Dateien werden gespeichert | ⚠️ Upload-Dateien nur temporaer, generierte persistent |
| 3.2 | Eindeutige Pfade/IDs | ❌ Generierung nutzt Nachname ohne UUID |
| 3.3 | UUID-basierte Speicherung | ⚠️ Nur Drafts nutzen UUID, Rest nicht |
| 3.4 | Netzwerkfehler-Robustheit | ⚠️ Nur Celery PDF-Tasks mit Retry |
| 3.5 | Speicherplatz-Pruefung | ❌ Nicht implementiert |
| 3.6 | Orphaned-File Cleanup | ⚠️ Temp ja, Soft-Deletes nein |
| 3.7 | Cloud-Storage aktiv | ❌ SMB/SharePoint implementiert aber nicht konfiguriert |
| 3.8 | Backup-Strategie | ❌ Nicht vorhanden |

### Ebene 4: Datenbank

| # | Kriterium | Status |
|---|-----------|--------|
| 4.1 | DB-Eintrag bei Upload | ❌ KEIN Eintrag fuer hochgeladene Dateien |
| 4.2 | Original-Dateiname | ❌ Nicht gespeichert |
| 4.3 | Upload-Datum | ⚠️ Nur `created_at` (nicht Upload-spezifisch) |
| 4.4 | Uploader-ID | ⚠️ `created_by_id` ist nullable |
| 4.5 | MIME-Type | ❌ Nur `file_format` (pdf/docx) |
| 4.6 | Dateigroesse | ❌ Fehlt in `GeneratedDocument` |
| 4.7 | Status (PENDING/PROCESSING) | ❌ Kein Status-Feld auf Dokumenten |
| 4.8 | Content-Hash | ❌ Nicht implementiert |
| 4.9 | Dedizierte Upload-Tabelle | ❌ Existiert nicht |

### Ebene 5: Smart Trigger

| # | Kriterium | Status |
|---|-----------|--------|
| 5.1 | Text-Extraktion (PDF) | ✅ PyPDF2 + pdfplumber |
| 5.2 | Text-Extraktion (DOCX) | ⚠️ Nur Paragraphen, keine Tabellen/Header |
| 5.3 | OCR (gescannte PDFs) | ❌ Nicht implementiert |
| 5.4 | Automatischer Trigger nach Upload | ❌ Kein Celery-Task |
| 5.5 | Extrahierter Text persistent | ❌ Wird nicht in DB gespeichert |
| 5.6 | LLM-Feld-Extraktion | ✅ Optional mit Mistral/Ollama |
| 5.7 | Volltext-Suche | ❌ Nur LIKE-Queries |
| 5.8 | Webhook nach Ingestion | ❌ Kein `document.ingested` Event |
| 5.9 | Celery Ingestion-Task | ❌ Nicht implementiert |

---

## Priorisierte Massnahmen

### P0 - Sofort (Sicherheitskritisch)

1. **Auth auf word_import.py hinzufuegen** - `Depends(get_current_active_admin)` auf alle Endpoints
2. **Auth auf document_type_import.py hinzufuegen** - `Depends(get_current_active_admin)` auf `/analyze`
3. **Dateigroessen-Limit auf /documents/upload** - Max 50 MB mit Streaming-Check
4. **DEBUG-Modus Auth-Bypass entfernen** - `deps.py` Mock-User nicht in Production

### P1 - Kurzfristig (Feature-Completeness)

5. **`UploadedDocument`-Tabelle erstellen** - Migration mit allen Metadaten-Feldern
6. **DB-Eintrag bei Upload erstellen** - Status-Tracking (PENDING -> PROCESSING -> COMPLETED)
7. **Celery Ingestion-Task implementieren** - Async Text-Extraktion + DB-Persistenz
8. **UUID in Dateinamen erzwingen** - Namenskollision in `generation.py` fixen
9. **MIME-Type + Magic-Bytes Validierung** - `python-magic` Library einbinden

### P2 - Mittelfristig (Enterprise-Ready)

10. **OCR-Integration** - Tesseract fuer gescannte PDFs
11. **Volltext-Suche** - PostgreSQL tsvector oder Elasticsearch
12. **Realer Upload-Fortschritt** - Server-Sent Events oder WebSocket
13. **Virus-Scanning** - ClamAV-Integration
14. **Upload-Rate-Limiting** - Pro User/Session
15. **Cloud-Storage aktivieren** - S3/Azure Blob als Primary Storage

### P3 - Langfristig (Optimierung)

16. **Semantische Suche** - Vektor-Embeddings + pgvector
17. **Webhook-Events** - `document.uploaded`, `document.ingested`
18. **Frontend Upload-UX vereinheitlichen** - Shared Hook/Komponente
19. **File-Integrity Checks** - SHA256 Hash bei Upload + Abruf
20. **Retention-Policies** - Automatische Loeschung nach Aufbewahrungsfrist

---

## Architektur-Empfehlung: Enterprise Upload Pipeline

```
                    ┌──────────────────────┐
                    │  Frontend            │
                    │  DocumentUploadDialog│
                    └──────────┬───────────┘
                               │ POST multipart/form-data
                               v
                    ┌──────────────────────┐
                    │  API Gateway         │
                    │  - Auth Check        │
                    │  - Rate Limit        │
                    │  - Size Limit        │
                    └──────────┬───────────┘
                               │
                               v
                    ┌──────────────────────┐
                    │  Upload Handler      │
                    │  - MIME Validation    │
                    │  - Magic Bytes Check │
                    │  - SHA256 Hash       │
                    │  - ClamAV Scan       │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴───────────┐
                    │                      │
                    v                      v
          ┌─────────────┐      ┌──────────────────┐
          │ Object Store│      │  PostgreSQL       │
          │ S3/Azure    │      │  uploaded_docs    │
          │ {uuid}.pdf  │      │  status=PENDING   │
          └─────────────┘      └──────────┬───────┘
                                          │
                                          v
                               ┌──────────────────┐
                               │  Celery Worker   │
                               │  ingest_document │
                               └──────────┬───────┘
                                          │
                               ┌──────────┴──────────┐
                               │                     │
                               v                     v
                        ┌────────────┐       ┌──────────────┐
                        │ PDF/DOCX   │       │  OCR         │
                        │ Extraction │       │  (Tesseract) │
                        └──────┬─────┘       └──────┬───────┘
                               │                    │
                               └────────┬───────────┘
                                        │
                                        v
                               ┌──────────────────┐
                               │  LLM Analysis    │
                               │  (Mistral/Ollama)│
                               └──────────┬───────┘
                                          │
                                          v
                               ┌──────────────────┐
                               │  DB UPDATE        │
                               │  text_content     │
                               │  extracted_fields │
                               │  status=COMPLETED │
                               └──────────┬───────┘
                                          │
                                          v
                               ┌──────────────────┐
                               │  Search Index    │
                               │  + Webhook       │
                               │  + Notification  │
                               └──────────────────┘
```

---

*Dieser Review wurde automatisch erstellt und sollte mit dem Entwicklungsteam besprochen werden.*
