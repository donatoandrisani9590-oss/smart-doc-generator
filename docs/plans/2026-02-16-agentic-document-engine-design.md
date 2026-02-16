# Agentic Document Engine — Design Document

**Datum:** 2026-02-16
**Status:** Approved
**Ziel:** Von "Tool mit KI-Features" zu "KI-gesteuerter Dokumentenerstellung" — das Claude-Feeling fuer eine unternehmensweite Dokumentenplattform.

---

## 1. Vision

Die App wird zur KI-gestuetzten Dokumentenplattform fuer das gesamte Unternehmen. Jedes Team (HR, Sales, Legal, Buchhaltung, Einkauf, ...) erstellt in seinem Bereich passende Dokumente mit teamspezifischen Vorlagen, Textbausteinen und KI-Instruktionen.

**Zwei gleichwertige Wege:**
- **KI-Modus:** Chat-First — User beschreibt, KI erstellt
- **Manueller Modus:** Formulare — wie heute, aber smarter

Beide Modi arbeiten auf dem gleichen State (WizardContext).

---

## 2. Architektur: Agentic Workflow Engine

### 2.1 Gesamtbild

```
Frontend (React)
├── Mode Switch (KI / Manuell)
├── Document Canvas (Formulare + Editor + Preview)
├── Agent Chat Panel (Claude-artig, persistent)
│   └── Tool-Actions visuell dargestellt
│
Backend (FastAPI)
├── Agent Orchestrator (NEU)
│   ├── Claude API (Tool-Use, Reasoning)
│   ├── Tool Registry (8 Tools)
│   └── Memory Layer (Redis + DB)
├── Existing Smart Endpoints (Refine, Draft, Compliance, ...)
│   └── Groq/Mistral (bestehend, fuer einfache Tasks)
└── Existing Services (Templates, Clauses, Documents)
```

### 2.2 Multi-Provider Strategie

| Provider | Einsatz | Kosten |
|----------|---------|--------|
| **Claude (Sonnet/Haiku)** | Agent-Orchestrator, Tool-Use, komplexes Reasoning | ~$3-15/MTok |
| **Groq (Llama 3.1)** | Refine, Draft, einfache Chat-Antworten | Free Tier |
| **Mistral** | Fallback, EU-hosted Tasks | Paid |

**Routing-Logik:** Komplexitaet der Anfrage bestimmt Provider.
- Claude: Agent-Loop, Multi-Tool, Compliance-Deep-Scan
- Groq/Mistral: Text-Refine, Draft, Erklaerungen

---

## 3. Controlled AI: "Die KI arbeitet nur mit dem, was der Anwender vorgibt"

### 3.1 Die 4 Agent-Regeln

1. **KLAUSELN:** Bevorzugt aus der Team-Bibliothek waehlen. Wenn keine passt: KI erstellt Entwurf (gerahmt durch Team-Instruktionen), User bestaetigt inline, Klausel wird in Bibliothek gespeichert (Status: `draft`). **Der Workflow wird nie unterbrochen.**

2. **VORLAGEN:** Nur Team-eigene oder globale Briefvorlagen verwenden. Kein Layout erfinden.

3. **TEXT-GENERIERUNG:** Folge der 3-Ebenen-Instruktions-Hierarchie (Unternehmen > Team > Dokumenttyp). KI-generierter Text wird als "KI ✦" markiert.

4. **TEAM-ISOLATION:** Agent sieht nur Klauseln, Vorlagen und Instruktionen des aktiven Teams. Kein Cross-Team-Zugriff.

**Bei Widerspruechen:** Dokumenttyp > Team > Unternehmen
**Bei Unsicherheit:** Agent fragt den User.

### 3.2 Inline-Klausel-Erstellung ("Never Block, Always Grow")

Wenn der Agent eine Klausel braucht, die nicht existiert:
1. KI generiert Entwurf basierend auf Team-Instruktionen
2. User sieht Entwurf im Chat mit 3 Optionen:
   - "Uebernehmen & speichern" → In Dokument + Team-Bibliothek (Status: draft)
   - "Im Editor anpassen" → Inline-Edit → dann speichern
   - "Ohne diese Klausel fortfahren" → Ueberspringen
3. Klausel wird als `is_ai_generated=True` markiert
4. Team-Admin kann spaeter pruefen und zu `approved` hochstufen

---

## 4. 3-Ebenen-Instruktions-Hierarchie

### 4.1 Ebenen

| Ebene | Scope | Modell | Beispiel |
|-------|-------|--------|----------|
| **1. Unternehmen** | Alle Teams, alle Dokumente | `CompanySettings.ai_instructions` (bestehend) | "Geschlechtsneutral, Sie-Form, Firmensitz Muenchen" |
| **2. Team** | Alle Dokumente des Teams | `Team.ai_instructions` (NEU) | HR DE: "IGBCE-Tarifvertrag, ERA-Stufen" / Sales: "AGB v3.2, Zahlungsziel 30 Tage" |
| **3. Dokumenttyp** | Nur dieser Dokumenttyp | `DocumentType.ai_instructions` (bestehend) | "Kuendigungsschreiben: §102 BetrVG erwaehnen" |

### 4.2 Zusammenfuehrung im System-Prompt

```
UNTERNEHMENS-RICHTLINIEN (gelten immer):
{company_instructions}

TEAM-REGELN ({team.name}):
{team.ai_instructions}

DOKUMENTTYP-REGELN ({doc_type.name}):
{doc_type.ai_instructions}

WICHTIG: Halte dich strikt an diese Regeln.
Verwende NUR Textbausteine aus der Team-Bibliothek.
Verwende NUR Briefvorlagen des Teams.
Wenn du Text generieren musst, markiere ihn als "KI-generiert".
```

### 4.3 Gefuehrter Instruktions-Builder (Settings UX)

Statt leerem Textarea ein strukturierter Builder mit 4 universellen Kategorien:

1. **Regelwerk & Vertragsgrundlagen** — Freitext + Dropdown-Vorschlaege (Tarifvertrag, AGB, CCNL, Compliance-Richtlinie)
2. **Sprache & Tonalitaet** — Anrede (Sie/Du), Gendern, Tonalitaet, Fachsprache
3. **Pflichtangaben & Standards** — Liste von Must-Haves (z.B. "USt-IdNr im Footer", "Gerichtsstand Muenchen")
4. **Einschraenkungen** — No-Gos (z.B. "Keine Preise erfinden", "Keine Fristen eigenmaetig")
5. **Freie Anweisungen** — Escape-Hatch fuer Spezialfaelle

**KI-Vorschlag-Feature:** Die KI analysiert bestehende Dokumenttypen des Teams und schlaegt passende Regeln vor.
**Vorschau-Button:** Zeigt wie die Instruktionen als System-Prompt aussehen.

---

## 5. Agent Loop (Backend)

### 5.1 Ablauf

```
1. KONTEXT LADEN
   → Team-Instruktionen (3-Ebenen-Kaskade)
   → Verfuegbare Klauseln (Team-Bibliothek)
   → Verfuegbare Vorlagen (Team + Global)
   → Aktueller Formular-Stand
   → Mitarbeiter-History
   → Conversation Memory

2. CLAUDE API CALL (mit Tool-Definitionen)
   → System-Prompt mit Regeln + Kontext
   → 8 Tools definiert
   → Claude antwortet mit Text + Tool-Calls

3. TOOL EXECUTION
   → Backend fuehrt Tool aus (validiert gegen Team-Scope)
   → Ergebnis zurueck an Claude

4. ITERATION (bis Claude keine Tools mehr braucht)

5. FINALE ANTWORT → SSE Stream zum Frontend
```

### 5.2 Die 8 Agent-Tools

| Tool | Beschreibung | Validierung |
|------|-------------|-------------|
| `fill_form_fields` | Formularfelder setzen | Feldnamen gegen DocumentType.form_fields pruefen |
| `select_clauses` | Klauseln aktivieren/deaktivieren + Begruendung | Clause-IDs muessen zum Team gehoeren |
| `search_clauses` | Klausel-Bibliothek durchsuchen | Nur Team-Klauseln |
| `create_clause_draft` | KI-generierten Klausel-Entwurf erstellen | Team-Instruktionen anwenden, User muss bestaetigen |
| `search_employee_history` | Fruehere Dokumente abfragen | Nur eigene/Team-Dokumente |
| `run_compliance_check` | Compliance-Scan ausloesen | Bestehenden Service nutzen |
| `generate_text` | Kurzen Textabschnitt generieren | Markierung als KI-generiert, Instruktionen beachten |
| `generate_preview` | Dokument-Vorschau erzeugen | Bestehende Assembly-Logik |

### 5.3 SSE Event-Protokoll

```typescript
type AgentEvent =
  | { type: "thinking", content: string }
  | { type: "tool_start", tool: string, args: any }
  | { type: "tool_result", tool: string, result: any }
  | { type: "text_delta", content: string }
  | { type: "form_update", fields: Record<string,string> }
  | { type: "clause_update", enable: number[], disable: number[] }
  | { type: "clause_draft", title: string, content: string, requires_confirmation: true }
  | { type: "preview_ready", html: string }
  | { type: "done", summary: string }
```

---

## 6. Frontend UX: Hybrid-Modus

### 6.1 Dashboard: Modus-Wahl

Zwei gleichwertige Einstiegspunkte:
- **"KI-Assistent"** → Chat-First Layout (60/40)
- **"Neues Dokument"** → Bestehender Formular-Workflow

### 6.2 KI-Modus: Chat-First Layout

```
┌──────────────────────────────────────────────┐
│  ← Dashboard   Team: [Sales DACH]  [Manuell] │
│──────────────────────────────────────────────│
│                                               │
│  ┌─ CHAT (60%) ────┐┌─ LIVE-VORSCHAU (40%) ─┐│
│  │                  ││                        ││
│  │  Agent-Chat mit  ││  Dokument wird live    ││
│  │  Tool-Actions    ││  aufgebaut. Felder     ││
│  │  sichtbar:       ││  werden gelb markiert  ││
│  │                  ││  wenn Agent sie setzt.  ││
│  │  ⚙️ Formular... ││                        ││
│  │  ⚙️ Klauseln... ││  KI-Text mit ✦ markiert││
│  │  ✍️ Entwurf...  ││                        ││
│  │                  ││  Agent-Aktionen Panel: ││
│  │  Schnellauswahl  ││  ✓ 5 Felder gesetzt   ││
│  │  fuer Dok-Typen  ││  ✓ 3 Klauseln gewaehlt││
│  │  des Teams       ││  ○ Compliance-Check    ││
│  └──────────────────┘└────────────────────────┘│
└──────────────────────────────────────────────┘
```

**Key UX-Elemente:**
- Tool-Actions sind live sichtbar (nicht nur Text)
- Live-Vorschau rechts baut sich in Echtzeit auf
- KI-Markierung (✦) fuer generierten Text
- Jederzeit zu Manuell wechselbar (State bleibt)
- Schnellauswahl: Dokumenttypen des Teams als Chips
- Klausel-Draft-Card fuer Inline-Bestaetigung

### 6.3 Manueller Modus: Wie heute + Smart Features

Bestehender Formular-Workflow plus:
- **Autocomplete:** Mitarbeitername → Daten aus letztem Dokument vorschlagen
- **Smart Defaults:** Team-typische Werte vorausfuellen
- **Intelligentere Sidebar:** Chat kennt Formularstand, gibt proaktive Tipps
- **Nahtloser Wechsel:** Jederzeit zwischen KI/Manuell, State bleibt erhalten

---

## 7. Memory-System

### 7.1 Drei Schichten

| Schicht | Speicher | TTL | Scope | Zweck |
|---------|----------|-----|-------|-------|
| **Conversation** | Redis | 24h | Session | Chat-Verlauf, Tool-Calls, Formular-Snapshot |
| **Employee Cache** | DB (bestehend) | Permanent | Pro Mitarbeiter | Autocomplete, Konsistenz, Datenubernahme |
| **Team Patterns** | DB (neu) | 24h Refresh | Pro Team | Smart Defaults, haeufigste Werte |

### 7.2 Team Patterns

```python
class TeamPattern(Base):
    __tablename__ = "team_patterns"
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id"), index=True)
    document_type_id = Column(Integer, ForeignKey("document_types.id"))
    field_defaults = Column(Text)      # JSON: {"wochenstunden": "40", ...}
    common_clause_ids = Column(Text)   # JSON: [12, 15, 23, 42]
    sample_size = Column(Integer)
    calculated_at = Column(DateTime(timezone=True))
```

Berechnung: Background-Task analysiert letzte 50 Dokumente pro Team+Dokumenttyp alle 24h.

---

## 8. Datenbank-Aenderungen

### Neue Felder (Migrationen)

```python
# Team: 1 neues Feld
Team.ai_instructions = Column(Text, nullable=True)

# Clause: 2 neue Felder
Clause.is_ai_generated = Column(Boolean, default=False)
Clause.ai_generation_context = Column(Text, nullable=True)  # JSON

# Neue Tabelle
TeamPattern (team_id, document_type_id, field_defaults, common_clause_ids, ...)
```

### Aenderung an bestehender Logik

```python
# ai_instructions.py: get_ai_instructions() erweitern
# Neu: 3. Ebene (Team) zwischen Company und DocType einbauen
# Benoetigt: team_id Parameter
```

---

## 9. Implementierungs-Phasen

### Phase 0: Infrastruktur (~1 Sprint)
- Claude API-Client in llm_service.py
- Team.ai_instructions DB-Feld + Migration
- get_ai_instructions() erweitern um Team-Ebene
- Clause.is_ai_generated + ai_generation_context
- TeamPattern Modell + Migration
- Agent-Endpoint: POST /api/v1/agent/chat

### Phase 1: Agent Orchestrator (~2 Sprints)
- Agent Loop Backend (Claude Tool-Use)
- 8 Tool-Definitionen + Executor
- Team-isolierte Tool-Ausfuehrung
- Multi-Provider Router
- SSE Event-Protokoll
- Conversation Memory (Redis)

### Phase 2: Frontend KI-Modus (~2 Sprints)
- Modus-Wahl auf Dashboard
- Chat-First Layout (60/40 Split)
- Tool-Action-Visualisierung
- Klausel-Draft-Card im Chat
- Formular-Sync (Agent → WizardContext)
- Nahtloser Modus-Wechsel

### Phase 3: Instruktions-Builder (~1 Sprint)
- Team-Instruktions-Seite in Settings
- 4 Kategorien: Regelwerk, Sprache, Pflichtangaben, Einschraenkungen
- KI-Vorschlag-Feature
- Vorschau-Modus
- Unternehmensinstruktionen-Builder (analog)

### Phase 4: Smart Features (~1-2 Sprints)
- Employee Autocomplete
- Smart Defaults aus Team Patterns
- Background-Task: Pattern-Berechnung
- KI-generierte Klauseln: Approval-Queue
- Proaktive Chat-Vorschlaege im manuellen Modus

**Gesamt: ~7-8 Sprints (~3,5-4 Monate)**

### Meilensteine

- **Nach Phase 1:** Agent kann via Chat ein Dokument erstellen, Formulare fuellen und Klauseln auswaehlen (funktional, ohne fancy UI)
- **Nach Phase 2:** Vollstaendiger KI-Modus mit Live-Vorschau — das "Claude-Feeling" entsteht hier
- **Nach Phase 3:** Teams koennen ihre KI-Regeln komfortabel konfigurieren
- **Nach Phase 4:** Die KI lernt Muster und wird proaktiv
