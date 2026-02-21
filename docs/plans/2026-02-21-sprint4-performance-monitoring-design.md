# Sprint 4: Performance & Monitoring — Design

**Datum:** 2026-02-21
**Scope:** 4 Fixes für Ladezeiten, Resilienz und Observability
**Ziel:** Schnelleres Initial Load, weniger DB-Calls, Frontend-Crash-Schutz, lückenlose LLM-Metriken

---

## Fix 1: Route-Based Code Splitting

### Problem
Keine `React.lazy()` oder dynamische Imports. Alle Routen (Admin, Generator, Reports, Settings, etc.) werden beim Initial Load geladen. Das Frontend-Bundle ist unnötig groß für den Erstaufruf.

### Lösung
Lazy-Loading für Route-Gruppen mit `React.lazy()` + `Suspense`:

**Chunk-Strategie:**
| Chunk | Routen | Erwartete Ersparnis |
|-------|--------|---------------------|
| `admin` | `/admin/*` (DesignManager, CompanySettings, LegalAudit, etc.) | ~30% weniger initial |
| `generator` | `/generate`, `/generate/bulk` | ~20% weniger initial |
| `settings` | `/settings/*` (SettingsHub, alle Tabs) | ~10% weniger initial |
| `reports` | `/reports/*` (LLMUsagePage, AuditPage) | ~5% weniger initial |

**Implementierung:**
```tsx
const AdminRoutes = lazy(() => import("@/pages/admin/AdminLayout"));
const GeneratorPage = lazy(() => import("@/pages/Generator"));
const SettingsHub = lazy(() => import("@/pages/SettingsHub"));
const LLMUsagePage = lazy(() => import("@/pages/admin/LLMUsagePage"));
```

**Fallback-Component:**
```tsx
<Suspense fallback={<PageSkeleton />}>
  <Route ... />
</Suspense>
```

### Betroffene Dateien
- `frontend/src/App.tsx` oder Router-Config (Route-Definitionen)
- Neue Datei: `frontend/src/components/ui/PageSkeleton.tsx` (Lade-Skeleton)

### Risiko
Niedrig — React.lazy ist stabil, Suspense-Boundary fängt Loading-States ab.

---

## Fix 2: Variant-Group-Cache im Preview-Endpoint

### Problem
`preview.py:216-261`: Bei jedem Preview-Request werden Variant Groups + ihre Clauses frisch aus der DB geladen. Design-Settings (TTL=300s) und Clauses (TTL=120s) sind gecacht, aber Variant Groups nicht.

### Lösung
Cache analog zu bestehendem Pattern:

```python
# Cache-Key
cache_key = f"preview:variants:{document_type_id}:{country_code}"

# Check cache first
cached = await cache.get(cache_key)
if cached:
    variant_groups = json.loads(cached)
else:
    # ... existing DB query ...
    await cache.set(cache_key, json.dumps(variant_groups), ttl=300)
```

### Cache-Invalidierung
- Bei Clause-Änderung: `cache.delete(f"preview:variants:*")` (Pattern-Delete)
- Bei DocumentType-Änderung: Gleicher Invalidierungspunkt
- Bestehende Invalidierung in `company_settings.py` erweitern

### Betroffene Dateien
- `backend/app/api/v1/endpoints/documents/preview.py:216-261`
- `backend/app/services/cache.py` (neuer Key-Helper)

### Risiko
Niedrig — Cache hat TTL, Worst-Case ist Stale-Data für 5 Minuten.

---

## Fix 3: Error Boundaries

### Problem
Kein `ErrorBoundary` Component im Frontend. Ein unbehandelter Fehler in einer Komponente (z.B. JSON.parse auf korrupten Daten) crasht die gesamte App mit weißem Bildschirm. Kein `unhandledrejection` Listener für Promise-Fehler.

### Lösung

**A. ErrorBoundary Component:**
```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError("React ErrorBoundary caught error", { error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}
```

**B. ErrorFallback UI (German):**
- Titel: "Etwas ist schiefgelaufen"
- Beschreibung: "Ein unerwarteter Fehler ist aufgetreten."
- Buttons: "Seite neu laden" + "Zur Startseite"

**C. Placement:**
- App-Level: Wrap um `<RouterProvider>` in `main.tsx`
- Route-Level: Wrap um kritische Routen (Generator, Admin)

**D. Global Promise Error Handler:**
```tsx
// main.tsx
window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', { reason: event.reason });
});
```

### Betroffene Dateien
- Neue Datei: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/main.tsx` (App-Level Wrap + unhandledrejection)
- Modify: `frontend/src/App.tsx` (Route-Level Wraps)

### Risiko
Niedrig — Additive Änderung, kein bestehendes Verhalten geändert.

---

## Fix 4: LLM-Logging-Audit

### Problem
`log_llm_call()` wird an 7 Call-Sites aufgerufen (refine, compliance, consistency, smart_mode, chat, clause_ai, document_upload), aber mindestens 4 weitere LLM-Call-Sites sind unklar:
- `magic_fill.py` — Status unbekannt
- `agent.py` — Status unbekannt
- `onboarding.py` — Status unbekannt
- `bulk_smart.py` — Status unbekannt

Außerdem: `log_llm_call()` Fehler werden nur mit `logger.debug()` geloggt (zu leise).

### Lösung

**A. Audit aller LLM-Call-Sites:**
1. Grep nach `llm.chat(`, `llm.chat_stream(`, `llm_service` in allen Endpoint-Dateien
2. Für jede fehlende Site: `log_llm_call()` hinzufügen mit korrektem `feature`-Tag

**B. Logging-Level anheben:**
- `llm_service.py:806`: `logger.debug()` → `logger.warning()` für fehlgeschlagenes Logging

**C. Feature-Tags standardisieren:**
| Endpoint | Feature-Tag |
|----------|-------------|
| refine.py | `"refine"` |
| compliance | `"compliance"` |
| consistency | `"consistency"` |
| smart_mode | `"smart_mode"` |
| chat | `"chat"` |
| clause_ai | `"clause_ai"` |
| document_upload | `"document_upload"` |
| magic_fill | `"magic_fill"` (NEU) |
| agent | `"agent"` (NEU) |
| onboarding | `"onboarding"` (NEU) |
| bulk_smart | `"bulk_smart"` (NEU) |
| draft | `"draft"` (prüfen) |

### Betroffene Dateien (~6)
- `backend/app/services/llm_service.py` (Logging-Level)
- `backend/app/api/v1/endpoints/smart/magic_fill.py` (+ log_llm_call)
- `backend/app/api/v1/endpoints/smart/agent.py` (+ log_llm_call)
- `backend/app/api/v1/endpoints/smart/onboarding.py` (+ log_llm_call)
- `backend/app/api/v1/endpoints/smart/bulk_smart.py` (+ log_llm_call)
- `backend/app/api/v1/endpoints/smart/draft.py` (prüfen)

### Risiko
Niedrig — rein additive Observability, kein Verhalten geändert.

---

## Nicht im Scope

- Web Vitals Frontend-Tracking (LCP, FID, CLS) — Nice-to-have, aber kein Bug
- Sentry/APM Integration — Infra-Entscheidung, nicht Code
- Bundle-Size-Analyse (vite-plugin-visualizer) — Tooling, nicht Feature
- Database Query Duration Monitoring — Requires middleware
- Bulk-Export Pagination-Limits — Edge case
