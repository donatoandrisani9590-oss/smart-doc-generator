# UAT Session: Document Generator QA Audit

**Created:** 2026-01-25
**Based on:** QA_AUDIT_REPORT.md, QA_TODO_LIST.md, GAP_ANALYSIS_REPORT.md
**Status:** In Progress

---

## Test Categories

### P0 - Blocker Tests (Critical Security & Functionality)
| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 1 | 404 Route | Visiting `/gibts-nicht` shows 404 page with navigation back | **FAIL** | Browser googelt die Eingabe statt 404-Seite |
| 2 | Preview Auth | Unauthenticated POST to `/api/v1/preview/html` returns 401 | pending | |
| 3 | Cache Clear Admin | Non-admin POST to `/api/v1/preview/cache/clear` is rejected | pending | |
| 4 | XSS in Preview | Custom clause with `<script>alert('XSS')</script>` is sanitized | pending | |
| 5 | Document Type Selection | Changing document type in generator updates clauses | pending | |
| 6 | Document Export | Exporting a document with valid form data works | pending | |

### P1 - UX Tests (User Experience Issues)
| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 7 | Form Validation | Export with empty required fields shows validation errors | pending | |
| 8 | Double-Submit | Rapidly clicking export button only triggers one request | pending | |
| 9 | Clauses Load | Clauses load from server (not hardcoded) | pending | |
| 10 | Error Banner Stacking | Multiple errors display without overlapping | pending | |

### P2 - Code Quality (Visible Behavior)
| # | Test | Expected | Status | Notes |
|---|------|----------|--------|-------|
| 11 | API Client Usage | Preview requests include auth token | pending | |
| 12 | Mobile Sidebar | Sidebar is usable on mobile viewport | pending | |

---

## Session Log

### Test 1: 404 Route
**Expected:** Visiting an invalid URL shows a 404 page with links to navigate back
**Started:** 2026-01-25

