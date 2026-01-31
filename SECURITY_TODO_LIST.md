# Security-Hardening Todo-Liste

## Priorisierte Aufgabenliste für professionelle Security

---

## PHASE 1: KRITISCH (Sofort - Tag 1-2)

Diese Aufgaben müssen **vor jedem weiteren Deployment** erledigt werden.

### Backend

- [ ] **SEC-001: Secret Key externalisieren**
  - Datei: `backend/app/core/config.py:7`
  - Aktion: Default-Wert entfernen, Exception werfen wenn nicht gesetzt
  ```python
  SECRET_KEY: str = os.environ["SECRET_KEY"]  # Kein Default!
  ```
  - Aufwand: 15 Minuten

- [ ] **SEC-002: SQL Debug-Mode deaktivieren**
  - Datei: `backend/app/db.py:8`
  - Aktion: `echo=True` auf `echo=settings.DEBUG` ändern
  - Aufwand: 5 Minuten

- [ ] **SEC-003: Cache-Clear Endpoint schützen**
  - Datei: `backend/app/api/v1/endpoints/preview.py:215-220`
  - Aktion: `Depends(get_current_active_admin)` hinzufügen
  - Aufwand: 10 Minuten

- [ ] **SEC-004: Template-Name Whitelist**
  - Datei: `backend/app/api/v1/endpoints/generation.py:12`
  - Aktion: Whitelist-Check implementieren
  - Aufwand: 30 Minuten

- [ ] **SEC-005: OpenAPI in Production deaktivieren**
  - Datei: `backend/app/main.py:14-15`
  - Aktion: `docs_url=None if not settings.DEBUG else "/docs"`
  - Aufwand: 10 Minuten

### Frontend

- [ ] **SEC-006: DOMPurify installieren und integrieren**
  - Befehl: `npm install dompurify @types/dompurify`
  - Aufwand: 15 Minuten

- [ ] **SEC-007: XSS in DocumentGenerator.tsx fixen**
  - Datei: `frontend/src/pages/DocumentGenerator.tsx:540`
  - Aktion: `sanitizeHtml()` vor `dangerouslySetInnerHTML`
  - Aufwand: 20 Minuten

- [ ] **SEC-008: XSS in TemplatePreview.tsx fixen**
  - Datei: `frontend/src/components/admin/TemplatePreview.tsx:303`
  - Aktion: `document.write()` durch sichere Alternative ersetzen
  - Aufwand: 30 Minuten

- [ ] **SEC-009: XSS in WorksCouncilExport.tsx fixen**
  - Datei: `frontend/src/components/documents/WorksCouncilExport.tsx:224`
  - Aktion: Gleiche Behandlung wie TemplatePreview
  - Aufwand: 20 Minuten

**Phase 1 Gesamt: ~3 Stunden**

---

## PHASE 2: HOCH (Woche 1)

### Backend - Authentication

- [ ] **SEC-010: Token-Gültigkeit reduzieren**
  - Datei: `backend/app/core/config.py:9`
  - Aktion: Von 8 Tagen auf 15 Minuten
  ```python
  ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
  ```
  - Aufwand: 10 Minuten

- [ ] **SEC-011: Refresh-Token implementieren**
  - Datei: `backend/app/core/security.py`
  - Aktion: Neuen Endpoint `/auth/refresh` + Refresh-Token-Logik
  - Aufwand: 2 Stunden

- [ ] **SEC-012: User Enumeration fixen**
  - Datei: `backend/app/api/v1/endpoints/auth.py:21-30`
  - Aktion: Einheitliche Fehlermeldung "Invalid credentials"
  - Aufwand: 15 Minuten

- [ ] **SEC-013: Brute-Force Protection**
  - Datei: `backend/app/api/v1/endpoints/auth.py`
  - Aktion: Account-Lockout nach 5 Fehlversuchen
  - Aufwand: 1 Stunde

### Backend - Rate Limiting

- [ ] **SEC-014: slowapi installieren**
  - Befehl: `pip install slowapi`
  - `requirements.txt` aktualisieren
  - Aufwand: 10 Minuten

- [ ] **SEC-015: Rate Limiter konfigurieren**
  - Datei: `backend/app/main.py`
  - Aktion: Limiter-Middleware hinzufügen
  - Aufwand: 30 Minuten

- [ ] **SEC-016: Endpoint-Limits setzen**
  - Dateien: `auth.py`, `generation.py`, `bulk.py`
  - Aktion: `@limiter.limit()` Decorator hinzufügen
  - Aufwand: 1 Stunde

### Backend - Security Headers

- [ ] **SEC-017: Security Headers Middleware erstellen**
  - Datei: `backend/app/middleware/security_headers.py` (NEU)
  - Aktion: X-Frame-Options, CSP, HSTS, etc.
  - Aufwand: 1 Stunde

- [ ] **SEC-018: Middleware in main.py registrieren**
  - Datei: `backend/app/main.py`
  - Aufwand: 10 Minuten

### Backend - Input Validation

- [ ] **SEC-019: bleach installieren**
  - Befehl: `pip install bleach`
  - Aufwand: 5 Minuten

- [ ] **SEC-020: HTML-Sanitization in Schemas**
  - Dateien: Alle Schemas in `backend/app/schemas/`
  - Aktion: `@validator` mit bleach.clean()
  - Aufwand: 2 Stunden

- [ ] **SEC-021: Feld-Längen-Limits hinzufügen**
  - Dateien: Alle Schemas
  - Aktion: `Field(..., max_length=X)` hinzufügen
  - Aufwand: 1 Stunde

### Backend - File Uploads

- [ ] **SEC-022: python-magic installieren**
  - Befehl: `pip install python-magic`
  - Aufwand: 10 Minuten

- [ ] **SEC-023: File-Upload-Validierung härten**
  - Datei: `backend/app/api/v1/endpoints/attachments.py`
  - Aktion: Magic-Bytes-Check, Size-Limit, UUID-Filename
  - Aufwand: 1.5 Stunden

- [ ] **SEC-024: SVG-Upload verbieten oder sanitizen**
  - Datei: `backend/app/api/v1/endpoints/logo.py`
  - Aktion: SVG aus Whitelist entfernen oder defusedxml nutzen
  - Aufwand: 30 Minuten

### Frontend

- [ ] **SEC-025: sessionStorage statt localStorage**
  - Datei: `frontend/src/pages/DocumentGenerator.tsx`
  - Aktion: Sensitive Daten nur in sessionStorage
  - Aufwand: 30 Minuten

- [ ] **SEC-026: URL-Parameter escapen**
  - Datei: `frontend/src/hooks/useApi.ts`
  - Aktion: `URLSearchParams` statt String-Concatenation
  - Aufwand: 1 Stunde

- [ ] **SEC-027: Security Meta-Tags in index.html**
  - Datei: `frontend/index.html`
  - Aktion: CSP, Referrer-Policy hinzufügen
  - Aufwand: 20 Minuten

**Phase 2 Gesamt: ~15 Stunden**

---

## PHASE 3: MITTEL (Woche 2-3)

### Backend - CORS & CSRF

- [ ] **SEC-028: CORS-Konfiguration härten**
  - Datei: `backend/app/main.py`
  - Aktion: Explizite Origin-Whitelist, Methoden, Headers
  - Aufwand: 30 Minuten

- [ ] **SEC-029: CSRF-Protection implementieren**
  - Befehl: `pip install starlette-csrf`
  - Aktion: Middleware hinzufügen, Frontend anpassen
  - Aufwand: 2 Stunden

### Backend - Logging

- [ ] **SEC-030: structlog installieren**
  - Befehl: `pip install structlog`
  - Aufwand: 10 Minuten

- [ ] **SEC-031: Security-Event-Logger erstellen**
  - Datei: `backend/app/utils/security_logger.py` (NEU)
  - Aufwand: 1 Stunde

- [ ] **SEC-032: Request-ID-Middleware**
  - Datei: `backend/app/middleware/request_id.py` (NEU)
  - Aufwand: 30 Minuten

- [ ] **SEC-033: Audit-Logging in kritischen Endpoints**
  - Dateien: `auth.py`, `clauses.py`, `document_types.py`
  - Aufwand: 2 Stunden

### Backend - Error Handling

- [ ] **SEC-034: Exception-Details entfernen**
  - Dateien: Alle Endpoints mit `detail=str(e)`
  - Aktion: Generische Fehlermeldung + Server-seitiges Logging
  - Aufwand: 2 Stunden

- [ ] **SEC-035: Global Exception Handler**
  - Datei: `backend/app/main.py`
  - Aktion: Alle unbehandelten Exceptions abfangen
  - Aufwand: 1 Stunde

### Backend - Temp Files

- [ ] **SEC-036: Sichere Temp-File-Handhabung**
  - Datei: `backend/app/api/v1/endpoints/bulk.py`
  - Aktion: `tempfile.mkstemp()` + automatisches Cleanup
  - Aufwand: 1 Stunde

### Frontend - Additional Security

- [ ] **SEC-037: File-Path-Validierung**
  - Dateien: `Repository.tsx`, `DocumentDetail.tsx`
  - Aktion: URL-Whitelist vor `window.open()`
  - Aufwand: 1 Stunde

- [ ] **SEC-038: Cache-Keys mit User-ID**
  - Datei: `frontend/src/hooks/useApi.ts`
  - Aktion: User-ID in alle queryKeys aufnehmen
  - Aufwand: 1 Stunde

**Phase 3 Gesamt: ~13 Stunden**

---

## PHASE 4: INFRASTRUKTUR (Woche 3-4)

### Deployment

- [ ] **SEC-039: Dockerfile härten**
  - Non-root User, Health Check, keine Secrets
  - Aufwand: 1 Stunde

- [ ] **SEC-040: docker-compose.yml sichern**
  - Secrets via Environment, Netzwerk-Isolation
  - Aufwand: 1 Stunde

- [ ] **SEC-041: Health-Check-Endpoint**
  - Datei: `backend/app/api/v1/endpoints/health.py` (NEU)
  - Aufwand: 30 Minuten

### Database

- [ ] **SEC-042: Connection Pool konfigurieren**
  - Datei: `backend/app/db.py`
  - Aktion: `pool_size`, `max_overflow` setzen
  - Aufwand: 30 Minuten

- [ ] **SEC-043: Database Encryption evaluieren**
  - Dokumentation für pgcrypto oder Cloud-Provider
  - Aufwand: 2 Stunden

### Secrets

- [ ] **SEC-044: .env.example erstellen**
  - Alle benötigten Environment Variables dokumentieren
  - Aufwand: 30 Minuten

- [ ] **SEC-045: Secret-Generierung-Script**
  - `scripts/generate_secrets.py`
  - Aufwand: 30 Minuten

**Phase 4 Gesamt: ~6 Stunden**

---

## PHASE 5: TESTING & AUDIT (Woche 4-5)

### Dependency Scanning

- [ ] **SEC-046: npm audit ausführen**
  - Befehl: `npm audit --audit-level=high`
  - Aufwand: 30 Minuten + Fixes

- [ ] **SEC-047: safety (Python) installieren und ausführen**
  - Befehl: `pip install safety && safety check`
  - Aufwand: 30 Minuten + Fixes

- [ ] **SEC-048: Dependabot konfigurieren**
  - `.github/dependabot.yml`
  - Aufwand: 30 Minuten

### Security Testing

- [ ] **SEC-049: OWASP ZAP Scan**
  - Automatisierter Security-Scan
  - Aufwand: 2 Stunden

- [ ] **SEC-050: Security Headers validieren**
  - URL: https://securityheaders.com
  - Aufwand: 30 Minuten + Fixes

- [ ] **SEC-051: SSL/TLS-Konfiguration prüfen**
  - URL: https://www.ssllabs.com/ssltest/
  - Aufwand: 30 Minuten

- [ ] **SEC-052: Manueller Penetration-Test**
  - SQL-Injection, XSS, CSRF, Auth-Bypass testen
  - Aufwand: 4-8 Stunden (oder externer Dienstleister)

### Documentation

- [ ] **SEC-053: Security-Dokumentation**
  - Incident Response Plan
  - Secret Rotation Prozess
  - Aufwand: 2 Stunden

- [ ] **SEC-054: GDPR-Compliance-Checklist**
  - Data Processing Agreement
  - Privacy Policy
  - Aufwand: 2 Stunden

**Phase 5 Gesamt: ~12-16 Stunden**

---

## Zusammenfassung

| Phase | Aufgaben | Geschätzte Zeit | Priorität |
|-------|----------|-----------------|-----------|
| Phase 1 | 9 Tasks | ~3 Stunden | **KRITISCH** |
| Phase 2 | 18 Tasks | ~15 Stunden | HOCH |
| Phase 3 | 11 Tasks | ~13 Stunden | MITTEL |
| Phase 4 | 7 Tasks | ~6 Stunden | INFRASTRUKTUR |
| Phase 5 | 9 Tasks | ~12-16 Stunden | TESTING |

**Gesamt: 54 Tasks, ~50-55 Stunden**

---

## Checkliste für Go-Live

Bevor das System in Produktion geht:

```
[ ] Alle Phase-1-Tasks erledigt
[ ] Alle Phase-2-Tasks erledigt
[ ] Security Headers aktiv (securityheaders.com: A+)
[ ] SSL/TLS korrekt (ssllabs.com: A+)
[ ] Keine kritischen Vulnerabilities (npm audit, safety)
[ ] Rate Limiting getestet
[ ] Brute-Force Protection getestet
[ ] XSS manuell getestet
[ ] SQL-Injection manuell getestet
[ ] CSRF manuell getestet
[ ] Error-Seiten zeigen keine Stack Traces
[ ] Logs enthalten keine Passwörter/Tokens
[ ] Secrets nicht im Git-Repository
[ ] Backup-Strategie dokumentiert
[ ] Incident Response Plan vorhanden
```

---

## Quick Reference: Wichtigste Befehle

```bash
# Dependencies für Security
pip install slowapi bleach python-magic structlog starlette-csrf
npm install dompurify @types/dompurify

# Secret generieren
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Dependency Scan
npm audit --audit-level=high
pip install safety && safety check

# Security Headers testen
curl -I https://your-domain.com | grep -i "x-frame\|x-content\|strict\|content-security"
```

---

*Diese Liste sollte als lebendes Dokument behandelt werden. Nach Abschluss jeder Phase: Datum und verantwortliche Person dokumentieren.*
