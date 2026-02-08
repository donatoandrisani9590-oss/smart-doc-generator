# Smart Document Generator

> KI-gestuetzter Dokumentengenerator fuer Arbeitsvertraege, HR-Dokumente und juristische Schriftstuecke

---

## Zentrale Architektur-Dokumentation

**WICHTIG: Lies zuerst [`ARCHITECTURE.md`](./ARCHITECTURE.md)** - Dort steht die komplette Cloud-Architektur, alle Service-URLs, Environment Variables und Deployment-Regeln.

---

## Grundprinzip

Diese App laeuft **ausschliesslich in der Cloud** (Vercel + Railway + GitHub).
Lokal wird nur entwickelt, niemals betrieben.
Siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) Abschnitt 1 fuer Details.

---

## Tech Stack

### Frontend (auf Vercel)
- **Framework:** React 19 + Vite + TypeScript
- **Styling:** Tailwind CSS
- **UI Library:** shadcn/ui
- **State:** TanStack React Query (Server) + Context API (UI)
- **Hosting:** Vercel (Auto-Deploy via GitHub)

### Backend (auf Railway)
- **Framework:** FastAPI (Python 3.11)
- **ORM:** SQLAlchemy 2.0 (async)
- **Migrations:** Alembic
- **Auth:** JWT (python-jose) mit Access + Refresh Tokens
- **Async Tasks:** Celery + Redis
- **PDF-Generierung:** python-docx + LibreOffice (headless)
- **Hosting:** Railway (Docker-basiert)

### Datenbank & Cache (auf Railway)
- **Datenbank:** PostgreSQL 16 (Railway Plugin)
- **Cache:** Redis 7 (Railway Plugin)

### Versionskontrolle
- **Repository:** GitHub (`donatoandrisani9590-oss/smart-doc-generator`)
- **Branch-Strategie:** Feature-Branches → Pull Request → Merge in `main`

---

## Aktueller Status

- Frontend: Live auf Vercel
- Backend: Live auf Railway
- Datenbank: PostgreSQL auf Railway
- Alle 7 Feature-Branches gemergt (Security Hardening, AI Clauses, Approval Workflow, Upload Fixes)

---

## Projektstruktur

```
smart-doc-generator/
├── .claude/
│   └── agents/                  ← 6 AI Agents (Requirements, Architect, Frontend, Backend, QA, DevOps)
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints/    ← FastAPI Endpoints (admin, auth, documents, smart, user)
│   │   ├── core/                ← Config, Security, Settings
│   │   ├── models/              ← SQLAlchemy Models
│   │   ├── schemas/             ← Pydantic Schemas (Validation)
│   │   ├── services/            ← Business Logic (clause_ai_bridge, etc.)
│   │   ├── db.py                ← Database Engine Setup
│   │   └── main.py              ← FastAPI App + Router Registration
│   ├── migrations/              ← Alembic Database Migrations
│   ├── scripts/                 ← Admin-Scripts (create_admin.py)
│   ├── Dockerfile               ← Railway Build-Anweisung
│   ├── requirements.txt         ← Python Dependencies
│   └── .env.example             ← Environment Template
├── frontend/
│   ├── src/
│   │   ├── components/          ← React Components (admin, auth, clauses, composer, documents, generator)
│   │   ├── contexts/            ← React Contexts (Auth, FeatureSettings, Toast)
│   │   ├── hooks/               ← Custom Hooks (useApi, wizard/)
│   │   ├── lib/                 ← Utilities (api-client, logger, sentry)
│   │   ├── pages/               ← Page Components (Dashboard, Generator, Admin, etc.)
│   │   ├── utils/               ← Helpers (sanitize, secureStorage)
│   │   └── App.tsx              ← Router + Lazy Loading
│   ├── .vercel/                 ← Vercel Project Link
│   └── package.json             ← npm Dependencies
├── features/                    ← Feature Specifications
├── ARCHITECTURE.md              ← ZENTRALE ARCHITEKTUR-DOKU (lies diese zuerst!)
├── SYSTEM_BLUEPRINT.md          ← Technisches Blueprint (ER-Diagramme, API-Specs)
├── PRODUCTION_DEPLOYMENT_GUIDE.md
├── DEPLOYMENT_CHECKLIST.md
├── SECURITY_HARDENING_KONZEPT.md
├── DEPLOY_README.md
├── deploy.sh
└── docker-compose.yml
```

---

## Environment Variables

### Frontend (Vercel Dashboard)
```bash
VITE_API_URL=https://web-production-96d24.up.railway.app
# Optional:
VITE_SENTRY_DSN=
VITE_APP_VERSION=1.0.0
```

### Backend (Railway Dashboard)
```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}    # Railway Referenz
REDIS_URL=${{Redis.REDIS_URL}}             # Railway Referenz
SECRET_KEY=<generiert>                      # JWT Access Token
REFRESH_SECRET_KEY=<generiert>              # JWT Refresh Token
CORS_ORIGINS=https://frontend-drab-tau-99.vercel.app
DEBUG=false
ENVIRONMENT=production
PORT=8000
```

Vollstaendige Liste: Siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) Abschnitt 3.

---

## Agent-Team Verantwortlichkeiten

Alle Agents MUESSEN [`ARCHITECTURE.md`](./ARCHITECTURE.md) Abschnitt 8 beachten!

- **Requirements Engineer** (`.claude/agents/requirements-engineer.md`)
  - Feature Specs in `/features` erstellen
  - User Stories + Acceptance Criteria + Edge Cases

- **Solution Architect** (`.claude/agents/solution-architect.md`)
  - Database Schema + Component Architecture designen
  - Tech-Entscheidungen treffen (Cloud-kompatibel!)

- **Frontend Developer** (`.claude/agents/frontend-dev.md`)
  - UI Components bauen (React + Tailwind + shadcn/ui)
  - MUSS auf Vercel fehlerfrei bauen (`tsc -b && vite build`)

- **Backend Developer** (`.claude/agents/backend-dev.md`)
  - FastAPI Endpoints + SQLAlchemy Models
  - MUSS auf Railway fehlerfrei starten (Docker)

- **QA Engineer** (`.claude/agents/qa-engineer.md`)
  - Features gegen Acceptance Criteria testen
  - Bugs dokumentieren + priorisieren

- **DevOps** (`.claude/agents/devops.md`)
  - Deployment zu Vercel (Frontend) und Railway (Backend)
  - Environment Variables verwalten
  - KEIN Docker lokal - nur Cloud-Deployment!

---

## Deployment Workflow

```
1. Code aendern (lokal)
2. TypeScript pruefen: cd frontend && npx tsc --noEmit
3. Committen + Pushen auf main
4. Frontend: npx vercel --prod (oder Auto-Deploy via GitHub)
5. Backend: cd backend && railway up
6. Testen: curl https://web-production-96d24.up.railway.app/health
```

Vollstaendige Anleitung: Siehe [`ARCHITECTURE.md`](./ARCHITECTURE.md) Abschnitt 5.

---

## Weitere Dokumentation

| Dokument | Inhalt |
|----------|--------|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Cloud-Architektur, Services, Regeln (PFLICHTLEKTUERE) |
| [`SYSTEM_BLUEPRINT.md`](./SYSTEM_BLUEPRINT.md) | ER-Diagramme, API-Specs, Datenfluesse |
| [`SECURITY_HARDENING_KONZEPT.md`](./SECURITY_HARDENING_KONZEPT.md) | Security-Framework |
| [`PRODUCTION_DEPLOYMENT_GUIDE.md`](./PRODUCTION_DEPLOYMENT_GUIDE.md) | Detaillierte Deployment-Anleitung |
| [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) | Pre-Deployment Checkliste |
| [`ROADMAP_6_MONATE.md`](./ROADMAP_6_MONATE.md) | 6-Monats-Produktroadmap |

---

**Cloud-First. Immer online. Vercel + Railway + GitHub.**
