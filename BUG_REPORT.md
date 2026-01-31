# Bug Report - Smart Document Generator

**Datum:** 2026-01-31
**Tester:** Claude (QA)
**Umgebung:** Production (Vercel + Railway)

---

## Kritische Bugs

### BUG-001: Keine Login-Seite vorhanden
**Schweregrad:** KRITISCH
**Status:** Offen

**Beschreibung:**
Das Frontend hat keine Login-Seite. Der Benutzer wird mit Mock-Daten ("Max Mustermann") angezeigt, aber es gibt keine echte Authentifizierung.

**Betroffene Dateien:**
- `frontend/src/components/layout/UserDropdown.tsx` - Zeigt Mock-User
- Fehlende: `frontend/src/pages/LoginPage.tsx`
- Fehlende: Auth Context/Provider

**Auswirkung:**
- Benutzer können sich nicht einloggen
- API-Calls schlagen mit "Not authenticated" fehl
- Keine Dokumenttypen werden geladen

**Reproduktion:**
1. Öffne https://smart-doc-generator.vercel.app/
2. Klicke auf "Jetzt starten"
3. Modal zeigt "Keine Dokumenttypen gefunden" (API 401 Fehler)

**Lösung erforderlich:**
1. Login-Seite erstellen
2. Auth-Context mit Token-Management
3. Protected Routes implementieren
4. Login-Form mit Backend `/api/v1/auth/login` verbinden

---

### BUG-002: API-Calls ohne Authentifizierung
**Schweregrad:** KRITISCH
**Status:** Offen

**Beschreibung:**
`useApi.ts` verwendet direktes `fetch()` ohne Authorization-Header, obwohl `api-client.ts` existiert, der Auth korrekt handhabt.

**Betroffene Dateien:**
- `frontend/src/hooks/useApi.ts` (102 fetch-Aufrufe)
- 26 weitere Dateien mit direktem fetch()

**Auswirkung:**
- Alle API-Calls schlagen fehl (401 Unauthorized)
- Dokumenttypen, Klauseln, etc. werden nicht geladen

**Lösung erforderlich:**
1. `useApi.ts` refactoren, um `api-client.ts` zu verwenden
2. Oder Auth-Header in allen fetch()-Calls hinzufügen

---

### BUG-003: Fehlender Setup-Flow im Frontend
**Schweregrad:** HOCH
**Status:** Offen (Backend behoben)

**Beschreibung:**
Nach neuem Deployment gibt es keinen Admin-User. Das Backend hat jetzt einen `/api/v1/setup/initialize` Endpoint, aber das Frontend hat keine Setup-Seite.

**Backend-Status:** Behoben
- `/api/v1/setup/status` - Prüft ob Setup nötig
- `/api/v1/setup/initialize` - Erstellt ersten Admin

**Frontend-Status:** Fehlt
- Keine Setup-Seite
- Keine automatische Weiterleitung zum Setup

---

## Mittel-schwere Bugs

### BUG-004: Console-Fehler bei Start
**Schweregrad:** MITTEL
**Status:** Bedingt durch BUG-001/002

**Beschreibung:**
Mehrere API-Fehler in der Browser-Console beim Laden der App:
```
[ERROR] API Error: GET /api/v1/document-types/ Object
[ERROR] Failed to load document types Object
```

---

## Behobene Probleme (in dieser Session)

### FIXED-001: Database-Tabellen nicht erstellt
- Automatische Tabellen-Erstellung beim App-Start hinzugefügt
- Commit: 9dee1c9

### FIXED-002: Setup-API fehlte
- `/api/v1/setup/status` und `/api/v1/setup/initialize` hinzugefügt
- Commit: 79fe95f

### FIXED-003: Asyncpg-URL-Konvertierung
- `app/db.py` konvertiert jetzt `postgresql://` zu `postgresql+asyncpg://`
- Früher bereits committed

---

## Nächste Schritte (Priorisiert)

1. **Login-Seite erstellen** (BUG-001)
   - Route: `/login`
   - Formular mit Email/Password
   - Token in localStorage speichern

2. **Auth-Context implementieren**
   - Protected Routes
   - automatische Weiterleitung bei 401

3. **useApi.ts refactoren** (BUG-002)
   - `api-client.ts` nutzen
   - Oder Auth-Header hinzufügen

4. **Setup-Seite erstellen** (BUG-003)
   - Prüfen ob Setup nötig (`/api/v1/setup/status`)
   - Admin-Erstellung wenn `setup_required: true`

---

## Test-Credentials (Development)

**Admin-User (auf Railway erstellt):**
- Email: `admin@niederwieser.com`
- Password: `NW-DocGen-2024!`

**API-Token testen:**
```bash
curl -X POST "https://smart-doc-generator-production.up.railway.app/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@niederwieser.com&password=NW-DocGen-2024!"
```
