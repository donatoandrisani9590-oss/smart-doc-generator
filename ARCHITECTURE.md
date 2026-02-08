# Smart Document Generator - Cloud Architecture

> Dieses Dokument ist die **zentrale Wahrheit** (Single Source of Truth) fuer die gesamte Systemarchitektur.
> Jede Aenderung am Tech-Stack, an Services oder Deployment-Prozessen MUSS hier dokumentiert werden.

---

## 1. Grundprinzip: Cloud-Native Application

Diese Anwendung laeuft **ausschliesslich online** in der Cloud. Es gibt keinen lokalen Betrieb.

| Regel | Beschreibung |
|-------|-------------|
| **Kein lokaler Server** | Die App wird NIEMALS auf einem lokalen Computer gehostet oder betrieben |
| **Cloud-only** | Alle Services laufen in der Cloud (Vercel, Railway, Supabase) |
| **Lokal = nur Entwicklung** | Der lokale Computer dient nur zum Entwickeln und Testen |
| **Git = Deployment-Trigger** | Jeder Push auf `main` loest automatische Deployments aus |

---

## 2. Service-Architektur (Produktivsystem)

```
                    +------------------+
                    |    Benutzer       |
                    |  (Browser/App)    |
                    +--------+---------+
                             |
                             | HTTPS
                             v
                    +------------------+
                    |     VERCEL        |
                    |   (Frontend)      |
                    |   React + Vite    |
                    +--------+---------+
                             |
                             | HTTPS API Calls
                             v
                    +------------------+
                    |    RAILWAY        |
                    |   (Backend)       |
                    |   FastAPI/Python  |
                    +---+----+----+----+
                        |    |    |
              +---------+    |    +---------+
              |              |              |
              v              v              v
     +--------+---+  +------+------+  +----+-------+
     |  RAILWAY    |  |  RAILWAY    |  |  SUPABASE   |
     | PostgreSQL  |  |   Redis     |  | (Auth/DB)   |
     |  (Daten)    |  | (Cache/     |  | (optional)  |
     |             |  |  Rate-Limit)|  |             |
     +-------------+  +-------------+  +-------------+
```

---

## 3. Service-Uebersicht

### 3.1 Frontend - Vercel

| Eigenschaft | Wert |
|------------|------|
| **Service** | Vercel |
| **Framework** | React 19 + Vite + TypeScript |
| **UI** | Tailwind CSS + shadcn/ui |
| **URL Production** | https://frontend-drab-tau-99.vercel.app |
| **Vercel Projekt** | `frontend` (Team: `donato-andrisanis-projects`) |
| **Vercel Projekt-ID** | `prj_5JKmxyjWdOyTleTs6vNDEQwdlViN` |
| **Build Command** | `tsc -b && vite build` |
| **Output Directory** | `frontend/dist/` |
| **Auto-Deploy** | Ja, bei Push auf `main` via GitHub Integration |

**Environment Variables (Vercel Dashboard):**

| Variable | Beschreibung | Beispiel |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL (Railway) | `https://web-production-96d24.up.railway.app` |
| `VITE_SENTRY_DSN` | Sentry Error Tracking (optional) | `https://xxx@sentry.io/yyy` |
| `VITE_APP_VERSION` | App-Version fuer Releases | `1.0.0` |

### 3.2 Backend - Railway

| Eigenschaft | Wert |
|------------|------|
| **Service** | Railway |
| **Framework** | FastAPI (Python 3.11) |
| **URL Production** | https://web-production-96d24.up.railway.app |
| **Railway Projekt** | `smart-doc-backend` |
| **Railway Projekt-ID** | `76982d3d-5f49-452d-9918-ef4d503c3d3c` |
| **Dockerfile** | `backend/Dockerfile` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| **Health Endpoint** | `GET /health` → `{"status":"ok"}` |

**Environment Variables (Railway Dashboard):**

| Variable | Beschreibung | Quelle |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL Connection String | `${{Postgres.DATABASE_URL}}` (Railway Referenz) |
| `REDIS_URL` | Redis Connection String | `${{Redis.REDIS_URL}}` (Railway Referenz) |
| `SECRET_KEY` | JWT Access Token Secret (min. 64 Zeichen) | Generiert mit `secrets.token_urlsafe(64)` |
| `REFRESH_SECRET_KEY` | JWT Refresh Token Secret (min. 64 Zeichen) | Generiert mit `secrets.token_urlsafe(64)` |
| `CORS_ORIGINS` | Erlaubte Frontend-Origins | `https://frontend-drab-tau-99.vercel.app` |
| `DEBUG` | Debug-Modus | `false` (Production!) |
| `ENVIRONMENT` | Umgebungsname | `production` |
| `PORT` | Server Port | `8000` |

### 3.3 Datenbank - Railway PostgreSQL

| Eigenschaft | Wert |
|------------|------|
| **Service** | Railway PostgreSQL Plugin |
| **Version** | PostgreSQL 16 |
| **Verbindung** | Automatisch via `${{Postgres.DATABASE_URL}}` |
| **Migrations** | Alembic (`backend/migrations/`) |
| **Backup** | Railway automatisch |

### 3.4 Cache & Rate-Limiting - Railway Redis

| Eigenschaft | Wert |
|------------|------|
| **Service** | Railway Redis Plugin |
| **Verbindung** | Automatisch via `${{Redis.REDIS_URL}}` |
| **Verwendung** | Rate-Limiting, Session-Cache, Celery Task Queue |

### 3.5 Versionskontrolle - GitHub

| Eigenschaft | Wert |
|------------|------|
| **Repository** | `donatoandrisani9590-oss/smart-doc-generator` |
| **Hauptbranch** | `main` |
| **URL** | https://github.com/donatoandrisani9590-oss/smart-doc-generator |

---

## 4. Datenfluss

### 4.1 Benutzer-Request (z.B. Dokument generieren)

```
1. Benutzer klickt "Dokument erstellen" im Browser
2. Frontend (Vercel) sendet POST an Backend (Railway)
   → https://web-production-96d24.up.railway.app/api/v1/documents/generate
3. Backend validiert JWT Token
4. Backend liest Klauseln aus PostgreSQL (Railway)
5. Backend generiert DOCX/PDF
6. Backend speichert in Repository (PostgreSQL)
7. Backend sendet Dokument zurueck an Frontend
8. Frontend zeigt Vorschau / Download an
```

### 4.2 Authentifizierung

```
1. Benutzer gibt Email + Passwort ein
2. Frontend sendet POST /api/v1/auth/login an Backend
3. Backend prueft Passwort gegen Hash in PostgreSQL
4. Backend generiert JWT Access Token + Refresh Token
5. Frontend speichert Tokens in secureStorage (verschluesselt)
6. Alle weiteren Requests senden Token im Authorization Header
```

---

## 5. Deployment-Workflow

### 5.1 Automatisches Deployment (Empfohlen)

```
Entwickler pushed auf main
        |
        +--→ GitHub erkennt Push
        |        |
        |        +--→ Vercel baut Frontend automatisch (wenn GitHub Integration aktiv)
        |
        +--→ Manuell: railway up (im backend/ Verzeichnis)
```

### 5.2 Manuelles Deployment

**Frontend (Vercel):**
```bash
cd frontend
npx vercel --prod
```

**Backend (Railway):**
```bash
cd backend
railway up
```

### 5.3 Deployment-Checkliste

Vor jedem Deployment pruefen:

- [ ] `npx tsc --noEmit` im Frontend ohne Fehler
- [ ] `python -c "import ast; ast.parse(open('app/main.py').read())"` im Backend ohne Fehler
- [ ] Alle Environment Variables auf Vercel/Railway gesetzt
- [ ] CORS_ORIGINS auf Railway enthaelt die aktuelle Vercel-URL
- [ ] VITE_API_URL auf Vercel zeigt auf die aktuelle Railway-URL
- [ ] `curl https://[RAILWAY_URL]/health` gibt `{"status":"ok"}` zurueck
- [ ] Frontend im Browser testen (Login, Dashboard, Dokument erstellen)

---

## 6. Lokale Entwicklungsumgebung

Die lokale Umgebung dient **nur zur Entwicklung**, nie zum Betrieb.

### 6.1 Frontend lokal starten

```bash
cd frontend
cp .env.example .env
# VITE_API_URL leer lassen fuer DEV_MODE (Mock-Daten)
# ODER auf Railway-URL setzen fuer echtes Backend
npm install
npm run dev
# → http://localhost:5173
```

### 6.2 Backend lokal starten (optional)

```bash
cd backend
cp .env.example .env
# DATABASE_URL=sqlite+aiosqlite:///./dev.db (fuer lokale Entwicklung)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000
```

### 6.3 Wichtig: Lokale .env NIEMALS committen

Die Datei `backend/.env` enthaelt Secrets und darf NIEMALS in Git landen.
`.gitignore` muss enthalten:
```
.env
.env.local
*.env
```

---

## 7. Verbindungsmatrix

Diese Matrix zeigt, welcher Service mit welchem anderen Service kommuniziert:

| Von → Nach | Vercel | Railway Backend | Railway PostgreSQL | Railway Redis | GitHub | Supabase |
|------------|--------|----------------|-------------------|--------------|--------|----------|
| **Benutzer** | HTTPS | - | - | - | - | - |
| **Vercel (Frontend)** | - | HTTPS API | - | - | Pull (Auto-Deploy) | - |
| **Railway (Backend)** | - | - | TCP (intern) | TCP (intern) | - | Optional |
| **Railway PostgreSQL** | - | - | - | - | - | - |
| **Railway Redis** | - | - | - | - | - | - |
| **GitHub** | Webhook | - | - | - | - | - |

---

## 8. Regeln fuer Agents (Claude Code)

### 8.1 Goldene Regeln

Jeder AI Agent (Requirements, Architect, Frontend, Backend, QA, DevOps) MUSS diese Regeln beachten:

1. **Kein Docker fuer Deployment** - Wir deployen auf Vercel (Frontend) und Railway (Backend), nicht mit Docker lokal
2. **Kein lokaler Server** - Die App laeuft in der Cloud, nicht auf dem Mac des Entwicklers
3. **Environment Variables nie hardcoden** - Immer ueber `import.meta.env` (Frontend) oder `settings.XXX` (Backend)
4. **CORS beachten** - Frontend-URL muss in `CORS_ORIGINS` auf Railway stehen
5. **API-URL nicht hardcoden** - Frontend nutzt `VITE_API_URL` aus Environment
6. **Datenbank-Migrationen** - Neue Tabellen/Spalten immer ueber Alembic Migrations
7. **Secrets nie in Code** - JWT Keys, DB-Passwoerter etc. gehoeren in Environment Variables
8. **TypeScript strict** - Kein `any` ohne Begruendung, alle Typen definieren
9. **Vercel-kompatibel** - Frontend muss mit `tsc -b && vite build` ohne Fehler bauen
10. **Railway-kompatibel** - Backend muss mit dem Dockerfile bauen und starten

### 8.2 Wenn ein Agent neuen Code schreibt

**Frontend-Aenderungen:**
```
1. Code aendern in frontend/src/
2. npx tsc --noEmit → Keine Fehler?
3. npm run build → Baut ohne Fehler?
4. Erst dann committen
```

**Backend-Aenderungen:**
```
1. Code aendern in backend/app/
2. Python Syntax pruefen
3. Neue Dependencies → requirements.txt aktualisieren
4. Neue Tabellen → Alembic Migration erstellen
5. Neue Endpoints → In app/main.py registrieren
6. Erst dann committen
```

### 8.3 Wenn ein Agent eine neue Dependency hinzufuegt

| Bereich | Datei | Befehl |
|---------|-------|--------|
| Frontend npm | `frontend/package.json` | `npm install paketname` |
| Backend Python | `backend/requirements.txt` | Manuell eintragen + `pip install` |
| System-Library | `backend/Dockerfile` | In `apt-get install` Zeile hinzufuegen |

---

## 9. Troubleshooting

### Frontend baut nicht auf Vercel

```bash
# Lokal testen:
cd frontend && npx tsc --noEmit
# Alle Fehler fixen, dann:
npx vercel --prod
```

### Backend startet nicht auf Railway

```bash
# Logs pruefen:
cd backend && railway logs
# Haeufige Probleme:
# - Fehlende System-Library → Dockerfile anpassen
# - Fehlende Python-Dependency → requirements.txt ergaenzen
# - Fehlende Environment Variable → railway variables set KEY=VALUE
```

### Frontend erreicht Backend nicht

```bash
# 1. Backend laeuft?
curl https://web-production-96d24.up.railway.app/health

# 2. CORS konfiguriert?
# Railway: CORS_ORIGINS muss Vercel-URL enthalten

# 3. VITE_API_URL gesetzt?
# Vercel Dashboard → Settings → Environment Variables
```

### Datenbank-Migration fehlgeschlagen

```bash
cd backend
railway run alembic upgrade head
# Bei Fehler: Logs pruefen mit railway logs
```

---

## 10. Service-URLs (Aktueller Stand)

| Service | URL | Status |
|---------|-----|--------|
| Frontend (Vercel) | https://frontend-drab-tau-99.vercel.app | Live |
| Backend (Railway) | https://web-production-96d24.up.railway.app | Live |
| Backend Health | https://web-production-96d24.up.railway.app/health | `{"status":"ok"}` |
| GitHub Repo | https://github.com/donatoandrisani9590-oss/smart-doc-generator | Aktiv |

---

## 11. Aenderungsprotokoll

| Datum | Aenderung | Durch |
|-------|-----------|-------|
| 2026-02-07 | Initiales Deployment: Frontend auf Vercel, Backend auf Railway | Claude + Donato |
| 2026-02-07 | 7 Feature-Branches in main gemergt (Security, AI Clauses, Approval, Upload) | Claude |
| 2026-02-07 | TypeScript Build-Fehler behoben (15+ Fixes fuer Vercel-Kompatibilitaet) | Claude |
| 2026-02-07 | Dockerfile erweitert (libmagic hinzugefuegt) | Claude |
| 2026-02-07 | Diese Architektur-Dokumentation erstellt | Claude |
