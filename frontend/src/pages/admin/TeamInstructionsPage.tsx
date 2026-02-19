/**
 * TeamInstructionsPage — Strukturierter Instruktions-Builder für KI-Anweisungen.
 *
 * 5 Kategorien:
 * 1. Regelwerk & Vertragsgrundlagen
 * 2. Sprache & Tonalität
 * 3. Pflichtangaben & Standards
 * 4. Einschränkungen
 * 5. Freie Anweisungen
 *
 * Daten werden als formatierter Text in Team.ai_instructions gespeichert.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { useMyTeams } from "@/hooks/api/useTeamQueries";
import { useCountry } from "@/hooks/useCountry";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  BookOpen,
  MessageSquare,
  ListChecks,
  ShieldAlert,
  PenLine,
  CheckCircle2,
  Info,
  Users,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

// ── Category definitions ─────────────────────────────────────────────

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  placeholder: string;
  description: string;
}

const CATEGORIES: Category[] = [
  {
    id: "regelwerk",
    label: "Regelwerk & Vertragsgrundlagen",
    icon: BookOpen,
    placeholder: "z.B. IGBCE-Tarifvertrag, AGB Version 3.2, ERA-Stufen E1-E12...",
    description: "Tarifverträge, AGB, Compliance-Richtlinien und andere verbindliche Grundlagen",
  },
  {
    id: "sprache",
    label: "Sprache & Tonalität",
    icon: MessageSquare,
    placeholder: "z.B. Sie-Form, geschlechtsneutrale Sprache, sachlich-professionell...",
    description: "Anrede, Gendern, Tonalität und Fachsprache-Vorgaben",
  },
  {
    id: "pflichtangaben",
    label: "Pflichtangaben & Standards",
    icon: ListChecks,
    placeholder: "z.B. Gerichtsstand München, USt-IdNr im Footer, §102 BetrVG erwähnen...",
    description: "Angaben die in jedem Dokument enthalten sein müssen",
  },
  {
    id: "einschraenkungen",
    label: "Einschränkungen",
    icon: ShieldAlert,
    placeholder: "z.B. Keine Preise erfinden, Keine Fristen eigenmächtig setzen...",
    description: "Dinge, die die KI niemals tun darf (No-Gos)",
  },
  {
    id: "frei",
    label: "Freie Anweisungen",
    icon: PenLine,
    placeholder: "Weitere Anweisungen an die KI...",
    description: "Sonstige Regeln und Hinweise",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

const SECTION_HEADERS: Record<string, string> = {
  regelwerk: "## Regelwerk & Vertragsgrundlagen",
  sprache: "## Sprache & Tonalität",
  pflichtangaben: "## Pflichtangaben & Standards",
  einschraenkungen: "## Einschränkungen",
  frei: "## Freie Anweisungen",
};

function serializeInstructions(values: Record<string, string>): string {
  const parts: string[] = [];
  for (const cat of CATEGORIES) {
    const val = values[cat.id]?.trim();
    if (val) {
      parts.push(`${SECTION_HEADERS[cat.id]}\n${val}`);
    }
  }
  return parts.join("\n\n");
}

function parseInstructions(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    result[cat.id] = "";
  }

  if (!raw) return result;

  // Split by ## headers
  const sections = raw.split(/^## /m).filter(Boolean);
  for (const section of sections) {
    const firstNewline = section.indexOf("\n");
    if (firstNewline === -1) continue;
    const header = section.slice(0, firstNewline).trim();
    const content = section.slice(firstNewline + 1).trim();

    for (const cat of CATEGORIES) {
      if (SECTION_HEADERS[cat.id].replace("## ", "") === header) {
        result[cat.id] = content;
        break;
      }
    }
  }

  // If no structured sections found, put everything in "frei"
  if (Object.values(result).every(v => !v) && raw.trim()) {
    result.frei = raw.trim();
  }

  return result;
}

// ── Component ────────────────────────────────────────────────────────

export function TeamInstructionsPage() {
  const { country } = useCountry();
  const { data: teams, isLoading: teamsLoading } = useMyTeams(country);

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Unsaved changes warning
  const [pendingTeamId, setPendingTeamId] = useState<number | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const skipConfirmRef = useRef(false);

  // Auto-select first team
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // Load instructions when team changes
  useEffect(() => {
    if (!selectedTeamId) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch(`/api/v1/teams/${selectedTeamId}/ai-instructions`);
        if (res.ok) {
          const data = await res.json();
          setValues(parseInstructions(data.ai_instructions || ""));
          setHasChanges(false);
        }
      } catch {
        toast.error("KI-Anweisungen konnten nicht geladen werden");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [selectedTeamId]);

  const updateValue = useCallback((categoryId: string, value: string) => {
    setValues(prev => ({ ...prev, [categoryId]: value }));
    setHasChanges(true);
  }, []);

  const handleTeamChange = (newTeamId: string) => {
    const id = Number(newTeamId);
    if (hasChanges && !skipConfirmRef.current) {
      setPendingTeamId(id);
      setShowUnsavedDialog(true);
    } else {
      skipConfirmRef.current = false;
      setSelectedTeamId(id);
    }
  };

  const confirmDiscard = () => {
    setShowUnsavedDialog(false);
    if (pendingTeamId !== null) {
      skipConfirmRef.current = true;
      setSelectedTeamId(pendingTeamId);
      setPendingTeamId(null);
    }
  };

  const handleSave = async () => {
    if (!selectedTeamId) return;

    setIsSaving(true);
    try {
      const serialized = serializeInstructions(values);
      const res = await apiFetch(`/api/v1/teams/${selectedTeamId}/ai-instructions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_instructions: serialized }),
      });

      if (res.ok) {
        toast.success("KI-Anweisungen gespeichert");
        setHasChanges(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Fehler beim Speichern");
      }
    } catch {
      toast.error("Verbindungsfehler");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggest = async () => {
    if (!selectedTeamId) return;

    setIsSuggestLoading(true);
    try {
      const res = await apiFetch(`/api/v1/teams/${selectedTeamId}/ai-instructions/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country_code: country }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestions) {
          setValues(parseInstructions(data.suggestions));
          setHasChanges(true);
          toast.success("KI-Vorschläge übernommen — bitte prüfen und anpassen");
        }
      } else {
        toast.error("KI-Vorschläge konnten nicht generiert werden");
      }
    } catch {
      toast.error("Verbindungsfehler");
    } finally {
      setIsSuggestLoading(false);
    }
  };

  const filledCount = Object.values(values).filter(v => v.trim()).length;
  const previewText = serializeInstructions(values);

  if (teamsLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!teams || teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="p-3 rounded-full bg-warm-100">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground">Noch kein Team vorhanden</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Erstelle zuerst ein Team, um KI-Anweisungen zu konfigurieren.
            Teams ermöglichen abteilungsspezifische Regeln für die KI.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            // Navigate to team creation — teams are managed via the API
            window.location.href = "/settings?tab=users";
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Team erstellen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast Änderungen an den KI-Anweisungen vorgenommen, die noch nicht gespeichert wurden.
              Möchtest du die Änderungen verwerfen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowUnsavedDialog(false); setPendingTeamId(null); }}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscard}>
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">KI-Anweisungen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Definiere Regeln, die der KI-Assistent bei der Dokumenterstellung befolgen soll.
        </p>
      </div>

      {/* Hierarchy Info Banner */}
      <div className="flex items-start gap-3 rounded-lg bg-warm-50 border border-warm-200 p-3">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Anweisungs-Hierarchie:</span>{" "}
          Unternehmensweite Anweisungen (Firmendaten) gelten als Basis. Team-Anweisungen
          ergänzen und überschreiben diese für das jeweilige Team.
          Dokumenttyp-spezifische Regeln haben die höchste Priorität.
        </p>
      </div>

      {/* Team Selector + Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedTeamId ? String(selectedTeamId) : ""}
          onValueChange={handleTeamChange}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Team auswählen" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t: { id: number; name: string }) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-xs">
          {filledCount}/{CATEGORIES.length} Kategorien
        </Badge>

        {hasChanges && (
          <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
            Ungespeichert
          </Badge>
        )}

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={handleSuggest}
          disabled={isSuggestLoading || !selectedTeamId}
          className="gap-1.5"
        >
          {isSuggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          KI-Vorschläge
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="gap-1.5"
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPreview ? "Bearbeiten" : "Vorschau"}
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="gap-1.5"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Speichern
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : showPreview ? (
        /* Preview Mode */
        <div className="card-soft p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">System-Prompt Vorschau</span>
          </div>
          {previewText ? (
            <pre className="text-xs text-foreground whitespace-pre-wrap bg-warm-50 rounded-lg p-4 border border-warm-200 font-mono leading-relaxed">
              {previewText}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">Keine Anweisungen konfiguriert.</p>
          )}
        </div>
      ) : (
        /* Builder Mode */
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const hasFilled = !!values[cat.id]?.trim();
            return (
              <div key={cat.id} className="card-soft p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-1.5 rounded-lg ${hasFilled ? "bg-primary/10" : "bg-warm-100"}`}>
                    <Icon className={`w-4 h-4 ${hasFilled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{cat.label}</span>
                      {hasFilled && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
                <Textarea
                  value={values[cat.id] || ""}
                  onChange={(e) => updateValue(cat.id, e.target.value)}
                  placeholder={cat.placeholder}
                  className="min-h-[80px] text-sm resize-y"
                  rows={3}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TeamInstructionsPage;
