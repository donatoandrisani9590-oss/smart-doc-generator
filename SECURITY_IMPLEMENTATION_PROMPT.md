# Security Hardening Implementation - Claude Prompt

## Aufgabe

Implementiere ALLE Sicherheitsmaßnahmen aus dem `SECURITY_HARDENING_KONZEPT.md` systematisch und vollständig. Dies ist ein kritischer Security-Fix für eine HR-Dokumenten-App, die hochsensible Daten verarbeitet (Gehälter, Kündigungen, Personalakten).

## Kontext

- **Projekt**: Smart Document Generator (Enterprise HR-Dokumentensystem)
- **Tech-Stack**:
  - Backend: FastAPI (Python), PostgreSQL, Redis, Celery
  - Frontend: React 19, TypeScript, Vite, TailwindCSS
- **Sicherheitsstatus**: KRITISCH - Nicht produktionsreif
- **Dokumentation**: Alle Details in `/home/user/smart-doc-generator/SECURITY_HARDENING_KONZEPT.md`

## Prioritäten & Reihenfolge

### 🔴 PHASE 1: Kritische Vulnerabilities (SOFORT)

#### 1.1 Secret Key Management
- [ ] `backend/app/core/config.py`: Hardcoded Secret Keys entfernen
- [ ] Validierung: Secret Key muss aus Umgebungsvariable kommen (keine Defaults!)
- [ ] Separate Keys für Access + Refresh Tokens
- [ ] `.env.example` mit Placeholder erstellen
- [ ] Dokumentation: Wie man sichere Keys generiert (`secrets.token_urlsafe(64)`)

#### 1.2 XSS-Prevention (Frontend)
- [ ] `frontend/src/utils/sanitize.ts` erstellen mit DOMPurify
- [ ] **KRITISCH**: Alle `dangerouslySetInnerHTML` Vorkommen finden und fixen:
  - `DocumentGenerator.tsx:540`
  - `TemplatePreview.tsx`
  - Weitere via Grep suchen
- [ ] `document.write()` durch sichere DOM-Manipulation ersetzen
- [ ] Print-Funktion in `utils/print.ts` absichern

#### 1.3 Path Traversal Prevention (Backend)
- [ ] `backend/app/api/v1/endpoints/generation.py:12` härten
- [ ] Whitelist für erlaubte Template-Namen implementieren
- [ ] Pfad-Normalisierung mit `Path.resolve()` + Startswith-Check
- [ ] Alle File-Operations auf Path Traversal prüfen

#### 1.4 Debug Mode & Information Disclosure
- [ ] `backend/app/core/db.py:8`: SQL-Echo nur wenn `DEBUG=True`
- [ ] Global Error Handler: Stack Traces nur in Development
- [ ] `main.py:14`: OpenAPI Docs nur wenn `DEBUG=True`

#### 1.5 Cache-Clear Endpoint schützen
- [ ] `backend/app/api/v1/endpoints/preview.py:215`: Authentication hinzufügen
- [ ] Rate Limiting für Cache-Operations

---

### 🟡 PHASE 2: High Priority (DIESE WOCHE)

#### 2.1 JWT Token Security
- [ ] Access Token Lifetime: 60 Minuten (aktuell OK prüfen)
- [ ] Refresh Token: 7 Tage mit separatem Secret Key
- [ ] `backend/app/core/security.py`: Token-Pair-Funktion implementieren
- [ ] Refresh-Endpoint mit Token-Rotation
- [ ] Frontend: Token-Refresh-Mechanismus in API-Client

#### 2.2 Security Headers (Backend)
- [ ] `backend/app/middleware/security_headers.py` erstellen
- [ ] Alle Header aus Konzept implementieren:
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block
  - Strict-Transport-Security (HSTS)
  - Content-Security-Policy (CSP)
  - Referrer-Policy
  - Permissions-Policy
- [ ] Middleware in `main.py` registrieren

#### 2.3 Security Headers (Frontend)
- [ ] `frontend/index.html`: Meta-Tags für CSP hinzufügen
- [ ] CSP-Policy testen mit Browser DevTools

#### 2.4 Rate Limiting
- [ ] `requirements.txt`: `slowapi` hinzufügen
- [ ] `backend/app/middleware/rate_limit.py` erstellen
- [ ] Redis-Backend konfigurieren
- [ ] Endpoint-spezifische Limits:
  - Login: 5/minute
  - API Read: 100/minute
  - API Write: 30/minute
  - Generation: 10/minute
  - Bulk: 2/minute
- [ ] Exception Handler für RateLimitExceeded

#### 2.5 Input Validation (Backend)
- [ ] **ALLE** Pydantic Schemas härten:
  - `max_length` für String-Felder
  - `Field(...)` mit Constraints
  - HTML-Sanitization via `@validator`
- [ ] Betroffen: `schemas/clause.py`, `schemas/document.py`, etc.
- [ ] `utils/validators.py` für wiederverwendbare Validatoren

#### 2.6 Brute-Force Protection
- [ ] User-Model erweitern: `failed_login_attempts`, `locked_until`
- [ ] Alembic Migration erstellen
- [ ] `auth.py`: Account Lockout nach 5 Fehlversuchen (15 Min)
- [ ] User-Enumeration verhindern: Gleiche Fehlermeldung für alle Login-Fehler

#### 2.7 Secure localStorage
- [ ] `frontend/src/utils/secureStorage.ts` erstellen
- [ ] CryptoJS für AES-Verschlüsselung
- [ ] SessionStorage statt localStorage für sensible Daten
- [ ] Alle `localStorage.setItem()` Aufrufe migrieren

#### 2.8 File Upload Security
- [ ] `python-magic` zu requirements.txt hinzufügen
- [ ] `backend/app/api/v1/endpoints/attachments.py` härten:
  - MIME-Type via Magic Bytes (nicht HTTP-Header!)
  - Whitelist: PDF, PNG, JPG
  - Max 10 MB File Size
  - UUID-basierte Dateinamen
  - Speicherung außerhalb Web-Root
- [ ] SVG-Upload BLOCKIEREN oder sanitizen

---

### 🟢 PHASE 3: Medium Priority (VOR GO-LIVE)

#### 3.1 CORS Hardening
- [ ] `main.py`: Explizite Origin-Whitelist
- [ ] Keine Wildcards (`*`)
- [ ] Nur in Development: `localhost`

#### 3.2 CSRF Protection
- [ ] `starlette-csrf` zu requirements.txt
- [ ] CSRF-Middleware konfigurieren
- [ ] Frontend: CSRF-Token in Requests

#### 3.3 Security Logging
- [ ] `backend/app/utils/security_logger.py` erstellen
- [ ] structlog implementieren
- [ ] Security Events definieren (Login, Failed Auth, etc.)
- [ ] In Auth-Endpoints integrieren

#### 3.4 Request Tracing
- [ ] `backend/app/middleware/request_id.py` erstellen
- [ ] UUID-basierte Request-IDs
- [ ] X-Request-ID Header in Responses

#### 3.5 Database Security
- [ ] PostgreSQL: Connection Pooling optimieren
- [ ] `pool_pre_ping=True` für Health Checks
- [ ] Dokumentation: Encryption at Rest (via Cloud-Provider)

#### 3.6 Docker Security
- [ ] Dockerfile: Non-root User (bereits OK, prüfen)
- [ ] Health Checks definieren
- [ ] Multi-stage Build optimieren
- [ ] Keine Secrets im Image

#### 3.7 Environment Security
- [ ] `.env.example` mit allen Required Vars
- [ ] `.env` in `.gitignore` (prüfen)
- [ ] `config.py`: Validierung für alle Secrets
- [ ] Production Checklist in README

---

## Implementierungs-Strategie

### Schritt 1: Vorbereitung
1. Branch erstellen: `claude/security-hardening-qmWZ7`
2. Backup der aktuellen `.env` (außerhalb Git)
3. Dependencies auflisten, die installiert werden müssen

### Schritt 2: Backend Security
1. Phase 1 Backend-Fixes (Kritisch)
2. Phase 2 Backend-Fixes (High)
3. Tests für alle Security-Features schreiben
4. Smoke-Test durchführen

### Schritt 3: Frontend Security
1. Phase 1 Frontend-Fixes (XSS)
2. Phase 2 Frontend-Fixes (Storage, Headers)
3. E2E-Tests erweitern für Security-Features

### Schritt 4: Integration & Testing
1. Docker Compose neu bauen
2. Alle Endpoints testen (Smoke-Test)
3. Security Headers validieren
4. Rate Limiting testen
5. XSS-Tests durchführen

### Schritt 5: Documentation
1. `.env.example` aktualisieren
2. `README.md`: Security-Sektion hinzufügen
3. Migration-Guide für bestehende Deployments
4. Security-Checklist für Production

---

## Testing-Anforderungen

### Nach JEDER Phase:
```bash
# Backend Tests
cd backend
pytest tests/ -v

# Smoke Test
./smoke-test.sh

# Security Headers Check
curl -I http://localhost:8000/api/v1/health

# Frontend E2E
cd frontend
npm run test:e2e
```

### Spezifische Security-Tests:
```bash
# Rate Limiting testen
for i in {1..10}; do curl http://localhost:8000/api/v1/login; done

# XSS-Test (manuell)
# Input: <script>alert('XSS')</script>
# Erwartung: Sanitized Output

# Path Traversal (manuell)
# Input: ../../etc/passwd
# Erwartung: 400 Bad Request
```

---

## Commit-Strategie

### Commits pro Phase:
```
fix(security): [CRITICAL] Remove hardcoded secret keys (SEC-001)
fix(security): [CRITICAL] Add XSS prevention with DOMPurify (SEC-002, SEC-003)
fix(security): [CRITICAL] Prevent path traversal in file generation (SEC-004)
fix(security): [HIGH] Implement security headers middleware
fix(security): [HIGH] Add rate limiting with Redis backend
fix(security): [HIGH] Harden input validation in Pydantic schemas
fix(security): [HIGH] Implement brute-force protection with account lockout
feat(security): Add secure localStorage with AES encryption
feat(security): Implement file upload security with magic bytes validation
feat(security): Add security logging and request tracing
docs(security): Update .env.example and production checklist
```

---

## Erfolgs-Kriterien

### Definition of Done:
- [ ] Alle 20 Security-IDs aus SECURITY_HARDENING_KONZEPT.md gefixt
- [ ] Keine `dangerouslySetInnerHTML` ohne Sanitization
- [ ] Keine hardcoded Secrets im Code
- [ ] Alle Endpoints haben Rate Limiting
- [ ] Security Headers auf allen Responses
- [ ] Input Validation mit max_length Constraints
- [ ] Brute-Force Protection aktiv
- [ ] File Upload nur mit Whitelist
- [ ] DEBUG=False in Production erzwungen
- [ ] Alle Tests grün
- [ ] Security-Checklist abgearbeitet

### Validierung:
```bash
# Security Headers
curl -I https://app.niederwieser.de | grep -E "(X-Frame|X-Content|Strict-Transport)"

# Rate Limiting
ab -n 100 -c 10 http://localhost:8000/api/v1/login

# XSS Prevention
# Manueller Test mit <img src=x onerror=alert(1)>

# Secret Keys
grep -r "SECRET_KEY.*=" backend/app/ --exclude="*.env*"
# Erwartung: Keine Matches
```

---

## Wichtige Hinweise

### ⚠️ KRITISCH:
1. **NIEMALS** `.env` Dateien committen
2. **ALLE** XSS-Stellen müssen gefunden werden (Grep nutzen!)
3. **TESTEN** nach jeder Phase, nicht erst am Ende
4. **DOKUMENTIEREN** jede Änderung im Commit-Message

### 💡 Best Practices:
1. Lies SECURITY_HARDENING_KONZEPT.md komplett durch
2. Arbeite Phase für Phase ab (nicht parallel)
3. Teste nach jedem Fix isoliert
4. Schreibe aussagekräftige Commit-Messages
5. Bei Unsicherheit: Frage nach!

### 🔍 Zu überprüfende Dateien:
- Backend: `grep -r "dangerouslySetInnerHTML" backend/`
- Frontend: `grep -r "dangerouslySetInnerHTML" frontend/src/`
- Frontend: `grep -r "document.write" frontend/src/`
- Backend: `grep -r "SECRET_KEY.*=" backend/app/`
- Frontend: `grep -r "localStorage.setItem" frontend/src/`

---

## Fragen während der Implementierung?

Falls du auf Probleme stößt oder Unklarheiten hast:
1. Prüfe SECURITY_HARDENING_KONZEPT.md (Zeile XXX)
2. Schau in die bestehenden Tests
3. Nutze die Smoke-Test-Skripte
4. Frage den User

---

## Abschluss

Nach erfolgreicher Implementierung:
1. Alle Tests durchführen
2. Security-Checklist validieren
3. Pull Request erstellen mit:
   - Zusammenfassung aller Fixes
   - Vorher/Nachher Vergleich
   - Security-Test-Results
   - Migration-Guide
4. Deployment-Checklist für Production bereitstellen

---

**Viel Erfolg! Diese Arbeit macht die App produktionsreif und schützt sensible HR-Daten. 🔒**
