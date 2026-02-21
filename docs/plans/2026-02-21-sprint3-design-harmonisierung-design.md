# Sprint 3: Design-Harmonisierung — Design

**Datum:** 2026-02-21
**Scope:** 4 Frontend-Design-Fixes aus dem System-Audit
**Ziel:** Visuelles Premium-Gefühl durch konsistente Tokens (z-index, Farben, Typografie, Radien)

---

## Fix 1: Z-Index-Skala standardisieren

### Problem
50+ z-index-Werte kreuz und quer: Tooltips auf z-50 (gleich wie Modals), Sticky-Header auf z-40 (gleich wie Backdrop), Floating-Labels auf z-10 (zu niedrig). Konflikte: Tooltip überlappt Modal, Dropdown verschwindet hinter Header.

### Lösung — 5-Stufen-Hierarchie

```
z-10  → Floating indicators, progress bars, inline overlays
z-20  → Tooltips, popovers, autocomplete dropdowns
z-30  → Sticky headers, action panels, navigation
z-40  → Backdrop overlays (dark screen behind modals)
z-50  → Modals, dialogs, toasts (oberste Schicht)
```

### Betroffene Dateien (~15)

| Datei | Aktuell | Neu | Zeile |
|-------|---------|-----|-------|
| `ui/dialog.tsx` | z-50 (overlay + modal) | z-40 (overlay) + z-50 (modal) ✅ | 23, 43 |
| `ui/tooltip.tsx` | z-50 | **z-20** | 21 |
| `layout/HeaderNav.tsx` | z-40 (header) + z-30 (mobile) | z-30 (header) + z-30 (mobile) ✅ | 50, 140 |
| `notifications/NotificationDropdown.tsx` | z-40 + z-50 | z-40 (backdrop) + z-50 → **z-20** (dropdown) | 107, 112 |
| `layout/CountrySelector.tsx` | z-50 | **z-20** | 70 |
| `generator/editor/RightEditorPanel.tsx` | z-10 | z-10 ✅ (correct) | 151 |
| `documents/DocumentApprovalPanel.tsx` | z-10 | **z-20** (autocomplete) | 590 |
| `dashboard/ActivityChart.tsx` | z-10 | z-10 ✅ (chart tooltip, correct) | 67 |

### Risiko
Niedrig — rein visuelle Änderung, keine Logik betroffen.

---

## Fix 2: Hardcoded Hex-Colors → Semantic Design Tokens

### Problem
30+ Hex-Farbwerte direkt in JSX statt Design-Tokens. Beispiel: `text-[#1D1D1F]` statt `text-foreground`. Änderungen am Design-System (z.B. Dark-Mode) werden so nicht propagiert.

### Lösung — Mapping-Tabelle

| Hardcoded | Semantic Token | Dateien |
|-----------|----------------|---------|
| `text-[#1D1D1F]` | `text-foreground` | Dashboard.tsx:102, StatWidget.tsx:37, CompanySettingsPage.tsx (5x) |
| `text-[#86868B]` | `text-muted-foreground` | Dashboard.tsx:105, StatWidget.tsx:41,46 |
| `text-[#243186]` | `text-primary` | Dashboard.tsx |
| `text-[#6EBD84]` | `text-secondary` | Repository.tsx:212 |
| `from-[#243186]/5` | `from-primary/5` | AttachmentsPage.tsx (3x) |

**CSS-Datei-Fixes (index.css):**
| Hardcoded | Token |
|-----------|-------|
| `#374151` | `hsl(var(--muted-foreground))` |
| `#9ca3af` | `hsl(var(--muted-foreground) / 0.6)` |
| `#eef2ff`, `#4f46e5`, `#e0e7ff` | `hsl(var(--primary) / 0.05)`, `hsl(var(--primary))`, `hsl(var(--primary) / 0.1)` |

### Betroffene Dateien (~10)
- `pages/Dashboard.tsx` (3 Stellen)
- `components/dashboard/StatWidget.tsx` (3 Stellen)
- `pages/admin/CompanySettingsPage.tsx` (5 Stellen)
- `pages/Repository.tsx` (2 Stellen)
- `pages/admin/AttachmentsPage.tsx` (3 Stellen)
- `index.css` (6 Stellen)

### Risiko
Niedrig — Farben sind visuell identisch, nur die Quelle ändert sich.

---

## Fix 3: Typografie-Skala (Arbitrary px → Design-Tokens)

### Problem
50+ Stellen mit `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-[15px]` — bypassen das Tailwind Type System. Inkonsistente Textgrößen in ähnlichen Kontexten (Badges mal 10px, mal 11px, mal 12px).

### Lösung — Token-Mapping

**Neuer Token in `tailwind.config.js`:**
```js
fontSize: {
  '2xs': ['10px', { lineHeight: '14px' }],  // Badges, Mikro-Labels
}
```

**Mapping-Strategie:**
| Arbitrary | Standard/Token | Kontext |
|-----------|----------------|---------|
| `text-[9px]` | `text-2xs` (10px) | Minimal-Labels (DesignManager:724) |
| `text-[10px]` | `text-2xs` (10px) | Badges, Status-Labels (15+ Stellen) |
| `text-[11px]` | `text-xs` (12px) | Small metadata (13+ Stellen) |
| `text-[12px]` | `text-xs` (12px) | Secondary text (10+ Stellen) |
| `text-[13px]` | `text-sm` (14px) | Form labels, larger secondary (12+ Stellen) |
| `text-[15px]` | `text-base` (16px) | Section headers (2 Stellen) |

### Betroffene Dateien (~8 Hotspots)
- `pages/AgentPage.tsx` — 8 arbitrary sizes
- `pages/admin/LegalAuditPage.tsx` — 12 arbitrary sizes
- `pages/admin/DesignManager.tsx` — 7 arbitrary sizes
- `pages/Repository.tsx` — 4 arbitrary sizes
- `pages/Search.tsx` — 4 arbitrary sizes
- `pages/admin/CompanySettingsPage.tsx` — 5 arbitrary sizes
- `pages/SettingsHub.tsx` — 2 arbitrary sizes
- `pages/DocumentDetail.tsx` — 1 arbitrary size

### Risiko
Niedrig — visuelle Unterschiede sind 1-2px, im Kontext nicht wahrnehmbar.

---

## Fix 4: CSS Border-Radius → Design-Token-Variablen

### Problem
CSS-Dateien (`index.css`, `preview.css`, `magic-import.css`) verwenden hardcoded Pixel-Werte statt `var(--radius)`-Tokens. Tailwind-Config definiert schöne Radius-Stufen, aber CSS ignoriert sie.

### Lösung

**index.css (6 Fixes):**
- `border-radius: 6px` (line 597) → `border-radius: calc(var(--radius) - 6px)` (≈6px)
- `border-radius: 4px` (line 1039) → `border-radius: calc(var(--radius) - 8px)`
- `border-radius: 2px` (line 998) → `border-radius: 2px` (OK — sub-token level)
- `border-radius: 0` (lines 489, 1097) → `border-radius: 0` (intentional)

**preview.css (4 Fixes):**
- `border-radius: 8px` (lines 262, 269) → `border-radius: var(--radius-sm, 8px)`
- `border-radius: 4px` (lines 294, 383) → `border-radius: var(--radius-xs, 4px)`

**magic-import.css (3 Fixes):**
- `border-radius: 8px` (line 14) → `border-radius: var(--radius-sm, 8px)`
- `border-radius: 3px` (line 97) → `border-radius: 3px` (sub-token, OK)
- `border-radius: 4px` (line varies) → `border-radius: var(--radius-xs, 4px)`

**Inline-Styles (4 Fixes):**
- `OnboardingTour.tsx:260` — `borderRadius: "8px"` → Tailwind-Klasse `rounded-lg`
- `WorksCouncilTemplatesPage.tsx:247` — style → Tailwind-Klasse
- `PreviewPanel.tsx:109` — style → Tailwind-Klasse
- `VariableHighlighter.tsx:112` — style → Tailwind-Klasse

### Risiko
Niedrig — Pixel-Werte bleiben gleich, nur Source of Truth ändert sich.

---

## Nicht im Scope

- Spacing-Harmonisierung (gap/padding-Skala) — zu groß, eigener Sprint
- Dark-Mode-Anpassungen
- List-View Linear.app-Redesign (wäre eigenes Feature)
- Component-Level Radius-Refactoring (Tailwind-Klassen in TSX)
