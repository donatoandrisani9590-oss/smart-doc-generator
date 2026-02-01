# PandaDoc/DocuSign Feature Implementation Plan

**Erstellt:** 2026-02-01
**Aktualisiert:** 2026-02-01
**Ziel:** Score von 4.4/10 auf 7.0/10 verbessern
**Geschätzter Aufwand:** 17.5 Wochen

## ⚠️ WICHTIG: LLM-Strategie

**Kein GPT-4 (OpenAI)!** Stattdessen:
- **Produktion:** Mistral AI API (EU-Server, GDPR-konform)
- **Entwicklung:** Ollama (lokal, kostenlos, offline)

**Gründe:**
1. Datenschutz: Sensible HR-Daten bleiben in der EU
2. Kosten: Open-Weights-Modelle statt teurer proprietärer APIs
3. Unabhängigkeit: Keine Abhängigkeit von US-Anbietern

---

## Übersicht der Prioritäten

| Priorität | Feature | Impact | Aufwand | Score-Verbesserung |
|-----------|---------|--------|---------|-------------------|
| **P0** | Proaktive Risikomarkierung | 🔴 +6 Punkte | 3 Wo | 1/10 → 7/10 |
| **P0** | Chat → Dokument Flow | 🔴 +2.5 Punkte | 2 Wo | 4/10 → 6.5/10 |
| **P0** | Smart Mode Wizard | 🟡 +2.5 Punkte | 2 Wo | 5/10 → 7.5/10 |
| **P1** | Snippet-Bibliothek | 🟡 +2 Punkte | 2 Wo | 5/10 → 7/10 |
| **P1** | Visual DnD Blocks | 🟡 +1.5 Punkte | 3 Wo | 6/10 → 7.5/10 |

---

# P0-1: PROAKTIVE RISIKOMARKIERUNG (Compliance Scanner)

**Aktueller Score:** 1/10
**Ziel-Score:** 7/10
**Aufwand:** 3 Wochen
**Größter Impact!** (-88% Gap wird auf -13% reduziert)

## Das Problem

PandaDoc und DocuSign warnen proaktiv vor rechtlichen Risiken:
```
User fügt ein: "Arbeitnehmer verzichtet auf Urlaubsanspruch"
↓
🚨 WARNUNG: Widerspricht BUrlG §1
   Empfehlung: Mindestens 20 Tage Urlaub
```

**Smart Doc heute:** Nichts passiert. HR muss selbst wissen, dass das problematisch ist.

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  RightEditorPanel.tsx                                │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  ComplianceRiskBanner (NEU)                 │    │    │
│  │  │  🔴 2 Risiken gefunden  [Details anzeigen]  │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  DocumentEditor                             │    │    │
│  │  │  Text mit Inline-Risk-Highlights            │    │    │
│  │  │  "Der Arbeitnehmer [verzichtet auf]🔴..."   │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ onChange (debounced 2s)          │
│                           ▼                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  POST /api/v1/compliance/scan                        │    │
│  │  Request: { content_html, country_code, doc_type }   │    │
│  │  Response: { risks: Risk[], score: 0-100 }           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ComplianceService                                   │    │
│  │  1. Pattern Matching (schnell, offline)              │    │
│  │  2. LLM Analysis (tiefgehend, bei Bedarf)            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Woche 1: Backend - ComplianceService

### Datei: `backend/app/services/compliance_service.py`

```python
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel
import re

class RiskSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ComplianceRisk(BaseModel):
    id: str
    severity: RiskSeverity
    title: str
    description: str
    affected_text: str
    start_position: int
    end_position: int
    suggestion: Optional[str] = None
    legal_reference: Optional[str] = None

class ComplianceScanResult(BaseModel):
    risks: List[ComplianceRisk]
    overall_score: int  # 0-100, 100 = perfekt
    scanned_at: str

# Vordefinierte Risiko-Patterns für deutsches Arbeitsrecht
RISK_PATTERNS_DE = [
    {
        "pattern": r"verzicht(et|en)?\s+(auf|den)\s+(anspruch|recht|urlaub|gehalt)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Unzulässiger Rechtsverzicht",
        "description": "Arbeitnehmer können nicht auf gesetzliche Mindestansprüche verzichten.",
        "legal_reference": "§ 13 BUrlG, § 4 TzBfG",
        "suggestion": "Klausel entfernen oder durch rechtskonforme Alternative ersetzen."
    },
    {
        "pattern": r"probezeit\s*[:\s]*(\d+)\s*monat",
        "severity": RiskSeverity.HIGH,
        "title": "Probezeitdauer prüfen",
        "description": "Probezeit über 6 Monate ist in Deutschland nicht zulässig.",
        "legal_reference": "§ 622 Abs. 3 BGB",
        "check_value": lambda m: int(m.group(1)) > 6,
        "suggestion": "Probezeit auf maximal 6 Monate begrenzen."
    },
    {
        "pattern": r"kein(en?)?\s+anspruch\s+(auf|an)\s+(urlaub|freizeit|pause)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Verstoß gegen Urlaubsrecht",
        "description": "Gesetzlicher Mindesturlaub von 20 Tagen (bei 5-Tage-Woche) ist unabdingbar.",
        "legal_reference": "§ 1, § 3 BUrlG",
        "suggestion": "Urlaubsanspruch gemäß BUrlG gewähren (mind. 20 Tage/Jahr)."
    },
    {
        "pattern": r"überstunden\s+(werden\s+)?(nicht\s+)?(vergütet|bezahlt|abgegolten)",
        "severity": RiskSeverity.MEDIUM,
        "title": "Überstundenregelung prüfen",
        "description": "Pauschale Abgeltung von Überstunden durch Gehalt ist nur begrenzt zulässig.",
        "legal_reference": "BAG Urteil 5 AZR 517/09",
        "suggestion": "Konkrete Überstundenregelung mit Ausgleich definieren."
    },
    {
        "pattern": r"kündigungsfrist\s*[:\s]*(\d+)\s*(tag|woch)",
        "severity": RiskSeverity.MEDIUM,
        "title": "Kündigungsfrist zu kurz",
        "description": "Gesetzliche Mindestkündigungsfrist beachten.",
        "legal_reference": "§ 622 BGB",
        "check_value": lambda m: int(m.group(1)) < 4 if "woch" in m.group(2) else int(m.group(1)) < 28,
        "suggestion": "Mindestens 4 Wochen Kündigungsfrist vorsehen."
    },
    {
        "pattern": r"wettbewerbsverbot\s+(nach|für)\s+(\d+)\s*(jahr|monat)",
        "severity": RiskSeverity.HIGH,
        "title": "Wettbewerbsverbot Dauer",
        "description": "Nachvertragliches Wettbewerbsverbot max. 2 Jahre, nur mit Karenzentschädigung.",
        "legal_reference": "§ 74a HGB",
        "check_value": lambda m: int(m.group(2)) > 24 if "monat" in m.group(3) else int(m.group(2)) > 2,
        "suggestion": "Wettbewerbsverbot auf max. 2 Jahre begrenzen, Karenzentschädigung (mind. 50% des letzten Gehalts) vorsehen."
    },
    {
        "pattern": r"vertragsstrafe|konventionalstrafe",
        "severity": RiskSeverity.MEDIUM,
        "title": "Vertragsstrafe prüfen",
        "description": "Vertragsstrafen in Arbeitsverträgen sind nur eingeschränkt zulässig.",
        "legal_reference": "BAG Rechtsprechung",
        "suggestion": "Verhältnismäßigkeit der Vertragsstrafe prüfen (max. 1 Bruttomonatsgehalt)."
    },
    {
        "pattern": r"(ausschluss|verzicht).{0,30}(gewerkschaft|betriebsrat|arbeitnehmervertretung)",
        "severity": RiskSeverity.CRITICAL,
        "title": "Verstoß gegen Koalitionsfreiheit",
        "description": "Einschränkungen der Gewerkschaftszugehörigkeit sind verfassungswidrig.",
        "legal_reference": "Art. 9 Abs. 3 GG",
        "suggestion": "Klausel ersatzlos streichen."
    }
]

class ComplianceService:
    """
    Service für die Compliance-Prüfung von Dokumentinhalten.

    Zwei-Stufen-Ansatz:
    1. Schnelle Pattern-basierte Prüfung (offline, <100ms)
    2. Tiefgehende LLM-Analyse (optional, bei komplexen Fällen)
    """

    def __init__(self):
        self.patterns = RISK_PATTERNS_DE

    async def scan_content(
        self,
        content_html: str,
        country_code: str = "DE",
        document_type: Optional[str] = None,
        use_llm: bool = False
    ) -> ComplianceScanResult:
        """
        Scannt Dokumentinhalt auf Compliance-Risiken.

        Args:
            content_html: HTML-Inhalt des Dokuments
            country_code: Ländercode (DE, AT, CH, IT)
            document_type: Dokumenttyp für kontextspezifische Prüfung
            use_llm: Aktiviert tiefgehende LLM-Analyse

        Returns:
            ComplianceScanResult mit gefundenen Risiken und Score
        """
        # HTML zu Plain Text für Pattern Matching
        plain_text = self._strip_html(content_html).lower()

        risks: List[ComplianceRisk] = []

        # Stufe 1: Pattern Matching
        for idx, pattern_def in enumerate(self.patterns):
            matches = re.finditer(pattern_def["pattern"], plain_text, re.IGNORECASE)

            for match in matches:
                # Optional: Wert-basierte Prüfung (z.B. Probezeit > 6 Monate)
                if "check_value" in pattern_def:
                    if not pattern_def["check_value"](match):
                        continue

                risk = ComplianceRisk(
                    id=f"risk_{idx}_{match.start()}",
                    severity=pattern_def["severity"],
                    title=pattern_def["title"],
                    description=pattern_def["description"],
                    affected_text=match.group(0),
                    start_position=match.start(),
                    end_position=match.end(),
                    suggestion=pattern_def.get("suggestion"),
                    legal_reference=pattern_def.get("legal_reference")
                )
                risks.append(risk)

        # Stufe 2: LLM-Analyse (optional)
        if use_llm and len(risks) > 0:
            risks = await self._enhance_with_llm(risks, plain_text, country_code)

        # Score berechnen
        score = self._calculate_score(risks)

        return ComplianceScanResult(
            risks=risks,
            overall_score=score,
            scanned_at=datetime.utcnow().isoformat()
        )

    def _strip_html(self, html: str) -> str:
        """Entfernt HTML-Tags für Pattern Matching."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        return soup.get_text(separator=" ")

    def _calculate_score(self, risks: List[ComplianceRisk]) -> int:
        """
        Berechnet Compliance-Score (0-100).
        100 = Keine Risiken, 0 = Kritische Risiken
        """
        if not risks:
            return 100

        severity_weights = {
            RiskSeverity.LOW: 5,
            RiskSeverity.MEDIUM: 15,
            RiskSeverity.HIGH: 30,
            RiskSeverity.CRITICAL: 50
        }

        total_penalty = sum(severity_weights[r.severity] for r in risks)
        return max(0, 100 - total_penalty)

    async def _enhance_with_llm(
        self,
        risks: List[ComplianceRisk],
        text: str,
        country_code: str
    ) -> List[ComplianceRisk]:
        """
        Erweitert Risiken mit LLM-basierter Analyse.
        Fügt kontextspezifische Empfehlungen hinzu.
        """
        # TODO: OpenAI Integration für tiefgehende Analyse
        # Prompt: "Analysiere folgende Vertragsklausel auf rechtliche Risiken..."
        return risks


# Singleton-Instanz
compliance_service = ComplianceService()
```

### Datei: `backend/app/api/v1/endpoints/compliance.py`

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.services.compliance_service import (
    compliance_service,
    ComplianceScanResult
)

router = APIRouter(prefix="/compliance", tags=["compliance"])

class ComplianceScanRequest(BaseModel):
    content_html: str
    country_code: str = "DE"
    document_type: Optional[str] = None
    use_llm: bool = False

@router.post("/scan", response_model=ComplianceScanResult)
async def scan_document(request: ComplianceScanRequest):
    """
    Scannt Dokumentinhalt auf Compliance-Risiken.

    Gibt eine Liste von Risiken mit Severity, Beschreibung und
    Handlungsempfehlungen zurück.
    """
    result = await compliance_service.scan_content(
        content_html=request.content_html,
        country_code=request.country_code,
        document_type=request.document_type,
        use_llm=request.use_llm
    )
    return result
```

## Woche 2: Frontend - ComplianceRiskBanner

### Datei: `frontend/src/components/generator/ComplianceRiskBanner.tsx`

```typescript
import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle, XCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RiskSeverity = "low" | "medium" | "high" | "critical";

interface ComplianceRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  affected_text: string;
  suggestion?: string;
  legal_reference?: string;
}

interface ComplianceRiskBannerProps {
  contentHtml: string;
  countryCode: string;
  onRiskClick?: (risk: ComplianceRisk) => void;
}

const severityConfig = {
  critical: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-800",
    label: "Kritisch"
  },
  high: {
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
    badge: "bg-orange-100 text-orange-800",
    label: "Hoch"
  },
  medium: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bg: "bg-yellow-50 border-yellow-200",
    badge: "bg-yellow-100 text-yellow-800",
    label: "Mittel"
  },
  low: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    label: "Niedrig"
  }
};

export function ComplianceRiskBanner({
  contentHtml,
  countryCode,
  onRiskClick
}: ComplianceRiskBannerProps) {
  const [risks, setRisks] = useState<ComplianceRisk[]>([]);
  const [score, setScore] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastScannedContent, setLastScannedContent] = useState("");

  // Debounced Scan - 2 Sekunden nach letzter Änderung
  const scanContent = useCallback(async () => {
    if (contentHtml === lastScannedContent || contentHtml.length < 50) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_html: contentHtml,
          country_code: countryCode,
          use_llm: false // Schnelle Pattern-Prüfung
        })
      });

      if (response.ok) {
        const result = await response.json();
        setRisks(result.risks);
        setScore(result.overall_score);
        setLastScannedContent(contentHtml);
      }
    } catch (error) {
      console.error("Compliance scan failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [contentHtml, countryCode, lastScannedContent]);

  useEffect(() => {
    const timer = setTimeout(scanContent, 2000);
    return () => clearTimeout(timer);
  }, [contentHtml, scanContent]);

  // Keine Risiken = Grünes Banner
  if (risks.length === 0 && !isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg mb-4">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="text-sm text-green-800 font-medium">
          Keine Compliance-Risiken gefunden
        </span>
        <Badge variant="outline" className="ml-auto bg-green-100 text-green-800">
          Score: {score}/100
        </Badge>
      </div>
    );
  }

  // Höchste Severity ermitteln
  const highestSeverity = risks.reduce((max, risk) => {
    const order = ["low", "medium", "high", "critical"];
    return order.indexOf(risk.severity) > order.indexOf(max) ? risk.severity : max;
  }, "low" as RiskSeverity);

  const config = severityConfig[highestSeverity];
  const Icon = config.icon;

  return (
    <div className={cn("border rounded-lg mb-4 overflow-hidden", config.bg)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-opacity-80 transition-colors"
      >
        <Icon className={cn("h-5 w-5", config.color)} />
        <span className={cn("font-medium", config.color)}>
          {risks.length} Compliance-{risks.length === 1 ? "Risiko" : "Risiken"} gefunden
        </span>
        <Badge className={cn("ml-2", config.badge)}>
          Score: {score}/100
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {isLoading && (
            <span className="text-xs text-gray-500">Prüfe...</span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Expandable Risk List */}
      {isExpanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {risks.map((risk) => {
            const riskConfig = severityConfig[risk.severity];
            const RiskIcon = riskConfig.icon;

            return (
              <div
                key={risk.id}
                className="px-4 py-3 hover:bg-white/50 cursor-pointer transition-colors"
                onClick={() => onRiskClick?.(risk)}
              >
                <div className="flex items-start gap-3">
                  <RiskIcon className={cn("h-4 w-4 mt-0.5", riskConfig.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{risk.title}</span>
                      <Badge variant="outline" className={riskConfig.badge}>
                        {riskConfig.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{risk.description}</p>

                    {/* Betroffener Text */}
                    <div className="mt-2 px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">
                      „{risk.affected_text}"
                    </div>

                    {/* Empfehlung */}
                    {risk.suggestion && (
                      <div className="mt-2 flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-500">Empfehlung:</span>
                        <span className="text-sm text-gray-700">{risk.suggestion}</span>
                      </div>
                    )}

                    {/* Rechtsgrundlage */}
                    {risk.legal_reference && (
                      <div className="mt-1 text-xs text-gray-500">
                        Rechtsgrundlage: {risk.legal_reference}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Integration in RightEditorPanel.tsx

```typescript
// In RightEditorPanel.tsx hinzufügen:

import { ComplianceRiskBanner } from "./ComplianceRiskBanner";

// Im JSX, vor dem Editor:
<ComplianceRiskBanner
  contentHtml={editorContent}
  countryCode={formData.country_code || "DE"}
  onRiskClick={(risk) => {
    // Optional: Zum betroffenen Text scrollen
    highlightTextInEditor(risk.affected_text);
  }}
/>
```

## Woche 3: LLM-Integration & Feinschliff

### Erweiterte LLM-Analyse

```python
# In compliance_service.py erweitern:

async def _enhance_with_llm(
    self,
    risks: List[ComplianceRisk],
    text: str,
    country_code: str
) -> List[ComplianceRisk]:
    """
    Erweitert Risiken mit kontextspezifischen LLM-Empfehlungen.
    """
    from app.core.openai_client import get_openai_client

    client = await get_openai_client()

    system_prompt = """Du bist ein Experte für deutsches Arbeitsrecht.
    Analysiere die folgenden Vertragsklauseln auf rechtliche Risiken.

    Für jedes Risiko:
    1. Bewerte die Severity (critical/high/medium/low)
    2. Erkläre das rechtliche Problem
    3. Nenne die relevante Rechtsgrundlage
    4. Schlage eine rechtskonforme Alternative vor

    Antworte im JSON-Format."""

    # Nur die betroffenen Textstellen senden
    risk_texts = [r.affected_text for r in risks]

    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Vertragstext:\n{text}\n\nZu prüfende Klauseln:\n{risk_texts}"}
        ],
        temperature=0.3,
        max_tokens=2000
    )

    # LLM-Empfehlungen in Risiken einfügen
    # ... Parsing und Merge-Logik

    return risks
```

### Inline-Highlighting im Editor

```typescript
// Neue Datei: useComplianceHighlighting.ts

export function useComplianceHighlighting(editorRef: RefObject<TinyMCE>) {
  const highlightRisks = useCallback((risks: ComplianceRisk[]) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Bestehende Highlights entfernen
    editor.dom.select(".compliance-risk").forEach(el => {
      editor.dom.setAttrib(el, "class", "");
    });

    // Neue Highlights setzen
    risks.forEach(risk => {
      const severityClass = `compliance-risk compliance-risk--${risk.severity}`;
      // TinyMCE Search & Replace mit Custom Formatting
      editor.execCommand("mceReplaceContent", false,
        `<span class="${severityClass}" data-risk-id="${risk.id}">${risk.affected_text}</span>`
      );
    });
  }, [editorRef]);

  return { highlightRisks };
}
```

### CSS für Risk-Highlighting

```css
/* In globals.css */
.compliance-risk {
  position: relative;
  border-bottom: 2px dashed;
  cursor: help;
}

.compliance-risk--critical {
  border-color: #dc2626;
  background-color: rgba(220, 38, 38, 0.1);
}

.compliance-risk--high {
  border-color: #ea580c;
  background-color: rgba(234, 88, 12, 0.1);
}

.compliance-risk--medium {
  border-color: #ca8a04;
  background-color: rgba(202, 138, 4, 0.1);
}

.compliance-risk--low {
  border-color: #2563eb;
  background-color: rgba(37, 99, 235, 0.05);
}

.compliance-risk:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 0;
  background: #1f2937;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 100;
}
```

---

# P0-2: CHAT → DOKUMENT FLOW

**Aktueller Score:** 4/10
**Ziel-Score:** 6.5/10
**Aufwand:** 2 Wochen

## Das Problem

PandaDoc: "Schreibe Arbeitsvertrag für Senior Developer in Berlin" → Auto-Fill aller Felder
Smart Doc: Chat schreibt nur Text, keine Verbindung zu Formularen

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│  ChatPanel.tsx                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  User: "Erstelle Arbeitsvertrag für Max Müller,     │    │
│  │         Senior Developer, 80.000€ brutto, Berlin"   │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AI: "Ich habe die Daten extrahiert:                │    │
│  │       - Name: Max Müller                            │    │
│  │       - Position: Senior Developer                  │    │
│  │       - Gehalt: 80.000€                             │    │
│  │       - Arbeitsort: Berlin"                         │    │
│  │                                                     │    │
│  │  [✓ Zu Dokument hinzufügen] [Bearbeiten]           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ onClick
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  DocumentWizard.tsx - Formular wird auto-filled             │
│  ┌───────────────────┐ ┌───────────────────┐                │
│  │ Name              │ │ Position          │                │
│  │ [Max Müller    ]  │ │ [Senior Developer]│                │
│  └───────────────────┘ └───────────────────┘                │
│  ┌───────────────────┐ ┌───────────────────┐                │
│  │ Gehalt (brutto)   │ │ Arbeitsort        │                │
│  │ [80000         ]  │ │ [Berlin        ]  │                │
│  └───────────────────┘ └───────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Woche 1: Backend - Structured Extraction

### Datei: `backend/app/api/v1/endpoints/chat.py` (erweitert)

```python
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

class ExtractedFormData(BaseModel):
    """Extrahierte Formulardaten aus Chat-Konversation."""
    field_mappings: Dict[str, Any]  # field_name -> value
    confidence: float  # 0.0 - 1.0
    suggested_document_type: Optional[str] = None
    suggested_clauses: List[str] = []

class ChatResponse(BaseModel):
    message: str
    extracted_data: Optional[ExtractedFormData] = None
    can_create_document: bool = False

EXTRACTION_SYSTEM_PROMPT = """Du bist ein HR-Assistent, der Vertragsdaten aus Konversationen extrahiert.

Wenn der Nutzer einen Vertrag erstellen möchte, extrahiere folgende Felder:
- employee_name: Name des Mitarbeiters
- position: Position/Jobtitel
- salary_gross: Bruttogehalt (nur Zahl)
- work_location: Arbeitsort
- start_date: Startdatum (Format: YYYY-MM-DD)
- hours_per_week: Wochenstunden
- vacation_days: Urlaubstage
- probation_months: Probezeit in Monaten

Antworte IMMER im folgenden JSON-Format:
{
  "message": "Deine freundliche Antwort an den Nutzer",
  "extracted_data": {
    "field_mappings": { ... extrahierte Felder ... },
    "confidence": 0.95,
    "suggested_document_type": "Arbeitsvertrag",
    "suggested_clauses": ["probezeit", "remote_work"]
  },
  "can_create_document": true/false
}"""

@router.post("/extract", response_model=ChatResponse)
async def extract_form_data(request: ChatRequest):
    """
    Extrahiert strukturierte Formulardaten aus Chat-Nachrichten.
    """
    client = await get_openai_client()

    response = await client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
            *[{"role": m.role, "content": m.content} for m in request.messages]
        ],
        temperature=0.3,
        response_format={"type": "json_object"}
    )

    result = json.loads(response.choices[0].message.content)
    return ChatResponse(**result)
```

## Woche 2: Frontend - Chat-zu-Dokument Button

### Datei: `frontend/src/components/chat/ChatToDocumentButton.tsx`

```typescript
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWizard } from "@/context/WizardContext";
import { useNavigate } from "react-router-dom";

interface ExtractedData {
  field_mappings: Record<string, any>;
  confidence: number;
  suggested_document_type?: string;
  suggested_clauses?: string[];
}

interface ChatToDocumentButtonProps {
  extractedData: ExtractedData;
}

export function ChatToDocumentButton({ extractedData }: ChatToDocumentButtonProps) {
  const { actions } = useWizard();
  const navigate = useNavigate();

  const handleCreateDocument = () => {
    // 1. Dokumenttyp setzen (falls erkannt)
    if (extractedData.suggested_document_type) {
      // Mapping: "Arbeitsvertrag" -> document_type_id
      actions.setDocumentType(extractedData.suggested_document_type);
    }

    // 2. Formularfelder befüllen
    Object.entries(extractedData.field_mappings).forEach(([field, value]) => {
      actions.setFormField(field, value);
    });

    // 3. Vorgeschlagene Klauseln aktivieren
    extractedData.suggested_clauses?.forEach(clauseId => {
      actions.toggleClause(clauseId, true);
    });

    // 4. Zur Generator-Seite navigieren
    navigate("/generate?source=chat");
  };

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <span className="font-medium text-purple-900">
          Dokument erstellen
        </span>
        <span className="text-sm text-purple-600">
          ({Math.round(extractedData.confidence * 100)}% Konfidenz)
        </span>
      </div>

      {/* Extrahierte Felder anzeigen */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {Object.entries(extractedData.field_mappings).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-600">{formatFieldName(key)}:</span>
            <span className="font-medium text-gray-900">{String(value)}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleCreateDocument} className="flex-1">
          <FileText className="h-4 w-4 mr-2" />
          Zu Dokument hinzufügen
        </Button>
        <Button variant="outline" onClick={() => {}}>
          Bearbeiten
        </Button>
      </div>
    </div>
  );
}

function formatFieldName(key: string): string {
  const mappings: Record<string, string> = {
    employee_name: "Name",
    position: "Position",
    salary_gross: "Gehalt (brutto)",
    work_location: "Arbeitsort",
    start_date: "Startdatum",
    hours_per_week: "Wochenstunden",
    vacation_days: "Urlaubstage",
    probation_months: "Probezeit"
  };
  return mappings[key] || key;
}
```

---

# P0-3: SMART MODE WIZARD

**Aktueller Score:** 5/10
**Ziel-Score:** 7.5/10
**Aufwand:** 2 Wochen

## Das Problem

PandaDoc: 3 Schritte, 5 Fragen, 95% Auto-Fill
Smart Doc: 5+ Schritte, alle Felder sichtbar, overwhelming

## Lösung: "Express-Modus"

```
┌─────────────────────────────────────────────────────────────┐
│  SMART MODE - Nur 5 Fragen                                  │
│                                                              │
│  1/5  Wie heißt der neue Mitarbeiter?                       │
│       [Max Müller                              ]             │
│                                                              │
│  2/5  Welche Position?                                      │
│       [Senior Developer                        ]             │
│                                                              │
│  3/5  Gehalt (brutto/Jahr)?                                 │
│       [80.000 €                                ]             │
│                                                              │
│  4/5  Startdatum?                                           │
│       [01.03.2026                              ]             │
│                                                              │
│  5/5  Vollzeit oder Teilzeit?                               │
│       (●) Vollzeit  ( ) Teilzeit                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [Dokument erstellen]  [Erweiterte Optionen →]      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Datei: `frontend/src/components/wizard/SmartModeWizard.tsx`

```typescript
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWizard } from "@/context/WizardContext";

interface SmartQuestion {
  id: string;
  field: string;
  question: string;
  type: "text" | "number" | "date" | "radio";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required: boolean;
}

const SMART_QUESTIONS: SmartQuestion[] = [
  {
    id: "q1",
    field: "employee_name",
    question: "Wie heißt der neue Mitarbeiter?",
    type: "text",
    placeholder: "z.B. Max Müller",
    required: true
  },
  {
    id: "q2",
    field: "position",
    question: "Welche Position?",
    type: "text",
    placeholder: "z.B. Senior Developer",
    required: true
  },
  {
    id: "q3",
    field: "salary_gross",
    question: "Gehalt (brutto/Jahr)?",
    type: "number",
    placeholder: "z.B. 80000",
    required: true
  },
  {
    id: "q4",
    field: "start_date",
    question: "Startdatum?",
    type: "date",
    required: true
  },
  {
    id: "q5",
    field: "employment_type",
    question: "Vollzeit oder Teilzeit?",
    type: "radio",
    options: [
      { value: "fulltime", label: "Vollzeit (40h/Woche)" },
      { value: "parttime", label: "Teilzeit" }
    ],
    required: true
  }
];

export function SmartModeWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const { actions } = useWizard();

  const currentQuestion = SMART_QUESTIONS[currentStep];
  const progress = ((currentStep + 1) / SMART_QUESTIONS.length) * 100;

  const handleAnswer = (value: any) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.field]: value }));
  };

  const handleNext = () => {
    if (currentStep < SMART_QUESTIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Fertig - Formular befüllen
      Object.entries(answers).forEach(([field, value]) => {
        actions.setFormField(field, value);
      });

      // Auto-Fill Standardwerte
      if (answers.employment_type === "fulltime") {
        actions.setFormField("hours_per_week", 40);
        actions.setFormField("vacation_days", 30);
      }

      // Zur Editor-Seite
      actions.completeSmartMode();
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Smart Mode</span>
          <span>{currentStep + 1} von {SMART_QUESTIONS.length}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-xl shadow-lg p-8"
        >
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-600">
              Frage {currentStep + 1}
            </span>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {currentQuestion.question}
          </h2>

          {/* Input basierend auf Typ */}
          {currentQuestion.type === "text" && (
            <Input
              value={answers[currentQuestion.field] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder={currentQuestion.placeholder}
              className="text-lg"
              autoFocus
            />
          )}

          {currentQuestion.type === "number" && (
            <div className="relative">
              <Input
                type="number"
                value={answers[currentQuestion.field] || ""}
                onChange={(e) => handleAnswer(Number(e.target.value))}
                placeholder={currentQuestion.placeholder}
                className="text-lg pr-8"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
            </div>
          )}

          {currentQuestion.type === "date" && (
            <Input
              type="date"
              value={answers[currentQuestion.field] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
              className="text-lg"
              autoFocus
            />
          )}

          {currentQuestion.type === "radio" && (
            <RadioGroup
              value={answers[currentQuestion.field]}
              onValueChange={handleAnswer}
              className="space-y-3"
            >
              {currentQuestion.options?.map(option => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <RadioGroupItem value={option.value} />
                  <span className="text-lg">{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="ghost"
          onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
          disabled={currentStep === 0}
        >
          Zurück
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => actions.switchToAdvancedMode()}>
            <Settings className="h-4 w-4 mr-2" />
            Erweiterte Optionen
          </Button>
          <Button onClick={handleNext} disabled={!answers[currentQuestion.field]}>
            {currentStep === SMART_QUESTIONS.length - 1 ? (
              <>Dokument erstellen</>
            ) : (
              <>
                Weiter
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

# Zusammenfassung

## Nach Implementierung aller P0 Features (7 Wochen):

| Feature | Vorher | Nachher | Verbesserung |
|---------|--------|---------|--------------|
| Proaktive Risikomarkierung | 1/10 | 7/10 | **+600%** |
| Chat → Dokument | 4/10 | 6.5/10 | **+62%** |
| Smart Mode | 5/10 | 7.5/10 | **+50%** |
| **Gesamtscore** | **4.4/10** | **6.2/10** | **+41%** |

## Nächste Schritte (P1)

Nach Abschluss der P0-Features:
1. **Snippet-Bibliothek** (2 Wochen) → Score 5/10 → 7/10
2. **Visual DnD Blocks** (3 Wochen) → Score 6/10 → 7.5/10

**Finaler Score nach P1:** ~7.0/10 (nur -17% unter PandaDoc)
