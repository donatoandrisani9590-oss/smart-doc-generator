/**
 * AgentPage — KI-Dokumentassistent mit 60/40 Chat/Preview-Layout.
 *
 * Links: AgentChat (60%) — Claude-Chat mit Tool-Visualisierung
 * Rechts: Live-Vorschau (40%) — Zeigt Formularfelder + ausgewählte Klauseln
 *
 * Smart Features:
 * - Employee Autocomplete: search + auto-fill employee data
 * - Smart Defaults: suggest common field values from team patterns
 *
 * Nahtloser Wechsel zum manuellen Modus über "Manuell bearbeiten"-Button.
 */

import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  PenLine,
  Sparkles,
  Settings2,
  CheckCircle2,
  FileText,
  Search,
  User,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { AgentChat } from "@/components/agent/AgentChat";
import { useCountry } from "@/hooks/useCountry";
import { useDocumentTypes } from "@/hooks/api/useDocumentTypeQueries";
import { useMyTeams } from "@/hooks/api/useTeamQueries";
import { useEmployeeAutocomplete } from "@/hooks/useEmployeeAutocomplete";
import { useSmartDefaults } from "@/hooks/useSmartDefaults";

export default function AgentPage() {
  const navigate = useNavigate();
  const { country } = useCountry();

  // Context selections
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<number | null>(null);

  // Agent state
  const [formFields, setFormFields] = useState<Record<string, string>>({});
  const [enabledClauses, setEnabledClauses] = useState<number[]>([]);
  const [clauseDrafts, setClauseDrafts] = useState<Array<{ title: string; html: string }>>([]);
  const [, setSessionId] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  // Data
  const { data: documentTypes } = useDocumentTypes(country);
  const { data: teams } = useMyTeams(country);

  // Smart features
  const employeeSearch = useEmployeeAutocomplete(country);
  const { defaults, isLoading: defaultsLoading } = useSmartDefaults(selectedTeamId, selectedDocTypeId);

  // ── Callbacks from AgentChat ─────────────────────────────────────

  const handleFormUpdate = useCallback((fields: Record<string, string>) => {
    setFormFields(prev => ({ ...prev, ...fields }));
  }, []);

  const handleClauseUpdate = useCallback((enable: number[], disable: number[]) => {
    setEnabledClauses(prev => [...new Set([...prev, ...enable])].filter(id => !disable.includes(id)));
  }, []);

  const handleClauseDraft = useCallback((title: string, html: string) => {
    setClauseDrafts(prev => [...prev, { title, html }]);
  }, []);

  // ── Employee auto-fill ──────────────────────────────────────────

  const handleEmployeeSelect = useCallback((formData: Record<string, string>) => {
    setFormFields(prev => ({ ...prev, ...formData }));
    employeeSearch.clear();
  }, [employeeSearch]);

  // ── Apply smart defaults ────────────────────────────────────────

  const handleApplyDefaults = useCallback(() => {
    if (!defaults?.field_defaults) return;
    setFormFields(prev => ({ ...defaults.field_defaults, ...prev }));
    if (defaults.common_clause_ids?.length) {
      setEnabledClauses(prev => [...new Set([...prev, ...defaults.common_clause_ids])]);
    }
    setDefaultsApplied(true);
  }, [defaults]);

  // ── Switch to manual mode ────────────────────────────────────────

  const switchToManual = () => {
    const params = new URLSearchParams();
    if (selectedDocTypeId) params.set("type", String(selectedDocTypeId));
    if (Object.keys(formFields).length > 0) {
      params.set("data", JSON.stringify(formFields));
    }
    navigate(`/generate?${params.toString()}`);
  };

  // ── Render ───────────────────────────────────────────────────────

  const fieldCount = Object.keys(formFields).length;
  const clauseCount = enabledClauses.length;
  const draftCount = clauseDrafts.length;

  const hasDefaults = defaults && (
    Object.keys(defaults.field_defaults).length > 0 || defaults.common_clause_ids.length > 0
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-warm-200 bg-background">
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">KI-Assistent</span>
        </div>

        <div className="flex-1" />

        {/* Team Selector */}
        {teams && teams.length > 0 && (
          <Select
            value={selectedTeamId ? String(selectedTeamId) : ""}
            onValueChange={(v) => { setSelectedTeamId(v ? Number(v) : null); setDefaultsApplied(false); }}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Team wählen" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t: { id: number; name: string }) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Doc Type Selector */}
        {documentTypes && documentTypes.length > 0 && (
          <Select
            value={selectedDocTypeId ? String(selectedDocTypeId) : ""}
            onValueChange={(v) => { setSelectedDocTypeId(v ? Number(v) : null); setDefaultsApplied(false); }}
          >
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Dokumenttyp (optional)" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((dt: { id: number; name: string }) => (
                <SelectItem key={dt.id} value={String(dt.id)}>{dt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button variant="outline" size="sm" onClick={switchToManual} className="gap-1.5">
          <PenLine className="w-3.5 h-3.5" />
          Manuell bearbeiten
        </Button>
      </div>

      {/* Main Content: 60/40 Split */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat (60%) */}
        <div className="w-[60%] border-r border-warm-200 flex flex-col min-h-0">
          <AgentChat
            countryCode={country}
            teamId={selectedTeamId}
            documentTypeId={selectedDocTypeId}
            formData={formFields}
            onFormUpdate={handleFormUpdate}
            onClauseUpdate={handleClauseUpdate}
            onClauseDraft={handleClauseDraft}
            onSessionCreated={setSessionId}
          />
        </div>

        {/* Right: Live Preview (40%) */}
        <div className="w-[40%] flex flex-col min-h-0 bg-warm-50/50">
          {/* Preview Header */}
          <div className="px-4 py-2.5 border-b border-warm-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Dokumentfortschritt</span>
            {fieldCount + clauseCount + draftCount > 0 && (
              <Badge variant="outline" className="ml-auto text-[10px]">
                {fieldCount + clauseCount + draftCount} Aktionen
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {/* Employee Autocomplete */}
              <div className="card-soft p-3">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Mitarbeitersuche</span>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={employeeSearch.query}
                    onChange={(e) => employeeSearch.setQuery(e.target.value)}
                    placeholder="Name eingeben..."
                    className="h-8 text-xs pl-8"
                  />
                  {employeeSearch.isLoading && (
                    <Loader2 className="absolute right-2.5 top-2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                {employeeSearch.results.length > 0 && (
                  <div className="mt-1.5 space-y-1 max-h-32 overflow-y-auto">
                    {employeeSearch.results.map((emp, i) => (
                      <button
                        key={i}
                        onClick={() => handleEmployeeSelect(emp.form_data)}
                        className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-warm-100 transition-colors text-xs"
                      >
                        <span className="font-medium text-foreground">{emp.employee_name}</span>
                        {emp.employee_id && (
                          <span className="ml-2 text-muted-foreground">#{emp.employee_id}</span>
                        )}
                        <p className="text-[10px] text-muted-foreground truncate">
                          {emp.latest_document_title}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Smart Defaults Card */}
              {hasDefaults && !defaultsApplied && (
                <div className="card-soft p-3 border-l-2 border-l-primary/40">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-foreground">Vorschläge aus Team-Muster</span>
                    {defaultsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Basierend auf {defaults!.sample_size} früheren Dokumenten
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {Object.keys(defaults!.field_defaults).length} Felder
                    </Badge>
                    {defaults!.common_clause_ids.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {defaults!.common_clause_ids.length} Klauseln
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyDefaults}
                    className="mt-2 w-full text-xs h-7 gap-1.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    Vorschläge übernehmen
                  </Button>
                </div>
              )}

              {defaultsApplied && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Team-Vorschläge übernommen</span>
                </div>
              )}

              {/* Empty State */}
              {fieldCount === 0 && clauseCount === 0 && draftCount === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="p-3 bg-warm-100 rounded-xl mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Das Dokument wird hier aufgebaut, sobald der KI-Assistent
                    Formularfelder setzt und Textbausteine auswählt.
                  </p>
                </div>
              )}

              {/* Form Fields */}
              {fieldCount > 0 && (
                <div className="card-soft p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">Formulardaten</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {fieldCount} Felder
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(formFields).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-medium text-foreground truncate ml-4 max-w-[60%] text-right">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clauses */}
              {clauseCount > 0 && (
                <div className="card-soft p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium">Textbausteine</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {clauseCount} ausgewählt
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {enabledClauses.map(id => (
                      <div key={id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Klausel #{id}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clause Drafts */}
              {draftCount > 0 && (
                <div className="card-soft p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium">KI-Entwürfe</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {draftCount} Entwürfe
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {clauseDrafts.map((draft, i) => (
                      <div key={i} className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="text-xs font-medium text-amber-700">{draft.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
