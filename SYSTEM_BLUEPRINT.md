# SYSTEM BLUEPRINT - Smart Document Generator

**Version:** 4.2
**Ziel:** Vollständige technische Dokumentation für Pixel-für-Pixel Nachbau
**Erstellt:** 2026-01-30

---

## INHALTSVERZEICHNIS

1. [High-Level Architektur & Tech Stack](#1-high-level-architektur--tech-stack)
2. [Datenbank & Datenmodelle](#2-datenbank--datenmodelle)
3. [Komplette Menüstruktur & Navigation](#3-komplette-menüstruktur--navigation)
4. [Detaillierte Funktionsbeschreibung](#4-detaillierte-funktionsbeschreibung)
5. [API & Schnittstellen](#5-api--schnittstellen)

---

## 1. HIGH-LEVEL ARCHITEKTUR & TECH STACK

### 1.1 Systemübersicht

Das Smart Document Generator System ist eine Enterprise-Anwendung zur Generierung von HR-Dokumenten (Arbeitsverträge, Kündigungen, Zeugnisse) mit Multi-Jurisdiktion-Support (Deutschland/DE und Italien/IT).

**Architektur-Typ:** Monolithische Fullstack-Applikation mit asynchroner Task-Queue

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React SPA)                          │
│  React 19.2 + TypeScript + TailwindCSS + Radix UI + TanStack Query     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST (JSON)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                               │
│  FastAPI 0.100+ | Uvicorn/Gunicorn | SQLAlchemy Async | Pydantic 2.0   │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                         │
         │                    │                         │
         ▼                    ▼                         ▼
┌─────────────┐      ┌─────────────┐           ┌─────────────┐
│ PostgreSQL  │      │    Redis    │           │   Celery    │
│     16      │      │      7      │           │   Worker    │
│ (Datenbank) │      │   (Cache)   │           │  (Async)    │
└─────────────┘      └─────────────┘           └─────────────┘
```

### 1.2 Backend Tech Stack (Python)

| Technologie | Version | Zweck |
|-------------|---------|-------|
| FastAPI | ≥0.100.0 | Web Framework mit async Support |
| Uvicorn | ≥0.23.0 | ASGI Server (Development) |
| Gunicorn | ≥21.0.0 | WSGI Server (Production) |
| SQLAlchemy | ≥2.0.0 | Async ORM für PostgreSQL |
| asyncpg | ≥0.28.0 | PostgreSQL Async Driver |
| Alembic | ≥1.11.0 | Database Migrations |
| Pydantic | ≥2.0.0 | Data Validation & Settings |
| pydantic-settings | ≥2.0.0 | Environment Configuration |
| python-docx | ≥0.8.11 | Word-Dokument Manipulation |
| docxtpl | ≥0.16.0 | Jinja2-basierte DOCX Templates |
| Jinja2 | ≥3.1.2 | Template Engine |
| Celery | ≥5.3.0 | Async Task Queue |
| Redis | ≥5.0.0 | Message Broker & Cache |
| python-jose | ≥3.3.0 | JWT Token Handling |
| passlib + bcrypt | ≥1.7.4 | Password Hashing |
| PyMuPDF | ≥1.23.0 | PDF Manipulation |
| BeautifulSoup4 | ≥4.12.0 | HTML Parsing |
| bleach | ≥6.0.0 | HTML Sanitization (XSS Prevention) |
| OpenAI | ≥1.0.0 | AI Content Generation |
| smbprotocol | ≥1.11.0 | SMB/CIFS Cloud Sync |
| msgraph-sdk | ≥1.0.0 | SharePoint Integration |
| azure-identity | ≥1.14.0 | Azure Authentication |

### 1.3 Frontend Tech Stack (TypeScript/React)

| Technologie | Version | Zweck |
|-------------|---------|-------|
| React | 19.2.0 | UI Framework |
| React Router | 7.13.0 | Client-Side Routing |
| TypeScript | ~5.9.3 | Type Safety |
| Vite | 7.2.4 | Build Tool & Dev Server |
| TailwindCSS | 4.1.18 | Utility-First CSS Framework |
| TanStack React Query | 5.90.20 | Server State Management |
| Radix UI | Various | Accessible UI Primitives |
| TinyMCE | 8.3.2 | Rich Text Editor (Klauseln) |
| TipTap | 3.17.1 | Alternative Rich Text Editor |
| dnd-kit | 6.3.1 / 10.0.0 | Drag & Drop (Klausel-Reorder) |
| Framer Motion | 11.18.0 | Animations |
| Lucide React | 0.563.0 | Icon Library |
| i18next | 25.8.0 | Internationalization |
| Zod | 4.3.6 | Schema Validation |
| date-fns | 4.1.0 | Date Utilities |
| DOMPurify | 3.0.8 | HTML Sanitization |
| react-dropzone | 14.3.8 | File Upload |

### 1.4 Infrastruktur

| Komponente | Technologie | Konfiguration |
|------------|-------------|---------------|
| Container | Docker | Multi-Stage Builds |
| Orchestrierung | Docker Compose | dev + prod Configs |
| Datenbank | PostgreSQL 16 Alpine | Port 5432 |
| Cache/Queue | Redis 7 Alpine | Port 6379 |
| Reverse Proxy | - | CORS konfiguriert |

### 1.5 Datenfluss-Diagramm

```
┌────────────┐    ┌─────────────┐    ┌──────────────┐
│  Browser   │───▶│  Frontend   │───▶│   Backend    │
│            │    │  (React)    │    │  (FastAPI)   │
└────────────┘    └─────────────┘    └──────────────┘
                                            │
                        ┌───────────────────┼───────────────────┐
                        │                   │                   │
                        ▼                   ▼                   ▼
                 ┌────────────┐      ┌────────────┐      ┌────────────┐
                 │ PostgreSQL │      │   Redis    │      │  Celery    │
                 │  (Daten)   │      │  (Cache)   │      │  (Tasks)   │
                 └────────────┘      └────────────┘      └────────────┘

DATENFLUSS BEI DOKUMENTGENERIERUNG:
1. User wählt Dokumenttyp im Frontend
2. Frontend lädt Dokumenttyp + Klauseln via GET /api/v1/document-types/{id}
3. User füllt Formular aus
4. Frontend sendet Vorschau-Request an POST /api/v1/preview/html
5. Backend assembliert HTML aus Klauseln + Form-Daten
6. User klickt "Generieren"
7. Frontend sendet POST /api/v1/documents/generate/{id}
8. Backend erstellt DOCX via python-docx
9. Optional: Celery Task konvertiert zu PDF (LibreOffice headless)
10. Dokument wird gespeichert und Download-Link zurückgegeben
```

### 1.6 Global State Management Strategie

**Frontend State:**
- **Server State:** TanStack React Query (Caching, Refetching, Mutations)
- **UI State:** React useState/useReducer (lokaler Komponenten-State)
- **Form State:** Custom Hooks (useDocumentWizard)
- **Context:**
  - `CountryContext` - Aktives Land (DE/IT)
  - `ToastContext` - Benachrichtigungen
  - `UndoContext` - Undo/Redo Stack
  - `ErrorHandlerContext` - Globale Fehlerbehandlung
  - `OnlineStatusContext` - Offline-Detection

**Backend State:**
- **Session State:** JWT Tokens (Access: 60 Min, Refresh: 7 Tage)
- **Cache:** Redis mit TTL (Design Settings: 5 Min, Clauses: 2 Min)
- **Job State:** PostgreSQL (BulkJob, async PDF Tasks)

---

## 2. DATENBANK & DATENMODELLE

### 2.1 Entity-Relationship-Übersicht

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│      User       │       │   DocumentType   │       │     Clause      │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)          │       │ id (PK)         │
│ email (unique)  │       │ name             │       │ title           │
│ password_hash   │       │ country_code     │       │ content_html    │
│ role            │       │ category         │       │ country_code    │
│ country_code    │       │ is_active        │       │ category        │
│ is_active       │       │ description      │       │ version         │
│ created_at      │       │ default_*        │       │ is_active       │
└─────────────────┘       └──────────────────┘       │ approval_status │
                                   │                 └─────────────────┘
                                   │                          │
                                   │ N:M                      │
                                   ▼                          │
                          ┌──────────────────┐               │
                          │DocumentTypeClause│◄──────────────┘
                          ├──────────────────┤
                          │ document_type_id │
                          │ clause_id        │
                          │ display_order    │
                          │ is_mandatory     │
                          │ clause_type      │
                          │ condition (JSON) │
                          │ variant_group    │
                          └──────────────────┘
```

### 2.2 Vollständige Schema-Definitionen

#### 2.2.1 User (Benutzer)

```sql
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR NOT NULL UNIQUE,
    password_hash   VARCHAR NOT NULL,
    role            VARCHAR DEFAULT 'user',      -- 'admin' oder 'user'
    country_code    VARCHAR(2),                   -- 'DE' oder 'IT'
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX ix_users_email ON users(email);
CREATE INDEX ix_users_id ON users(id);
```

**Feldvalidierung:**
- `email`: Muss @ enthalten, unique, nicht leer
- `password_hash`: bcrypt Hash, mindestens 60 Zeichen
- `role`: Enum-artig, nur 'admin' oder 'user'
- `country_code`: 2-stelliger ISO Code, nullable

#### 2.2.2 DesignSetting (Corporate Design)

```sql
CREATE TABLE design_settings (
    id                  SERIAL PRIMARY KEY,
    country_code        VARCHAR(2) NOT NULL UNIQUE,  -- 'DE' oder 'IT'
    company_name        VARCHAR NOT NULL,
    logo_path           VARCHAR,
    header_line1        TEXT,
    header_line2        TEXT,
    header_line3        TEXT,
    footer_line1        TEXT,
    footer_line2        TEXT,
    footer_line3        TEXT,
    font_family         VARCHAR(100) DEFAULT 'Arial',
    primary_color       VARCHAR(7) DEFAULT '#243186',
    colors              JSONB DEFAULT '{}',
    -- DIN 5008 Margins (cm)
    margin_left_cm      VARCHAR(10) DEFAULT '2.5',
    margin_right_cm     VARCHAR(10) DEFAULT '2.0',
    margin_top_cm       VARCHAR(10) DEFAULT '2.5',
    margin_bottom_cm    VARCHAR(10) DEFAULT '2.0',
    header_distance_cm  VARCHAR(10) DEFAULT '1.25',
    footer_distance_cm  VARCHAR(10) DEFAULT '1.0',
    -- Typography
    font_size_pt        INTEGER DEFAULT 11,
    line_spacing        VARCHAR(10) DEFAULT '1.15',
    -- Logo
    logo_width_cm       VARCHAR(10) DEFAULT '5.0',
    logo_position       VARCHAR(20) DEFAULT 'right',  -- 'left', 'center', 'right'
    signatory_name      VARCHAR(200),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**DIN 5008 Standardwerte:**
- Linker Rand: 2.5 cm (Heftrand)
- Rechter Rand: 2.0 cm (min. 1.0 cm)
- Oberer Rand: 2.5 cm
- Unterer Rand: 2.0 cm
- Schriftgröße: 11pt
- Zeilenabstand: 1.15

#### 2.2.3 DocumentType (Dokumentvorlage)

```sql
CREATE TABLE document_types (
    id                          SERIAL PRIMARY KEY,
    name                        VARCHAR NOT NULL,
    country_code                VARCHAR(2) NOT NULL,
    category                    VARCHAR,
    is_active                   BOOLEAN DEFAULT TRUE,
    description                 TEXT,
    -- Standardwerte pro Dokumenttyp (v4.2)
    default_probation_months    INTEGER DEFAULT 6,
    default_notice_period       VARCHAR(100) DEFAULT '4 Wochen zum Monatsende',
    default_vacation_days       INTEGER DEFAULT 30,
    default_weekly_hours        INTEGER DEFAULT 40
);

CREATE INDEX ix_document_types_country_code ON document_types(country_code);
CREATE INDEX ix_document_types_category ON document_types(category);
CREATE INDEX ix_document_types_is_active ON document_types(is_active);
```

**Validierung:**
- `name`: Nicht leer, max. 255 Zeichen
- `country_code`: Enum ['DE', 'IT']
- `default_probation_months`: 0, 3 oder 6
- `default_vacation_days`: 20-40
- `default_weekly_hours`: 10-48

#### 2.2.4 Clause (Textbaustein/Klausel)

```sql
CREATE TABLE clauses (
    id                      SERIAL PRIMARY KEY,
    title                   VARCHAR NOT NULL,
    content_html            TEXT NOT NULL,
    country_code            VARCHAR(2),
    category                VARCHAR,
    version                 INTEGER DEFAULT 1,
    is_active               BOOLEAN DEFAULT TRUE,
    -- Freigabe-Workflow (4-Augen-Prinzip)
    approval_status         VARCHAR(20) DEFAULT 'active',
    approval_requested_at   TIMESTAMP WITH TIME ZONE,
    approval_requested_by   VARCHAR(255),
    approval_reviewed_at    TIMESTAMP WITH TIME ZONE,
    approval_reviewed_by    VARCHAR(255),
    approval_comment        TEXT
);

CREATE INDEX ix_clauses_country_code ON clauses(country_code);
CREATE INDEX ix_clauses_category ON clauses(category);
CREATE INDEX ix_clauses_is_active ON clauses(is_active);
CREATE INDEX ix_clauses_approval_status ON clauses(approval_status);
```

**Approval Status Enum:**
- `draft`: Entwurf (nicht verwendbar)
- `pending`: Zur Prüfung eingereicht
- `approved`: Freigegeben
- `rejected`: Abgelehnt
- `active`: Aktiv und verwendbar

**Content HTML Validierung:**
- Erlaubte Tags: p, br, strong, b, em, i, u, span, h1-h6, ul, ol, li, table, thead, tbody, tr, th, td, div, hr, blockquote, pre, code
- XSS-Schutz durch bleach.clean()

#### 2.2.5 DocumentTypeClause (Zuordnung)

```sql
CREATE TABLE document_type_clauses (
    document_type_id    INTEGER REFERENCES document_types(id),
    clause_id           INTEGER REFERENCES clauses(id),
    display_order       INTEGER NOT NULL,
    is_mandatory        BOOLEAN DEFAULT TRUE,
    clause_type         VARCHAR(20) DEFAULT 'standard',
    is_default_selected BOOLEAN DEFAULT TRUE,
    condition           TEXT,                              -- JSON
    variant_group       VARCHAR(100),
    is_default_variant  BOOLEAN DEFAULT FALSE,
    is_order_locked     BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (document_type_id, clause_id)
);
```

**clause_type Enum:**
- `standard`: Immer im Dokument
- `optional`: User kann an/abwählen
- `conditional`: Wird basierend auf Bedingung eingefügt
- `variant`: Teil einer Varianten-Gruppe

**condition JSON Format:**
```json
{
  "type": "simple",
  "field": "firmenwagen",
  "operator": "=",
  "value": true
}
// ODER für komplexe Bedingungen:
{
  "type": "group",
  "logic": "and",
  "conditions": [
    {"type": "simple", "field": "position", "operator": "=", "value": "Manager"},
    {"type": "simple", "field": "gehalt", "operator": ">=", "value": 50000}
  ]
}
```

**Unterstützte Operatoren:**
- `=`, `!=`: Gleichheit
- `>`, `>=`, `<`, `<=`: Numerischer Vergleich
- `contains`, `startsWith`, `endsWith`: String-Operationen
- `exists`, `notExists`: Existenz-Prüfung
- `in`, `notIn`: Listen-Mitgliedschaft

#### 2.2.6 ClauseVariantGroup (Varianten-Gruppen)

```sql
CREATE TABLE clause_variant_groups (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    country_code    VARCHAR(2) DEFAULT 'DE',
    category        VARCHAR(100),
    base_clause_id  INTEGER REFERENCES clauses(id),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by      VARCHAR(255),
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE INDEX ix_clause_variant_groups_country_code ON clause_variant_groups(country_code);
CREATE INDEX ix_clause_variant_groups_category ON clause_variant_groups(category);
```

#### 2.2.7 ClauseVariant (Einzelne Variante)

```sql
CREATE TABLE clause_variants (
    id                      SERIAL PRIMARY KEY,
    group_id                INTEGER REFERENCES clause_variant_groups(id) NOT NULL,
    clause_id               INTEGER REFERENCES clauses(id) NOT NULL,
    variant_name            VARCHAR(255) NOT NULL,
    variant_code            VARCHAR(50),
    description             TEXT,
    auto_select_condition   TEXT,                  -- JSON
    sort_order              INTEGER DEFAULT 0,
    is_default              BOOLEAN DEFAULT FALSE,
    is_active               BOOLEAN DEFAULT TRUE
);

CREATE INDEX ix_clause_variants_group_id ON clause_variants(group_id);
CREATE INDEX ix_clause_variants_clause_id ON clause_variants(clause_id);
```

#### 2.2.8 GeneratedDocument (Generierte Dokumente)

```sql
CREATE TABLE generated_documents (
    id                  SERIAL PRIMARY KEY,
    document_type_id    INTEGER REFERENCES document_types(id),
    file_path           VARCHAR NOT NULL,
    created_by_id       INTEGER REFERENCES users(id),
    created_by          VARCHAR(255),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retention_date      TIMESTAMP WITH TIME ZONE,
    is_deleted          BOOLEAN DEFAULT FALSE,
    is_archived         BOOLEAN DEFAULT FALSE,
    archived_at         TIMESTAMP WITH TIME ZONE,
    archived_by         VARCHAR(255),
    country_code        VARCHAR(2),
    file_format         VARCHAR(10),              -- 'pdf' oder 'docx'
    title               VARCHAR(255),
    employee_name       VARCHAR(255),
    employee_id         VARCHAR(100),
    form_data           TEXT,                     -- JSON Snapshot
    current_version     INTEGER DEFAULT 1,
    is_correctable      BOOLEAN DEFAULT TRUE
);

CREATE INDEX ix_generated_documents_document_type_id ON generated_documents(document_type_id);
CREATE INDEX ix_generated_documents_created_by_id ON generated_documents(created_by_id);
CREATE INDEX ix_generated_documents_created_at ON generated_documents(created_at);
CREATE INDEX ix_generated_documents_employee_name ON generated_documents(employee_name);
CREATE INDEX ix_generated_documents_employee_id ON generated_documents(employee_id);
CREATE INDEX ix_generated_documents_country_code ON generated_documents(country_code);
CREATE INDEX ix_generated_documents_is_deleted ON generated_documents(is_deleted);
CREATE INDEX ix_generated_documents_is_archived ON generated_documents(is_archived);
```

#### 2.2.9 DocumentDraft (Entwürfe)

```sql
CREATE TABLE document_drafts (
    id                  SERIAL PRIMARY KEY,
    country_code        VARCHAR(2) NOT NULL,
    document_type_id    INTEGER REFERENCES document_types(id),
    user_id             VARCHAR(255) NOT NULL,
    name                VARCHAR(255),
    form_data           TEXT NOT NULL,            -- JSON
    custom_clauses      TEXT,                     -- JSON
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_document_drafts_country_code ON document_drafts(country_code);
CREATE INDEX ix_document_drafts_document_type_id ON document_drafts(document_type_id);
CREATE INDEX ix_document_drafts_user_id ON document_drafts(user_id);
```

**TTL-Verhalten:**
- Entwürfe werden nach 30 Tagen automatisch gelöscht
- `expires_at` = `created_at` + 30 Tage
- User kann TTL durch "Refresh" zurücksetzen

#### 2.2.10 FormField (Dynamische Formularfelder)

```sql
CREATE TABLE form_fields (
    id                      SERIAL PRIMARY KEY,
    document_type_id        INTEGER REFERENCES document_types(id) ON DELETE CASCADE,
    field_name              VARCHAR(100) NOT NULL,
    field_label             VARCHAR(255) NOT NULL,
    field_type              VARCHAR(50) DEFAULT 'text',
    is_required             BOOLEAN DEFAULT FALSE,
    default_value           TEXT,
    options                 TEXT,                     -- JSON für Select
    validation              TEXT,                     -- JSON
    display_order           INTEGER,
    display_group           VARCHAR(100),
    source_clause_id        INTEGER REFERENCES clauses(id),
    help_text               TEXT,
    placeholder_text        VARCHAR(255),
    suffix                  VARCHAR(50),
    prefix                  VARCHAR(50),
    min_value               INTEGER,
    max_value               INTEGER,
    min_length              INTEGER,
    max_length              INTEGER,
    pattern                 VARCHAR(255),
    pattern_error_message   VARCHAR(255),
    show_condition          TEXT,                     -- JSON
    is_system_field         BOOLEAN DEFAULT FALSE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ix_form_fields_document_type_id ON form_fields(document_type_id);
CREATE INDEX ix_form_fields_field_name ON form_fields(field_name);
```

**field_type Enum:**
- `text`: Einzeiliges Textfeld
- `textarea`: Mehrzeiliges Textfeld
- `number`: Numerisches Feld
- `date`: Datumsfeld
- `email`: E-Mail-Feld mit Validierung
- `select`: Dropdown-Auswahl
- `checkbox`: Checkbox (Boolean)

#### 2.2.11 Attachment (Anlagen)

```sql
CREATE TABLE attachments (
    id              SERIAL PRIMARY KEY,
    country_code    VARCHAR(2) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    file_path       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(10) NOT NULL,         -- 'pdf' oder 'docx'
    file_size_bytes INTEGER,
    page_count      INTEGER,
    category        VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by     VARCHAR(255)
);

CREATE INDEX ix_attachments_country_code ON attachments(country_code);
CREATE INDEX ix_attachments_category ON attachments(category);
CREATE INDEX ix_attachments_is_active ON attachments(is_active);
```

#### 2.2.12 BulkJob (Massengenerierung)

```sql
CREATE TABLE bulk_jobs (
    id                  SERIAL PRIMARY KEY,
    status              VARCHAR DEFAULT 'PENDING',
    total_records       INTEGER DEFAULT 0,
    processed_records   INTEGER DEFAULT 0,
    result_file_path    VARCHAR,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_id       INTEGER REFERENCES users(id)
);

CREATE INDEX ix_bulk_jobs_status ON bulk_jobs(status);
CREATE INDEX ix_bulk_jobs_created_at ON bulk_jobs(created_at);
CREATE INDEX ix_bulk_jobs_created_by_id ON bulk_jobs(created_by_id);
```

**status Enum:**
- `PENDING`: Warte auf Verarbeitung
- `PROCESSING`: In Bearbeitung
- `COMPLETED`: Erfolgreich abgeschlossen
- `FAILED`: Fehlgeschlagen
- `CANCELLED`: Abgebrochen

#### 2.2.13 AuditLog (Protokollierung)

```sql
CREATE TABLE audit_logs (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id         VARCHAR(255) NOT NULL,
    user_email      VARCHAR(255),
    user_name       VARCHAR(255),
    ip_address      VARCHAR(45),
    action          VARCHAR(100) NOT NULL,
    action_category VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       INTEGER,
    entity_name     VARCHAR(255),
    description     TEXT,
    old_value       TEXT,                         -- JSON
    new_value       TEXT,                         -- JSON
    extra_metadata  TEXT,                         -- JSON
    country_code    VARCHAR(2),
    document_type_id INTEGER,
    session_id      VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'success',
    error_message   TEXT
);

CREATE INDEX ix_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX ix_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX ix_audit_logs_action ON audit_logs(action);
CREATE INDEX ix_audit_logs_action_category ON audit_logs(action_category);
CREATE INDEX ix_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX ix_audit_logs_country_code ON audit_logs(country_code);
```

**action_category Enum:**
- `document`: Dokumenten-Aktionen
- `clause`: Klausel-Aktionen
- `form_field`: Formularfeld-Aktionen
- `user`: Benutzer-Aktionen
- `bulk`: Massen-Aktionen
- `system`: System-Aktionen

#### 2.2.14 Weitere Tabellen (Kurzübersicht)

| Tabelle | Zweck |
|---------|-------|
| `user_sessions` | Aktiver Country-Context pro User |
| `clause_versions` | Versions-Historie für Klauseln |
| `clause_notes` | Interne Notizen zu Klauseln |
| `company_settings` | Stammdaten pro Land |
| `document_deadlines` | Fristen-Tracking |
| `deadline_field_mappings` | Frist-Feld-Zuordnung |
| `works_council_templates` | Betriebsrat-Vorlagen |
| `works_council_notifications` | BR-Mitteilungen |
| `document_shares` | Temporäre Share-Links |
| `user_favorites` | User-Favoriten |
| `teams` | Team-Verwaltung |
| `team_members` | Team-Mitgliedschaft |
| `team_document_shares` | Team-Dokument-Sharing |
| `document_versions` | Dokument-Versionen |
| `document_correction_requests` | Korrektur-Anträge |
| `notifications` | User-Benachrichtigungen |
| `notification_preferences` | Benachrichtigungs-Einstellungen |
| `search_history` | Suchverlauf |
| `retention_policies` | Aufbewahrungsrichtlinien |
| `cloud_sync_config` | Cloud-Sync Konfiguration |
| `custom_clause_templates` | Individualvereinbarungen |
| `document_type_attachments` | Dokumenttyp-Anlagen |
| `document_type_variant_groups` | Dokumenttyp-Varianten |
| `document_clause_instances` | Klausel-Instanzen (Composer) |

---

## 3. KOMPLETTE MENÜSTRUKTUR & NAVIGATION

### 3.1 Frontend Routing (React Router)

```
/                           → Dashboard
/generate                   → Document Generator (Wizard)
/bulk                       → Bulk Upload
/composer                   → Redirect zu /generate
/composer/:draftId          → Redirect zu /generate?draft=:draftId
/documents                  → Repository (Dokumenten-Archiv)
/documents/:documentId      → Document Detail
/search                     → Volltextsuche
/teams                      → Team-Verwaltung
/deadlines                  → Fristen-Kalender
/notifications              → Benachrichtigungen
/settings                   → Settings Hub (Tabs)
/settings?tab=general       → Firmendaten
/settings?tab=design        → Design-Manager
/settings?tab=templates     → Dokumenttypen
/settings?tab=clauses       → Textbausteine
/settings?tab=advanced      → Erweiterte Einstellungen
  &section=users            → Benutzer
  &section=approvals        → Freigaben
  &section=attachments      → Anlagen
  &section=form-fields      → Formularfelder
  &section=designer         → Layout-Editor
  &section=preview          → Vorschau
  &section=works-council    → Betriebsrat
  &section=retention        → Aufbewahrung
  &section=audit            → Protokoll
/admin/*                    → Redirects zu /settings
*                           → 404 NotFound
```

### 3.2 Sidebar Navigation (Hauptmenü)

Die Sidebar enthält nur 4 Hauptpunkte plus Favoriten:

```
┌────────────────────────────────────────┐
│         niederwieser                    │
│    Flexible Food Packaging              │
│    ─────────────────────                │
│    HR-Dokumentensystem                  │
├────────────────────────────────────────┤
│                                         │
│  📊 Dashboard                           │
│     Übersicht & Fristen                 │
│     → /                                 │
│                                         │
│  📄 Neues Dokument                      │
│     Vertrag erstellen                   │
│     → /generate                         │
│                                         │
│  📁 Meine Dokumente                     │
│     Archiv & Suche                      │
│     → /documents                        │
│                                         │
│  ⚙️ Einstellungen                       │
│     Vorlagen & Design                   │
│     → /settings                         │
│                                         │
├────────────────────────────────────────┤
│  ⭐ Favoriten                           │
│     [Dynamisch: User-Favoriten]         │
├────────────────────────────────────────┤
│  ⌨️ Tastaturkürzel: ?                   │
├────────────────────────────────────────┤
│  👤 [User Dropdown]                     │
│     🌍 Land wechseln                    │
│     🔔 Benachrichtigungen               │
│     🚪 Abmelden                         │
└────────────────────────────────────────┘
```

### 3.3 Settings Hub Tab-Struktur

```
┌─────────────────────────────────────────────────────────────────┐
│ Einstellungen                                                   │
│ Verwalten Sie Firmendaten, Design, Vorlagen und Textbausteine.  │
├─────────────────────────────────────────────────────────────────┤
│ [🏢 Allgemein] [🎨 Design] [📄 Vorlagen] [📖 Textbausteine] [⚙️ Erweitert] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TAB: Allgemein (?tab=general)                                   │
│ ├── CompanySettingsPage                                         │
│ │   ├── Firmenname                                              │
│ │   ├── Adresse (Straße, PLZ, Ort)                              │
│ │   ├── Geschäftsführer                                         │
│ │   ├── Handelsregister                                         │
│ │   ├── USt-IdNr.                                               │
│ │   ├── Logo Upload                                             │
│ │   └── Standard-Werte (Probezeit, Kündigungsfrist, etc.)       │
│                                                                 │
│ TAB: Design (?tab=design)                                       │
│ ├── DesignManager                                               │
│ │   ├── Primärfarbe (Color Picker)                              │
│ │   ├── Schriftfamilie (Dropdown)                               │
│ │   ├── Header-Zeilen (1-3)                                     │
│ │   ├── Footer-Zeilen (1-3)                                     │
│ │   ├── DIN 5008 Einstellungen                                  │
│ │   │   ├── Ränder (links, rechts, oben, unten)                 │
│ │   │   ├── Schriftgröße (pt)                                   │
│ │   │   └── Zeilenabstand                                       │
│ │   └── Logo-Einstellungen (Breite, Position)                   │
│                                                                 │
│ TAB: Vorlagen (?tab=templates)                                  │
│ ├── DocumentTypesManager                                        │
│ │   ├── Liste aller Dokumenttypen                               │
│ │   ├── Filter nach Land, Kategorie, Status                     │
│ │   ├── Erstellen / Bearbeiten / Duplizieren / Löschen          │
│ │   └── DocumentTypeEditor Modal                                │
│ │       ├── Name, Beschreibung                                  │
│ │       ├── Land, Kategorie                                     │
│ │       ├── Standardwerte                                       │
│ │       ├── Klausel-Zuordnung (Drag & Drop)                     │
│ │       └── Varianten-Gruppen-Zuordnung                         │
│                                                                 │
│ TAB: Textbausteine (?tab=clauses)                               │
│ ├── ClausesPage                                                 │
│ │   ├── Liste aller Klauseln                                    │
│ │   ├── Filter nach Land, Kategorie, Status                     │
│ │   ├── Suche nach Titel/Inhalt                                 │
│ │   ├── Erstellen / Bearbeiten / Löschen                        │
│ │   └── ClauseEditor Modal                                      │
│ │       ├── Titel                                               │
│ │       ├── TinyMCE Rich Text Editor                            │
│ │       ├── Land, Kategorie                                     │
│ │       ├── Freigabe-Status                                     │
│ │       ├── Versions-Historie                                   │
│ │       └── Notizen                                             │
│                                                                 │
│ TAB: Erweitert (?tab=advanced)                                  │
│ ├── Sub-Navigation (Buttons)                                    │
│ │   ├── [👥 Benutzer] → UsersPage                               │
│ │   ├── [✓ Freigaben] → ClauseApprovalQueue                     │
│ │   ├── [📎 Anlagen] → AttachmentsPage                          │
│ │   ├── [📝 Formularfelder] → FormFieldsManager                 │
│ │   ├── [📐 Layout-Editor] → DocumentDesigner                   │
│ │   ├── [👁 Vorschau] → TemplatePreviewPage                     │
│ │   ├── [👔 Betriebsrat] → WorksCouncilTemplatesPage            │
│ │   ├── [🗄 Aufbewahrung] → RetentionPoliciesPage               │
│ │   └── [🛡 Protokoll] → AuditLogPage                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Interaktionsmatrix (Button → Aktion)

| Page | Element | Event | Aktion |
|------|---------|-------|--------|
| **Dashboard** | | | |
| | "Neues Dokument" Tile | Click | Navigate → `/generate` |
| | "Dokumente" Tile | Click | Navigate → `/documents` |
| | "Fristen" Tile | Click | Navigate → `/deadlines` |
| | Aktivitäts-Chart | - | Zeigt Dokument-Statistiken der letzten 7 Tage |
| | Draft Card | Click | Navigate → `/generate?draft={id}` |
| | Draft "Löschen" | Click | DELETE `/api/v1/drafts/{id}` + Refresh |
| **DocumentGenerator** | | | |
| | Dokumenttyp-Card | Click | `setDocumentTypeId(id)` + Enter Split-Screen |
| | Favorit-Stern | Click | POST/DELETE `/api/v1/favorites` |
| | "Weiter" Button | Click | Switch to Split-Screen Editor |
| | Formular-Feld | Change | `updateFormData(field, value)` |
| | "Vorschau" Tab | Click | POST `/api/v1/preview/html` + Render iframe |
| | "Speichern" Button | Click | POST/PUT `/api/v1/drafts` |
| | "Generieren" Button | Click | POST `/api/v1/documents/generate/{id}` |
| | Format Toggle | Click | `setOutputFormat('pdf'/'docx')` |
| **Repository** | | | |
| | Suchfeld | Input | Debounced Search (500ms) |
| | Filter-Dropdown | Change | Update Query Params + Refetch |
| | Document Row | Click | Navigate → `/documents/{id}` |
| | "Download" Icon | Click | GET `/api/v1/documents/{id}/download` |
| | "Teilen" Icon | Click | Open Share Dialog |
| | "Korrektur" Icon | Click | Navigate → `/generate?correction={id}` |
| **Settings Hub** | | | |
| | Tab | Click | `setActiveTab(tabId)` + Update URL |
| | Advanced Section | Click | `setAdvancedSection(sectionId)` |
| | "Speichern" Button | Click | PUT Endpoint + Toast "Gespeichert" |
| | "Erstellen" Button | Click | Open Create Modal |
| | "Bearbeiten" Icon | Click | Open Edit Modal with Data |
| | "Löschen" Icon | Click | Confirm Dialog → DELETE Endpoint |

---

## 4. DETAILLIERTE FUNKTIONSBESCHREIBUNG

### 4.1 Dashboard (`/`)

**Komponente:** `pages/Dashboard.tsx`

**Zweck:** Übersichtsseite mit Quick-Actions, Statistiken und Entwürfen.

#### 4.1.1 Datenladung

```typescript
// useEffect on Mount
GET /api/v1/statistics/dashboard
→ Response: {
    documents_created_today: number,
    documents_created_week: number,
    pending_drafts: number,
    pending_approvals: number,
    upcoming_deadlines: number
}

GET /api/v1/drafts
→ Response: [{
    id: number,
    document_type_id: number,
    document_type_name: string,
    name: string,
    country_code: string,
    created_at: string,
    updated_at: string,
    expires_at: string,
    days_remaining: number,
    status: "draft"
}]
```

#### 4.1.2 Quick Access Tiles

**Layout:**
```
┌──────────────┬──────────────┬──────────────┐
│ 📄 Neues     │ 📁 Meine     │ 📅 Fristen   │
│   Dokument   │   Dokumente  │   (Badge: N) │
│              │              │              │
│ Arbeitsvertrag│ Alle ansehen│ Kalender     │
│ erstellen    │              │ öffnen       │
└──────────────┴──────────────┴──────────────┘
```

**Interaktion:**
- Tile Click → `navigate(href)`
- Badge zeigt Anzahl offener Fristen

#### 4.1.3 Aktivitäts-Chart

**Daten:** Letzte 7 Tage Dokumenterstellung
```typescript
// Aggregiert aus /api/v1/statistics/activity
data = [
    { day: "Mo", count: 5 },
    { day: "Di", count: 3 },
    // ...
]
```

**Rendering:** SVG Bar Chart mit TailwindCSS

#### 4.1.4 Entwürfe-Liste

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📝 Meine Entwürfe                                           │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Arbeitsvertrag (Vollzeit) - Max Mustermann              │ │
│ │ Zuletzt bearbeitet: vor 2 Tagen                         │ │
│ │ Läuft ab in: 28 Tagen                                   │ │
│ │                                    [Fortsetzen] [🗑]    │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Interaktion:**
- "Fortsetzen" → `navigate('/generate?draft=' + id)`
- 🗑 Icon → Confirm Dialog → `DELETE /api/v1/drafts/{id}`

#### 4.1.5 Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Keine Entwürfe | Zeige "Keine Entwürfe vorhanden" mit CTA |
| Entwurf läuft bald ab (< 7 Tage) | Gelbe Warnung Badge |
| API Fehler | Toast "Daten konnten nicht geladen werden" |
| Offline | Cached Data anzeigen + Offline-Banner |

---

### 4.2 Document Generator (`/generate`)

**Komponente:** `pages/DocumentGenerator.tsx` → `components/generator/DocumentWizard.tsx`

**Zweck:** Wizard-basierte Dokumenterstellung in 5 Schritten.

#### 4.2.1 Wizard-Ablauf

```
SCHRITT 1: Dokumenttyp wählen
    ↓ (Click auf Dokumenttyp-Card)
SCHRITT 2: Split-Screen Editor
    ├── Links: Formular-Panel
    │   ├── Mitarbeiterdaten
    │   ├── Vertragsdetails
    │   ├── Klausel-Anpassung (optional)
    │   └── Export-Optionen
    └── Rechts: Live-Vorschau (iframe)
    ↓ (Click "Generieren")
DOWNLOAD: PDF/DOCX wird heruntergeladen
```

#### 4.2.2 Schritt 1: Dokumenttyp-Auswahl

**Komponente:** `StepDocumentType.tsx`

**Datenladung:**
```typescript
GET /api/v1/document-types/?country_code={activeCountry}
→ Response: [{
    id: number,
    name: string,
    country_code: string,
    category: string,
    is_active: boolean,
    description: string,
    default_probation_months: number,
    default_notice_period: string,
    default_vacation_days: number,
    default_weekly_hours: number
}]
```

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Neues Dokument erstellen                                    │
│ Wählen Sie einen Dokumenttyp aus.                           │
├─────────────────────────────────────────────────────────────┤
│ Kategorie: [Alle ▼] [Arbeitsverträge ▼] [Kündigungen ▼]     │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐  ┌───────────────────┐                │
│ │ ⭐ 📄              │  │ 📄                │                │
│ │ Arbeitsvertrag    │  │ Arbeitsvertrag    │                │
│ │ (Vollzeit)        │  │ (Teilzeit)        │                │
│ │                   │  │                   │                │
│ │ Probezeit: 6 Mon. │  │ Probezeit: 6 Mon. │                │
│ │ Urlaub: 30 Tage   │  │ Urlaub: 25 Tage   │                │
│ └───────────────────┘  └───────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Interaktion:**
- Card Click: `setDocumentTypeId(id)` → Lade Klauseln → Wechsel zu Split-Screen
- Stern Click: Toggle Favorit via `POST/DELETE /api/v1/favorites`

#### 4.2.3 Split-Screen Editor

**Komponente:** `SplitScreenEditor.tsx`

**Layout:**
```
┌──────────────────────────────┬──────────────────────────────┐
│      FORMULAR (40%)          │      VORSCHAU (60%)          │
├──────────────────────────────┼──────────────────────────────┤
│ [📋 Daten] [📜 Klauseln]     │                              │
│                              │  ┌────────────────────────┐  │
│ ══ Mitarbeiterdaten ══       │  │                        │  │
│                              │  │     A R B E I T S      │  │
│ Vorname: [____________]      │  │     V E R T R A G      │  │
│                              │  │                        │  │
│ Nachname: [___________]      │  │ Zwischen               │  │
│                              │  │ Niederwieser GmbH      │  │
│ Geburtsdatum: [📅_____]      │  │ Gewerbepark 9          │  │
│                              │  │ 87477 Sulzberg         │  │
│ ══ Vertragsdaten ══          │  │                        │  │
│                              │  │ und                    │  │
│ Eintrittsdatum: [📅___]      │  │ Herr/Frau Max Muster   │  │
│                              │  │                        │  │
│ Position: [___________]      │  │ § 1 Tätigkeit          │  │
│                              │  │ Der Arbeitnehmer...    │  │
│ Monatsgehalt: [____] €       │  │                        │  │
│                              │  │ § 2 Arbeitszeit        │  │
│ Wochenstunden: [40___]       │  │ Die regelmäßige...     │  │
│                              │  │                        │  │
│ ☐ Firmenwagen                │  │ ...                    │  │
│ ☐ Home-Office                │  │                        │  │
│                              │  └────────────────────────┘  │
│ ══ Export ══                 │                              │
│                              │  [🔄 Aktualisieren]          │
│ Unterzeichner: [Geschäftsf.] │                              │
│ Format: ○ PDF  ○ DOCX        │                              │
│                              │                              │
│ [💾 Speichern] [▶ Generieren]│                              │
└──────────────────────────────┴──────────────────────────────┘
```

#### 4.2.4 Formular-Rendering

**Dynamische Felder laden:**
```typescript
GET /api/v1/form-fields?document_type_id={id}
→ Response: [{
    id: number,
    field_name: string,
    field_label: string,
    field_type: "text" | "number" | "date" | "email" | "select" | "checkbox" | "textarea",
    is_required: boolean,
    default_value: string,
    options: string,  // JSON für Select
    help_text: string,
    placeholder_text: string,
    suffix: string,
    prefix: string,
    min_value: number,
    max_value: number,
    display_order: number,
    display_group: string,
    show_condition: string  // JSON
}]
```

**Feld-Rendering-Logik:**
```typescript
function renderField(field: FormField) {
    // 1. Prüfe show_condition
    if (field.show_condition) {
        const condition = JSON.parse(field.show_condition);
        if (!evaluateCondition(condition, formData)) {
            return null;  // Feld ausblenden
        }
    }

    // 2. Render nach field_type
    switch (field.field_type) {
        case "text":
            return <Input
                value={formData[field.field_name]}
                onChange={(e) => updateFormData(field.field_name, e.target.value)}
                placeholder={field.placeholder_text}
                required={field.is_required}
            />;
        case "number":
            return <Input
                type="number"
                min={field.min_value}
                max={field.max_value}
                suffix={field.suffix}
                // ...
            />;
        case "date":
            return <DatePicker
                value={formData[field.field_name]}
                onChange={(date) => updateFormData(field.field_name, date)}
            />;
        case "select":
            const options = JSON.parse(field.options);
            return <Select options={options} /* ... */ />;
        case "checkbox":
            return <Checkbox
                checked={formData[field.field_name]}
                onCheckedChange={(v) => updateFormData(field.field_name, v)}
            />;
        // ...
    }
}
```

#### 4.2.5 Live-Vorschau

**Triggering:**
- Debounced (500ms) nach jeder Formular-Änderung
- Manuell via "Aktualisieren" Button

**Request:**
```typescript
POST /api/v1/preview/html
Content-Type: application/json

{
    "document_type_id": 1,
    "form_data": {
        "vorname": "Max",
        "nachname": "Mustermann",
        "eintrittsdatum": "2026-04-01",
        "position": "Software-Entwickler",
        "monatsgehalt": 5500,
        "wochenstunden": 40,
        "firmenwagen": false,
        "homeoffice": true
    },
    "custom_clause": null
}

→ Response: HTML String (wird in iframe gerendert)
```

**Vorschau-Algorithmus (Backend):**
1. Lade Design-Settings für Country (mit Cache)
2. Lade Klauseln für DocumentType (mit Cache)
3. Für jede Klausel:
   - Parse `condition` JSON
   - Evaluiere Bedingung gegen `form_data`
   - Wenn erfüllt: Sanitize HTML, Replace Placeholders
4. Assembliere Full-Document HTML mit:
   - Logo Header
   - Titel (Arbeitsvertrag / CONTRATTO DI LAVORO)
   - Vertragsparteien-Block
   - Klausel-Inhalt
   - Signatur-Block

#### 4.2.6 Placeholder-Ersetzung

**Pattern:** `{{ placeholder }}` oder `[placeholder]`

**Algorithmus:**
```python
def render_placeholders(content: str, form_data: dict, country_code: str) -> str:
    def replace_match(match):
        placeholder = match.group(1).strip()
        value = form_data.get(placeholder)

        if value is None:
            return f"[{placeholder}]"  # Nicht ersetzen

        # Datum formatieren
        if "datum" in placeholder.lower():
            return format_date_localized(value, country_code)
            # DE: "01. Januar 2026"
            # IT: "1 gennaio 2026"

        # Währung formatieren
        if "gehalt" in placeholder.lower() or "betrag" in placeholder.lower():
            return format_currency_localized(float(value), country_code)
            # "5.500,00 EUR"

        return str(value)

    content = re.sub(r"\{\{\s*(\w+)\s*\}\}", replace_match, content)
    content = re.sub(r"\[(\w+)\]", replace_match, content)
    return content
```

#### 4.2.7 Dokument-Generierung

**Request:**
```typescript
POST /api/v1/documents/generate/{document_type_id}
Content-Type: application/json

{
    "signatory_name": "Matthias Schweizer",  // PFLICHT
    "vorname": "Max",
    "nachname": "Mustermann",
    "eintrittsdatum": "2026-04-01",
    // ... alle Formularfelder
    "output_format": "pdf",
    "attachment_ids": [1, 3],
    "async_pdf": false
}

→ Response (sync): FileResponse (Binary PDF/DOCX)
→ Response (async): { "job_id": "uuid", "status": "pending", "message": "..." }
```

**Backend-Algorithmus:**
```python
async def generate_document_by_type(document_type_id, request_data, current_user, db):
    # 1. Lade DocumentType
    doc_type = await db.get(DocumentType, document_type_id)
    if not doc_type or not doc_type.is_active:
        raise HTTPException(404, "Dokumenttyp nicht gefunden")

    country_code = doc_type.country_code or "DE"

    # 2. Lade Design Settings
    design = await db.execute(
        select(DesignSetting).where(DesignSetting.country_code == country_code)
    ).scalar_one_or_none()

    design_settings = {
        "company_name": design.company_name,
        "logo_path": design.logo_path,
        "signatory_name": request_data.signatory_name,  # PFLICHT
        # DIN 5008 Einstellungen
        "margin_left_cm": float(design.margin_left_cm or 2.5),
        "margin_right_cm": float(design.margin_right_cm or 2.0),
        # ...
    }

    # 3. Lade Klauseln
    clause_refs = await db.execute(
        select(DocumentTypeClause)
        .where(DocumentTypeClause.document_type_id == document_type_id)
        .order_by(DocumentTypeClause.display_order)
    ).scalars().all()

    # 4. Filter Klauseln nach Bedingungen
    form_data = request_data.model_dump(exclude={"output_format", ...})
    active_clauses = []
    for ref in clause_refs:
        clause = await db.get(Clause, ref.clause_id)
        if clause and clause.is_active:
            condition = json.loads(ref.condition) if ref.condition else None
            if evaluate_condition(condition, form_data):
                active_clauses.append({
                    "id": clause.id,
                    "title": clause.title,
                    "content": clause.content_html,
                    "is_mandatory": ref.is_mandatory,
                })

    # 5. Generiere DOCX
    output_path = OUTPUT_DIR / f"Vertrag_{nachname}.docx"
    create_document_from_clauses(
        clauses=active_clauses,
        form_data=form_data,
        country_code=country_code,
        design_settings=design_settings,
        output_path=output_path
    )

    # 6. Optional: Konvertiere zu PDF
    if request_data.output_format == "pdf":
        if request_data.async_pdf:
            # Async via Celery
            job_id = str(uuid.uuid4())
            convert_docx_to_pdf.delay(str(output_path), job_id, cleanup_docx=True)
            return AsyncJobResponse(job_id=job_id, status="pending")
        else:
            # Sync (LibreOffice headless)
            output_path = engine.convert_to_pdf(output_path)

    return FileResponse(output_path, ...)
```

#### 4.2.8 DOCX-Erstellung (DIN 5008)

**Funktion:** `create_document_from_clauses()`

**Schritte:**
1. Erstelle leeres Document()
2. Setze Page Format (A4, Margins gemäß DIN 5008)
3. Setze Styles (Font Family, Size, Line Spacing)
4. Füge Logo in Header ein (rechtsbündig)
5. Füge Titel ein (zentriert, 16pt, fett)
6. Füge "Zwischen" / "Tra" Block ein
7. Füge Arbeitgeber-Info ein (Firmenname, Adresse)
8. Füge Arbeitgeber-Label ein (kursiv)
9. Füge "und" / "e" ein
10. Füge Arbeitnehmer-Info ein (Name, optional Adresse)
11. Füge Arbeitnehmer-Label ein (kursiv)
12. Für jede Klausel:
    - Konvertiere HTML zu DOCX-Paragraphs
    - § Titel zentriert und fett
    - Inhalt im Blocksatz
13. Füge Signatur-Tabelle ein
14. Speichere Document

#### 4.2.9 Edge Cases

| Szenario | Verhalten |
|----------|-----------|
| Keine Dokumenttypen vorhanden | Zeige Hinweis + Link zu /settings?tab=templates |
| Pflichtfeld leer | Button "Generieren" deaktiviert + Feld rot markiert |
| Vorschau-API Fehler | Toast "Vorschau nicht verfügbar" + letzte Vorschau behalten |
| PDF-Konvertierung fehlgeschlagen | Toast mit Fehlermeldung + DOCX anbieten |
| Signatory fehlt | 400 Bad Request "signatory_name ist Pflichtfeld" |
| Klausel-Bedingung fehlerhaft | Klausel wird inkludiert (fail-safe) |

---

### 4.3 Repository / Meine Dokumente (`/documents`)

**Komponente:** `pages/Repository.tsx`

**Zweck:** Archiv aller generierten Dokumente mit Suche und Filter.

#### 4.3.1 Datenladung

```typescript
GET /api/v1/repository?
    country_code={country}&
    search={query}&
    document_type_id={typeId}&
    date_from={from}&
    date_to={to}&
    page={page}&
    limit={limit}

→ Response: {
    items: [{
        id: number,
        title: string,
        document_type_name: string,
        employee_name: string,
        employee_id: string,
        created_at: string,
        created_by: string,
        country_code: string,
        file_format: string,
        current_version: number,
        is_correctable: boolean
    }],
    total: number,
    page: number,
    pages: number
}
```

#### 4.3.2 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Meine Dokumente                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [🔍 Suche: Name, Personalnr...] [Dokumenttyp ▼] [Zeitraum ▼]   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 Arbeitsvertrag (Vollzeit) - Max Mustermann              │ │
│ │    Erstellt: 15.01.2026 | Version 1 | PDF                  │ │
│ │                                    [⬇] [📤] [✏] [🗑]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📄 Kündigung - Maria Schmidt                               │ │
│ │    Erstellt: 14.01.2026 | Version 2 | PDF                  │ │
│ │                                    [⬇] [📤] [✏] [🗑]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Seite 1 von 5  [<] [1] [2] [3] [4] [5] [>]                     │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Aktionen

| Icon | Aktion | Endpoint |
|------|--------|----------|
| ⬇ | Download | GET `/api/v1/documents/{id}/download` |
| 📤 | Teilen | POST `/api/v1/documents/{id}/share` |
| ✏ | Korrektur | Navigate → `/generate?correction={id}` |
| 🗑 | Löschen | DELETE `/api/v1/repository/{id}` (Soft Delete) |

---

### 4.4 Bulk Upload (`/bulk`)

**Komponente:** `pages/BulkUpload.tsx`

**Zweck:** Massengenerierung von Dokumenten aus CSV/Excel.

#### 4.4.1 Workflow

```
1. Dokumenttyp wählen
    ↓
2. Template herunterladen (optional)
    ↓
3. Datei hochladen (CSV oder XLSX)
    ↓
4. Validierung (automatisch)
    ├── Spalten-Mapping prüfen
    ├── Pflichtfelder prüfen
    └── Datentypen prüfen
    ↓
5. Vorschau der ersten 5 Zeilen
    ↓
6. Generierung starten
    ↓
7. Progress-Anzeige
    ↓
8. Download ZIP
```

#### 4.4.2 Validierungs-API

```typescript
POST /api/v1/bulk/validate?document_type_id={id}
Content-Type: multipart/form-data
file: [CSV oder XLSX Datei]

→ Response: {
    is_valid: boolean,
    row_count: number,
    column_count: number,
    errors: string[],
    warnings: string[],
    field_errors: [{
        row: number,
        column: string,
        value: string,
        error: string
    }],
    preview_data: [{...}],  // Erste 5 Zeilen
    detected_columns: string[],
    missing_required_columns: string[],
    unknown_columns: string[]
}
```

#### 4.4.3 Generierungs-API

```typescript
POST /api/v1/bulk/generate?document_type_id={id}&signatory_name={name}
Content-Type: multipart/form-data
file: [CSV oder XLSX Datei]
output_format: "pdf" | "docx"

→ Response: {
    job_id: number,
    status: "queued",
    total_records: number
}
```

#### 4.4.4 Progress Polling

```typescript
GET /api/v1/bulk/jobs/{job_id}

→ Response: {
    id: number,
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED",
    total_records: number,
    processed_records: number,
    progress_percent: number,
    result_file_path: string,
    created_at: string
}
```

---

## 5. API & SCHNITTSTELLEN

### 5.1 Authentifizierung

#### 5.1.1 Login

```
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=admin@example.com&password=geheim123

→ Success (200):
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer"
}

→ Error (401):
{
    "detail": "Incorrect email or password"
}
```

**Token-Verwendung:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Token-Konfiguration:**
- Algorithm: HS256
- Access Token Expiry: 60 Minuten
- Refresh Token Expiry: 7 Tage

### 5.2 Document Types API

#### 5.2.1 Liste abrufen

```
GET /api/v1/document-types/?country_code=DE&skip=0&limit=100

→ Response:
[{
    "id": 1,
    "name": "Arbeitsvertrag (Vollzeit)",
    "country_code": "DE",
    "category": "Arbeitsverträge",
    "is_active": true,
    "description": "Standard-Arbeitsvertrag für Vollzeitkräfte",
    "default_probation_months": 6,
    "default_notice_period": "4 Wochen zum Monatsende",
    "default_vacation_days": 30,
    "default_weekly_hours": 40,
    "clauses": [...]
}]
```

#### 5.2.2 Einzelnen Typ abrufen

```
GET /api/v1/document-types/{id}

→ Response: { ... DocumentType }
```

#### 5.2.3 Mit Varianten-Gruppen

```
GET /api/v1/document-types/{id}/with-variant-groups

→ Response:
{
    "id": 1,
    "name": "...",
    // ... Standard-Felder
    "variant_groups": [{
        "id": 5,
        "variant_group_id": 2,
        "variant_group_name": "Kündigungsfristen",
        "display_order": 3,
        "is_mandatory": true,
        "default_variant_id": 7,
        "effective_default_id": 7,
        "variant_count": 3,
        "variants": [{
            "id": 7,
            "variant_name": "3 Monate (Standard)",
            "variant_code": "A",
            "is_default": true,
            "clause_id": 15
        }, ...]
    }]
}
```

#### 5.2.4 Erstellen

```
POST /api/v1/document-types/
Content-Type: application/json
Authorization: Bearer {token}  (Admin required)

{
    "name": "Neuer Dokumenttyp",
    "country_code": "DE",
    "category": "Sonstige",
    "is_active": true,
    "description": "Beschreibung...",
    "default_probation_months": 6,
    "default_notice_period": "4 Wochen zum Monatsende",
    "default_vacation_days": 30,
    "default_weekly_hours": 40,
    "clauses": [
        {"clause_id": 1, "display_order": 1, "is_mandatory": true},
        {"clause_id": 2, "display_order": 2, "is_mandatory": false}
    ],
    "variant_groups": [
        {"variant_group_id": 2, "display_order": 3, "is_mandatory": true, "default_variant_id": 7}
    ]
}

→ Response: { ...created DocumentType }
```

#### 5.2.5 Aktualisieren

```
PUT /api/v1/document-types/{id}
Content-Type: application/json
Authorization: Bearer {token}  (Admin required)

{
    "name": "Geänderter Name",
    "clauses": [...],  // Ersetzt alle Klausel-Zuordnungen
    "variant_groups": [...]  // Ersetzt alle Varianten-Zuordnungen
}

→ Response: { ...updated DocumentType }
```

#### 5.2.6 Duplizieren

```
POST /api/v1/document-types/{id}/duplicate
Content-Type: application/json
Authorization: Bearer {token}  (Admin required)

{
    "new_name": "Arbeitsvertrag (Kopie)",
    "target_country_code": "IT",
    "include_clauses": true,
    "include_attachments": true,
    "include_form_fields": true
}

→ Response:
{
    "id": 5,
    "name": "Arbeitsvertrag (Kopie)",
    "country_code": "IT",
    "clauses_copied": 12,
    "attachments_copied": 2,
    "form_fields_copied": 15,
    "message": "Dokumenttyp erfolgreich dupliziert als 'Arbeitsvertrag (Kopie)'"
}
```

#### 5.2.7 Löschen (Soft Delete)

```
DELETE /api/v1/document-types/{id}
Authorization: Bearer {token}  (Admin required)

→ Response:
{
    "status": "deleted",
    "id": 1
}
```

### 5.3 Clauses API

#### 5.3.1 Liste abrufen

```
GET /api/v1/clauses/?country_code=DE&skip=0&limit=100

→ Response:
[{
    "id": 1,
    "title": "§ 1 Tätigkeit und Aufgabenbereich",
    "content_html": "<p>Der Arbeitnehmer wird als <strong>{{ position }}</strong> eingestellt...</p>",
    "country_code": "DE",
    "category": "Arbeitsverträge",
    "version": 3,
    "is_active": true,
    "approval_status": "active"
}]
```

#### 5.3.2 Auswirkungsanalyse

```
GET /api/v1/clauses/{id}/impact

→ Response:
{
    "clause_id": 1,
    "clause_title": "§ 1 Tätigkeit",
    "clause_version": 3,
    "affected_document_types": [{
        "id": 1,
        "name": "Arbeitsvertrag (Vollzeit)",
        "category": "Arbeitsverträge",
        "is_mandatory": true,
        "usage_count_30_days": 47
    }, ...],
    "total_document_types": 4,
    "total_usage_30_days": 127
}
```

#### 5.3.3 Erstellen

```
POST /api/v1/clauses/
Content-Type: application/json
Authorization: Bearer {token}  (Admin required)

{
    "title": "§ X Neue Klausel",
    "content_html": "<p>Inhalt der Klausel...</p>",
    "country_code": "DE",
    "category": "Arbeitsverträge"
}

→ Response: { ...created Clause, version: 1, approval_status: "draft" }
```

#### 5.3.4 Aktualisieren

```
PUT /api/v1/clauses/{id}
Content-Type: application/json
Authorization: Bearer {token}  (Admin required)

{
    "content_html": "<p>Geänderter Inhalt...</p>"
}

→ Response: { ...updated Clause, version: 4 }  // Version automatisch erhöht
```

### 5.4 Preview API

#### 5.4.1 HTML-Vorschau generieren

```
POST /api/v1/preview/html
Content-Type: application/json

{
    "document_type_id": 1,
    "form_data": {
        "vorname": "Max",
        "nachname": "Mustermann",
        "eintrittsdatum": "2026-04-01",
        "position": "Software-Entwickler",
        "monatsgehalt": 5500
    },
    "custom_clause": {
        "title": "Sondervereinbarung",
        "content": "<p>Zusätzliche Vereinbarung...</p>"
    }
}

→ Response (HTML):
<!-- Logo Header -->
<header class="document-header">
    <div class="logo"><img src="http://localhost:8000/api/v1/admin/logo/de/logo.png" alt="Niederwieser GmbH"></div>
</header>

<!-- Document Title -->
<div class="document-title">Arbeitsvertrag</div>

<!-- Contract Parties -->
<div class="contract-parties">
    <div class="party-label">Zwischen</div>
    <div class="party-name">Niederwieser GmbH</div>
    ...
</div>

<!-- Clause Content -->
<div class="document-content">
    <p>Der Arbeitnehmer wird als <strong>Software-Entwickler</strong> eingestellt...</p>
    ...
</div>

<!-- Signature Section -->
<div class="signature-section">...</div>
```

#### 5.4.2 Design Settings abrufen

```
GET /api/v1/preview/design/{country_code}

→ Response:
{
    "id": 1,
    "country_code": "DE",
    "company_name": "Niederwieser GmbH",
    "logo_path": "de/logo_20260115_123456.png",
    "header_line1": "Gewerbepark 9",
    "header_line2": "87477 Sulzberg",
    "footer_line1": "Seite {page}",
    "font_family": "Arial",
    "primary_color": "#243186"
}
```

### 5.5 Generation API

#### 5.5.1 Dokument generieren

```
POST /api/v1/documents/generate/{document_type_id}
Content-Type: application/json
Authorization: Bearer {token}

{
    "signatory_name": "Matthias Schweizer",
    "vorname": "Max",
    "nachname": "Mustermann",
    "eintrittsdatum": "2026-04-01",
    "position": "Software-Entwickler",
    "monatsgehalt": "5500",
    "wochenstunden": "40",
    "firmenwagen": false,
    "homeoffice": true,
    "output_format": "pdf",
    "attachment_ids": [1, 3],
    "async_pdf": false
}

→ Response (sync): Binary File (PDF oder DOCX)
→ Response (async):
{
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "message": "PDF conversion started. Poll /api/v1/generate/jobs/{job_id} for status."
}
```

#### 5.5.2 Async Job Status

```
GET /api/v1/generate/jobs/{job_id}

→ Response:
{
    "job_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "output_path": "/storage/generated/Vertrag_Mustermann.pdf",
    "download_url": "/api/v1/generate/download/550e8400-e29b-41d4-a716-446655440000"
}
```

### 5.6 Drafts API

#### 5.6.1 Liste

```
GET /api/v1/drafts

→ Response:
[{
    "id": 1,
    "document_type_id": 1,
    "document_type_name": "Arbeitsvertrag (Vollzeit)",
    "name": "Max Mustermann - Entwurf",
    "country_code": "DE",
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T14:45:00Z",
    "expires_at": "2026-02-14T10:30:00Z",
    "days_remaining": 28,
    "status": "draft"
}]
```

#### 5.6.2 Erstellen

```
POST /api/v1/drafts
Content-Type: application/json

{
    "document_type_id": 1,
    "country_code": "DE",
    "name": "Max Mustermann - Entwurf",
    "form_data": {
        "vorname": "Max",
        "nachname": "Mustermann"
    }
}

→ Response: { "id": 5, "status": "created" }
```

#### 5.6.3 Abrufen

```
GET /api/v1/drafts/{id}

→ Response:
{
    "id": 5,
    "document_type_id": 1,
    "document_type_name": "Arbeitsvertrag (Vollzeit)",
    "name": "Max Mustermann - Entwurf",
    "country_code": "DE",
    "form_data": { ... },
    "custom_clauses": null,
    "expires_at": "2026-02-14T10:30:00Z",
    "days_remaining": 28
}
```

#### 5.6.4 Aktualisieren (Auto-Save)

```
PUT /api/v1/drafts/{id}
Content-Type: application/json

{
    "form_data": { ... }
}

→ Response: { "id": 5, "status": "updated", "updated_at": "..." }
```

#### 5.6.5 Finalisieren

```
POST /api/v1/drafts/{id}/finalize
Content-Type: application/json

{
    "output_format": "pdf",
    "selected_attachments": [1, 3],
    "signatory_name": "Matthias Schweizer"
}

→ Response:
{
    "status": "completed",
    "document_id": 42,
    "download_url": "/api/v1/documents/42/download",
    "format": "pdf",
    "filename": "Arbeitsvertrag_20260115_abc123.pdf"
}
```

### 5.7 Bulk API

Siehe Abschnitt 4.4.

### 5.8 Health Endpoints

```
GET /health
→ { "status": "ok" }

GET /health/ready
→ {
    "status": "ok",
    "checks": {
        "database": "healthy",
        "redis": "healthy"
    },
    "version": "1.0.0",
    "debug": false
}
```

---

## ANHANG

### A. Umgebungsvariablen

```bash
# .env Beispiel

# Sicherheit (PFLICHT)
SECRET_KEY=your-super-secret-key-min-32-chars

# Datenbank
DATABASE_URL=postgresql+asyncpg://user:password@localhost/docgen_db
POSTGRES_USER=docgen
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=docgen_db

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# API
API_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Modus
DEBUG=false
```

### B. Docker Compose Befehle

```bash
# Development starten
docker-compose up -d

# Logs ansehen
docker-compose logs -f web

# Datenbank migrieren
docker-compose exec web alembic upgrade head

# Tests ausführen
docker-compose exec web pytest

# Production starten
docker-compose -f docker-compose.prod.yml up -d
```

### C. Tastaturkürzel

| Kürzel | Aktion |
|--------|--------|
| ? | Tastaturkürzel-Dialog öffnen |
| Ctrl+S | Entwurf speichern (im Generator) |
| Ctrl+Enter | Dokument generieren |
| Escape | Modal schließen |

---

*Dokument erstellt durch Reverse Engineering des Quellcodes.*
*Version: 4.2 | Stand: 2026-01-30*
