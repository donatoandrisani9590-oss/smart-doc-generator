# QA AUDIT REPORT - Document Generator

**Datum:** 25.01.2026
**Auditor:** Lead QA Engineer / Senior Product Manager
**Version:** 1.0
**Scope:** Full Codebase Whitebox & Blackbox Testing

---

## EXECUTIVE SUMMARY

Die Codebase zeigt eine solide Grundarchitektur mit modernem Tech-Stack (FastAPI, React 19, TanStack Query), hat aber **kritische Lücken**, die vor Production-Release behoben werden müssen. Insbesondere fehlen eine 404-Route, es gibt Race Conditions im State Management, und einige API-Endpoints haben fehlende Authentifizierung.

**Gesamtbewertung:** 6.5/10 - Funktional, aber nicht production-ready.

---

## 🔴 KRITISCH (Sofort beheben)

### K1: Fehlende 404-Route - App.tsx:22-41
**Datei:** `frontend/src/App.tsx`
**Problem:** Keine Wildcard-Route für unbekannte Pfade. User die einen falschen Link besuchen sehen eine leere Seite statt einer Fehlermeldung.

```tsx
// FEHLT:
<Route path="*" element={<NotFoundPage />} />
```

**Impact:** User stranden auf leerer Seite, keine Möglichkeit zur Navigation zurück.
**Fix:** Wildcard-Route am Ende der Routes hinzufügen mit Link zur Startseite.

---

### K2: Preview-Endpoint ohne Auth - preview.py:57-151
**Datei:** `backend/app/api/v1/endpoints/preview.py`
**Problem:** Der `/api/v1/preview/html` Endpoint hat **keine Authentifizierung**. Jeder kann Dokumenten-Previews generieren.

```python
@router.post("/html", response_class=HTMLResponse)
async def generate_preview(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db)  # ❌ KEIN current_user!
) -> str:
```

**Impact:** Unbefugter Zugriff auf Klausel-Inhalte und Firmendesign möglich.
**Fix:** `current_user: Annotated[User, Depends(get_current_user)]` hinzufügen.

---

### K3: Cache-Clear ohne Admin-Check - preview.py:222-227
**Datei:** `backend/app/api/v1/endpoints/preview.py`

```python
@router.post("/cache/clear")
async def clear_preview_cache():
    """Clear all preview caches. Admin only."""  # ❌ KOMMENTAR SAGT ADMIN, ABER KEIN CHECK!
    from app.services.cache import invalidate_all
    await invalidate_all()
```

**Impact:** Jeder authentifizierte User kann den gesamten Cache löschen = DoS-Vektor.
**Fix:** `Depends(get_current_active_admin)` hinzufügen.

---

### K4: XSS-Risiko im Backend Preview - preview.py:122-129
**Datei:** `backend/app/services/preview.py`
**Problem:** Custom Clause Content wird **NICHT sanitiert** bevor es ins HTML eingebettet wird.

```python
if custom_clause and custom_clause.get("content"):
    content_html += f"""
    <div class="custom-clause">
        <h2>{custom_clause.get('title', 'Sondervereinbarung')}</h2>
        {custom_clause.get('content')}  # ❌ UNSANITIZED!
    </div>
    """
```

**Impact:** Angreifer können JavaScript in Dokument-Previews einschleusen.
**Fix:** HTML-Escape oder Whitelist-basierte Sanitization im Backend.

---

### K5: Race Condition bei Bulk-Job Status - bulk.py:585-588
**Datei:** `backend/app/api/v1/endpoints/bulk.py`
**Problem:** Kein DB-Lock beim Status-Update. Bei gleichzeitigem Zugriff kann der Job-Status inkonsistent werden.

```python
job.status = "CANCELLED"
await db.commit()
# ❌ Zwischen Lesen und Schreiben kann der Celery-Task den Status ändern
```

**Impact:** Job könnte als CANCELLED markiert werden, aber trotzdem weiterlaufen.
**Fix:** `SELECT ... FOR UPDATE` verwenden oder optimistisches Locking.

---

### K6: DocumentGenerator verwendet nicht api-client - DocumentGenerator.tsx:287-302
**Datei:** `frontend/src/pages/DocumentGenerator.tsx`
**Problem:** Direkte `fetch()` Aufrufe statt des zentralen `api`-Clients. Dadurch fehlen: Auth-Token, Retry-Logik, Timeout, Error-Handling.

```tsx
const response = await fetch("/api/v1/preview/html", {  // ❌ DIREKT FETCH
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({...}),
});
```

**Impact:** Previews funktionieren nicht für eingeloggte User (kein Auth-Token), keine Retry bei Netzwerkfehlern.
**Fix:** `api.post()` aus `@/lib/api-client` verwenden.

---

### K7: Generation-Endpoint mit falscher Request-Struktur - DocumentGenerator.tsx:370-378
**Datei:** `frontend/src/pages/DocumentGenerator.tsx`

```tsx
const response = await fetch(`/api/v1/documents/generate/template.docx`, {
    body: JSON.stringify({
        context: formData,  // Frontend sendet "context"
        output_format: format,
        ...
    }),
});
```

**Backend erwartet:** `backend/app/api/v1/endpoints/generation.py:38-42`
```python
async def generate_document(
    template_name: str,
    context: dict,  # Das kommt als separate Parameter, nicht im Body!
```

**Impact:** Dokumentgenerierung funktioniert nicht korrekt.
**Fix:** API-Contract zwischen Frontend und Backend abgleichen.

---

### K8: Hardcoded documentTypeId - DocumentGenerator.tsx:162
**Datei:** `frontend/src/pages/DocumentGenerator.tsx`

```tsx
const [documentTypeId] = useState(1); // Would come from selection
```

**Problem:** Dokumenttyp ist immer 1, Select-Dropdown hat keine Funktion.
**Impact:** User kann nur einen Dokumenttyp generieren.
**Fix:** State mit Select verknüpfen und vom Server laden.

---

### K9: Template-Whitelist zu klein - generation.py:16-26
**Datei:** `backend/app/api/v1/endpoints/generation.py`

```python
ALLOWED_TEMPLATES = {
    "arbeitsvertrag",
    "arbeitsvertrag_teilzeit",
    ...
}  # 9 Templates
```

**Frontend sendet:** `template.docx` (nicht in Whitelist!)
**Impact:** ALLE Dokument-Generierungen schlagen fehl mit 400 Error.
**Fix:** Whitelist erweitern oder dynamisch aus DB laden.

---

### K10: datetime.utcnow() deprecated - security.py:17
**Datei:** `backend/app/core/security.py`

```python
expire = datetime.utcnow() + expires_delta  # ❌ DEPRECATED since Python 3.12
```

**Impact:** Kann in zukünftigen Python-Versionen zu Warnings/Fehlern führen.
**Fix:** `datetime.now(timezone.utc)` verwenden.

---

## 🟠 UX / USABILITY (Wichtig)

### U1: Kein Feedback bei Dokumenttyp-Wechsel
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:489-498`
**Problem:** Select für Dokumenttyp hat `defaultValue` aber keine `onValueChange` Handler. Wechsel hat keinen Effekt.

**User-Erlebnis:** "Ich wähle einen anderen Typ, aber es passiert nichts?"

---

### U2: Double-Submit möglich bei Export
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:673-689`
**Problem:** Buttons werden erst nach `setIsGenerating(true)` disabled, aber zwischen Klick und State-Update kann User nochmal klicken.

```tsx
<Button
    onClick={() => handleExport("pdf")}
    disabled={isGenerating}  // Race Condition möglich
>
```

**Fix:** `onClick` sollte sofort returnen wenn bereits generating.

---

### U3: Recovery-Dialog ohne Escape/Außen-Klick
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:414-460`
**Problem:** Dialog hat kein `onOpenChange` mit Escape-Handler. User muss explizit Button klicken.

---

### U4: Keine Validierung vor Export
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:361-406`
**Problem:** Pflichtfelder (Vorname, Nachname, Gehalt etc.) werden nicht validiert. User kann leeres Dokument generieren.

**User-Erlebnis:** Export funktioniert, aber Dokument hat `[vorname]` Platzhalter statt Namen.

---

### U5: Auto-Save Feedback nur bei Erfolg
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:316-342`
**Problem:** Bei Server-Fehler zeigt Toast, aber `lastSaved` bleibt auf altem Wert. User sieht "Gespeichert um 14:30" obwohl neuere Änderungen nicht gespeichert wurden.

---

### U6: Seitenleiste hat keine Mobile-Ansicht
**Datei:** `frontend/src/components/layout/Sidebar.tsx`
**Problem:** Keine responsive Breakpoints für Sidebar. Auf Mobile vermutlich komplett sichtbar oder overflow.

---

### U7: Error-Banner stacken ohne Position-Offset
**Datei:** `frontend/src/hooks/useErrorHandler.tsx:238-277`
**Problem:** Alle Error-Banner haben `top-4 right-4` - sie überlappen sich bei mehreren Fehlern.

---

### U8: Offline-Banner blockiert UI
**Problem:** Wenn offline, werden alle Queries disabled, aber User kann weiterhin Formulare ausfüllen. Beim Submit kommt dann erst der Fehler.

**Fix:** Formulare sollten auch disabled werden oder zumindest einen Offline-Hinweis zeigen.

---

### U9: Keine Bestätigung bei Daten-Verwerfen
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:267-270`
**Problem:** "Verwerfen" Button löscht sofort ohne Rückfrage.

```tsx
const handleRecoveryDecline = () => {
    clearLocalStorage();  // ❌ Keine Bestätigung
    setShowRecoveryDialog(false);
};
```

---

### U10: Clipboard-Copy ohne Toast
**Datei:** `frontend/src/components/ErrorBoundary.tsx:76-78`
**Problem:** `navigator.clipboard.writeText` verwendet `alert()` statt Toast-System.

---

## 🟡 CODE QUALITÄT / REFACTORING

### Q1: Inconsistent Error Response Handling
**Problem:** Backend sendet `detail` (FastAPI default), Frontend erwartet teilweise `message`.

```typescript
// api-client.ts:86-87
if (body.message) message = body.message;
if (body.detail) message = body.detail;  // Fallback
```

**Fix:** Einheitliches Error-Format definieren.

---

### Q2: Clause-Liste ist hardcoded
**Datei:** `frontend/src/pages/DocumentGenerator.tsx:167-246`
**Problem:** 7 Klauseln sind im Frontend hardcoded statt vom Server geladen.

---

### Q3: console.error statt logger
**Mehrere Dateien:** `DocumentGenerator.tsx:106,129,299,330,398`
**Problem:** Direkte `console.error()` statt zentralem `logError()`.

---

### Q4: Keine TypeScript Strict Null Checks
**Problem:** Optional Chaining nicht konsistent. Beispiel:

```typescript
// api-client.ts:154
const token = localStorage.getItem("auth_token");
if (token) {  // Gut
    requestHeaders["Authorization"] = `Bearer ${token}`;
}

// Aber anderswo:
recoveryData.formData.vorname  // Könnte undefined sein
```

---

### Q5: Magic Strings für Query Keys
**Problem:** Query Keys wie `["clauses"]`, `["document-types"]` sind über Codebase verstreut statt zentralisiert.

**Fix:** Constants-Datei für Query Keys anlegen.

---

### Q6: Keine API-Version im Frontend-Code
**Problem:** `/api/v1/...` ist überall hardcoded. Bei API-Versionsupdate viele Änderungen nötig.

**Fix:** Base-URL in Konstante oder Environment-Variable.

---

### Q7: Fehlende Index auf häufige Queries
**Datei:** `backend/app/models/documents.py`
**Problem:** Einige häufig gefilterte Felder haben keinen Index (z.B. `created_at` für Sortierung).

---

### Q8: Sync-Exception in Async-Code
**Datei:** `backend/app/api/v1/endpoints/preview.py:126-129`

```python
try:
    condition = json.loads(ref.condition) if isinstance(ref.condition, str) else ref.condition
except:  # ❌ Bare except
    pass
```

**Fix:** `except (json.JSONDecodeError, TypeError):` verwenden.

---

### Q9: Temp-Files werden nicht aufgeräumt
**Datei:** `backend/app/api/v1/endpoints/bulk.py:158,185`

```python
temp_path = f"/tmp/template_{document_type_id}.xlsx"
# ❌ Wird nie gelöscht
```

**Fix:** `tempfile.NamedTemporaryFile` mit Auto-Cleanup oder Background-Task.

---

### Q10: Doppelte Validation-Logik
**Problem:** Validierung existiert in:
- `frontend/src/lib/validations.ts` (Zod)
- `backend/app/api/v1/endpoints/bulk.py:241-310` (Python)

**Fix:** Validierungsregeln sollten vom Backend kommen (FormField-Definition) und Frontend generiert daraus Zod-Schemas.

---

## 🔵 MISSING FEATURES

### M1: Refresh Token Implementation
**Problem:** Config hat `REFRESH_TOKEN_EXPIRE_DAYS` aber keine Implementation. Access Token läuft nach 60min ab, dann muss User neu einloggen.

---

### M2: Rate Limiting
**Problem:** Kein Rate Limiting auf API-Endpoints. Bulk-Endpoint könnte für DoS missbraucht werden.

---

### M3: CSRF Protection
**Problem:** Keine CSRF-Tokens. SameSite-Cookies allein reichen nicht für alle Angriffsvektoren.

---

### M4: Request Cancellation
**Datei:** `frontend/src/lib/api-client.ts:165-178`
**Problem:** AbortController wird erstellt aber bei Component-Unmount nicht abgebrochen.

```typescript
const controller = new AbortController();
// ❌ Kein Cleanup bei Unmount
```

---

### M5: Optimistic Update Rollback UI
**Problem:** Bei Fehler wird zwar gerollt, aber User sieht keinen Hinweis warum Item wieder erscheint.

---

### M6: Audit-Log für alle Aktionen
**Problem:** AuditLog-Model existiert, aber viele Endpoints loggen nicht.

---

### M7: File Upload Virus Scanning
**Problem:** CSV/Excel Uploads werden nicht auf Malware gescannt.

---

### M8: Password Reset Flow
**Problem:** `resetPasswordSchema` existiert, aber kein Endpoint/UI dafür.

---

### M9: Multi-Tab Sync
**Problem:** Wenn User in zwei Tabs arbeitet, keine Synchronisation. Einer überschreibt den anderen.

---

### M10: Accessibility: Skip Links
**Problem:** `useSkipLink` Hook existiert, aber `SkipLink` Component nicht im Layout eingebunden.

---

## TEST-COVERAGE ANALYSE

### Unit Tests: 0%
- Keine `*.test.ts` oder `*.spec.ts` Dateien im Frontend
- Nur 2 Test-Dateien im Backend (`test_auth.py`, `test_generation.py`)

### Integration Tests: 0%
- Keine Multi-Component-Tests

### E2E Tests: 0%
- Kein Playwright/Cypress Setup

### Empfohlene Priorität:
1. Unit Tests für `useFormValidation`, `api-client`, `sanitize.ts`
2. Integration Tests für Document Generation Flow
3. E2E Tests für kritische User Journeys

---

## SECURITY CHECKLIST

| Check | Status | Details |
|-------|--------|---------|
| XSS Prevention (Frontend) | ✅ | DOMPurify implementiert |
| XSS Prevention (Backend) | ❌ | Custom Clause nicht sanitiert |
| SQL Injection | ✅ | SQLAlchemy ORM verhindert |
| Auth auf allen Endpoints | ❌ | Preview-Endpoints fehlen |
| Password Hashing | ✅ | bcrypt implementiert |
| JWT Best Practices | ⚠️ | Kein Refresh Token |
| CORS Config | ✅ | Konfigurierbar |
| Rate Limiting | ❌ | Nicht implementiert |
| Input Validation | ⚠️ | Teilweise |
| File Upload Security | ⚠️ | Basis-Checks, kein AV |

---

## PRIORITÄTS-MATRIX

| Priorität | Issue | Aufwand | Impact |
|-----------|-------|---------|--------|
| P0 | K2, K3 (Auth fehlt) | 30min | Kritisch |
| P0 | K4 (XSS Backend) | 1h | Kritisch |
| P0 | K6, K7, K8, K9 (Generation broken) | 2h | Kritisch |
| P1 | K1 (404 Route) | 15min | Hoch |
| P1 | U1, U2, U4 (UX Bugs) | 2h | Hoch |
| P2 | Q1-Q10 (Code Quality) | 4h | Mittel |
| P3 | M1-M10 (Missing Features) | 2+ Wochen | Enhancement |

---

## NÄCHSTE SCHRITTE

### Sofort (vor nächstem Deploy):
1. Auth auf Preview-Endpoints
2. XSS-Fix im Backend
3. 404-Route hinzufügen
4. DocumentGenerator API-Calls fixen

### Diese Woche:
1. Validierung vor Export
2. Double-Submit Prevention
3. Query-Key Constants
4. Unit Tests für kritische Hooks

### Diesen Monat:
1. Refresh Token Implementation
2. Rate Limiting
3. Full E2E Test Suite
4. Security Audit durch externen Dienstleister

---

*Report generiert am 25.01.2026*
