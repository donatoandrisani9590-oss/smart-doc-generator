# Implementierungsplan: Kapitel 15 & 16 Features

> Basierend auf `smart-document-generator-v4.2.md`

---

## Status-Übersicht

| Status | Bedeutung |
|--------|-----------|
| ✅ | Bereits implementiert |
| 🔄 | Teilweise implementiert |
| ❌ | Noch nicht implementiert |

---

## Kapitel 15: HR Self-Service Optimierungen

### 🔴 KRITISCH (Priorität 1)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 15.2.1a | **Platzhalter-Picker** | ✅ | Dropdown im Editor mit kategorisierten Platzhaltern | - |
| 15.2.1b | **Platzhalter-Validierung** | ✅ | Tippfehler erkennen + Vorschläge (Levenshtein) | - |
| 15.2.2 | **Visueller Condition Builder** | ✅ | Keine JSON-Syntax, HR-freundliche Operatoren | - |
| 15.5.1 | **Formular-Anpassung** | ❌ | Labels, Validierung, Hilfetext pro Feld anpassen | Mittel |
| 15.5.2 | **Nachträgliche Korrektur** | ❌ | Generiertes Dokument bearbeiten → neue Version | Mittel |
| 15.5.3 | **Rechtschreibprüfung** | ✅ | Browser-native spellcheck aktiviert | - |

### 🟡 WICHTIG (Priorität 2)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 15.2.3 | **Live-Preview im Klausel-Editor** | ❌ | Split-View: Editor links, Vorschau rechts | Mittel |
| 15.2.4 | **Dokumenttyp duplizieren** | ✅ | Kopieren mit Klauseln, Anhängen, Feldern | - |
| 15.2.5 | **Auswirkungsanalyse** | ❌ | "Diese Klausel wird in X Dokumenttypen verwendet" | Klein |
| 15.2.6 | **HR Dashboard** | ✅ | Statistiken, Top-Dokumenttypen, Aktivität | - |
| 15.5.4 | **Favoriten & Schnellzugriff** | ✅ | Persönliche Favoriten in Sidebar | - |
| 15.5.5 | **Globale Suche** | ✅ | Über Dokumente & Entwürfe | - |
| 15.5.6 | **Klausel-Kommentare/Notizen** | ❌ | Interne Notizen pro Klausel (nicht im Dokument) | Klein |
| 15.5.7 | **Stammdaten-Verwaltung** | ❌ | Firmendaten, Standardwerte für neue Verträge | Klein |

### 🟢 NICE-TO-HAVE (Priorität 3)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 15.2.7 | **Fristen-Tracker** | ❌ | Probezeit-Ende, Befristungs-Ablauf + Reminder | Groß |
| 15.2.8 | **Word-Import** | ❌ | Bestehende .docx-Vorlagen importieren | Groß |
| 15.2.9 | **E-Signatur Integration** | ❌ | DocuSign, Adobe Sign, Click-to-Sign | Groß |
| 15.2.10 | **HR-System Integration** | ❌ | Personio, SAP, Workday API | Groß |
| 15.3 | **Freigabe-Workflow** | ❌ | 4-Augen-Prinzip für Klauseln | Mittel |
| 15.4 | **Onboarding & Hilfe** | ❌ | Tooltips, geführte Tour, Video-Tutorials | Mittel |
| 15.5.8 | **Tastaturkürzel** | ❌ | Ctrl+K, Ctrl+S, etc. für Power-User | Klein |
| 15.5.9 | **Offline-Modus (PWA)** | ❌ | Service Worker, lokale Speicherung | Groß |
| 15.5.10 | **Versionsvergleich** | ❌ | Side-by-Side Diff-Ansicht | Mittel |

---

## Kapitel 16: Dokumenten-Repository & Dashboard

### 🔴 KRITISCH (Priorität 1)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 16.2 | **Dashboard erweitern** | 🔄 | Entwürfe, Schnellstart-Favoriten vorhanden | Klein |
| 16.3 | **Dokumenten-Repository (DMS)** | ❌ | Zentrale Dokumentenliste mit Filtern, Suche | Mittel |
| 16.4 | **Dokument-Detailansicht** | ❌ | Versionen, Bearbeiten, Cloud-Status | Mittel |
| 16.5 | **Team-Ansicht/Vertretung** | ✅ | Team-Dokumente einsehen, Entwürfe übernehmen | - |

### 🟡 WICHTIG (Priorität 2)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 16.6 | **Cloud Storage Sync** | ❌ | SharePoint, OneDrive, SMB Auto-Upload | Groß |
| 16.7 | **Cloud Sync UI** | ❌ | "Hochgeladen nach SharePoint" anzeigen | Klein |
| 16.8 | **Erweitertes DB-Schema** | 🔄 | Teilweise vorhanden (Teams, etc.) | Klein |
| 16.12 | **Dokument teilen & Freigabe** | 🔄 | TeamDocumentShare vorhanden, UI fehlt | Klein |

### 🟢 NICE-TO-HAVE (Priorität 3)

| # | Feature | Status | Beschreibung | Aufwand |
|---|---------|--------|--------------|---------|
| 16.13 | **Klausel-System Details** | 🔄 | Typen, Nummerierung vorhanden | Klein |
| 16.14 | **Formularfelder Details** | 🔄 | FormField Model vorhanden | Klein |
| 16.15 | **Design-Manager erweitern** | 🔄 | Master-Templates in Word | Mittel |
| 16.16 | **Retention Rules Engine** | ❌ | Aufbewahrungsfristen automatisch | Mittel |
| 16.17 | **Repeater-Felder** | ❌ | Dynamische Tabellen (mehrere Zeilen) | Groß |
| 16.18 | **E-Signatur** | ❌ | Intern (Click-to-Sign) & Extern (DocuSign) | Groß |
| 16.19 | **Interne Freigabe-Workflows** | ❌ | Mehrstufige Genehmigung | Groß |
| 16.20 | **Betriebsrat-Vorlage** | ❌ | BR-Anhörung generieren | Klein |

---

## Empfohlene Implementierungs-Reihenfolge

### Phase 1: Kritische Features (sofort)

1. **15.5.1 - Formular-Anpassung**
   - Backend: `FormFieldCustomization` Model
   - API: CRUD für Feld-Anpassungen
   - Frontend: Formular-Builder UI

2. **15.5.2 - Nachträgliche Korrektur**
   - Backend: `document_versions` Tabelle erweitern
   - API: PUT /documents/{id}/edit → neue Version
   - Frontend: "Bearbeiten" Button + Formular mit Werten

3. **16.3 - Dokumenten-Repository**
   - Frontend: `/documents` Seite mit Tabelle
   - Filter: Typ, Zeitraum, Ersteller, Mitarbeiter
   - Pagination, Sortierung

4. **16.4 - Dokument-Detailansicht**
   - Frontend: `/documents/{id}` Seite
   - Versionshistorie anzeigen
   - Aktionen: Download, Bearbeiten, Duplizieren

### Phase 2: Wichtige Features (nächste Iteration)

5. **15.2.3 - Live-Preview im Klausel-Editor**
   - Split-View Komponente
   - Echtzeit-Rendering mit Beispieldaten

6. **15.2.5 - Auswirkungsanalyse**
   - API: GET /clauses/{id}/usage
   - Dialog beim Speichern: "Betrifft X Dokumenttypen"

7. **15.5.6 - Klausel-Kommentare**
   - Backend: `ClauseNote` Model
   - API: CRUD für Notizen
   - Frontend: Notizen-Tab im Klausel-Editor

8. **15.5.7 - Stammdaten-Verwaltung**
   - Backend: `CompanySettings` Model
   - API: GET/PUT /settings/company
   - Frontend: Admin-Seite für Firmendaten

9. **16.12 - Dokument teilen UI**
   - Dialog: "Mit Team teilen"
   - Liste der geteilten Dokumente im Team

### Phase 3: Nice-to-Have Features (später)

10. **15.2.7 - Fristen-Tracker**
11. **15.5.8 - Tastaturkürzel**
12. **15.5.10 - Versionsvergleich**
13. **16.6 - Cloud Storage Sync**
14. **15.3 - Freigabe-Workflow**
15. **16.16 - Retention Rules**

### Phase 4: Große Features (Roadmap)

16. **15.2.8 - Word-Import**
17. **15.2.9/16.18 - E-Signatur Integration**
18. **15.2.10 - HR-System Integration**
19. **15.5.9 - Offline-Modus (PWA)**
20. **16.17 - Repeater-Felder**
21. **16.19 - Interne Freigabe-Workflows**

---

## Nächste Schritte

Ich werde die Features in der empfohlenen Reihenfolge implementieren.

**Jetzt starten mit:**
1. ❌ 15.5.1 - Formular-Anpassung ohne IT
2. ❌ 15.5.2 - Nachträgliche Korrektur von Dokumenten
3. ❌ 16.3 - Dokumenten-Repository (DMS)
4. ❌ 16.4 - Dokument-Detailansicht

Soll ich mit der Implementierung beginnen?
