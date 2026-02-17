/**
 * AgentPage — KI-Dokumentassistent (ChatGPT-inspired layout)
 *
 * Clean, centered chat with contextual sidebar:
 * - Chat fills main area with max-width constraint (like ChatGPT)
 * - Right sidebar slides in when agent produces data (form fields, clauses)
 * - Minimal header with doc type selector + manual mode switch
 *
 * Nahtloser Wechsel zum manuellen Modus über "Manuell bearbeiten"-Button.
 */

import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  PenLine,
  Sparkles,
  Settings2,
  CheckCircle2,
  FileText,
  Search,
  User,
  TrendingUp,
  Loader2,
  PanelRightOpen,
  PanelRightClose,
  ChevronRight,
} from "lucide-react";
import { AgentChat } from "@/components/agent/AgentChat";
import { useCountry } from "@/hooks/useCountry";
import { useDocumentTypes } from "@/hooks/api/useDocumentTypeQueries";
import { useMyTeams } from "@/hooks/api/useTeamQueries";
import { useEmployeeAutocomplete } from "@/hooks/useEmployeeAutocomplete";
import { useSmartDefaults } from "@/hooks/useSmartDefaults";
import { cn } from "@/lib/utils";

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Data
  const { data: documentTypes } = useDocumentTypes(country);
  const { data: teams } = useMyTeams(country);

  // Smart features
  const employeeSearch = useEmployeeAutocomplete(country);
  const { defaults, isLoading: defaultsLoading } = useSmartDefaults(selectedTeamId, selectedDocTypeId);

  // Callbacks from AgentChat
  const handleFormUpdate = useCallback((fields: Record<string, string>) => {
    setFormFields(prev => ({ ...prev, ...fields }));
  }, []);

  const handleClauseUpdate = useCallback((enable: number[], disable: number[]) => {
    setEnabledClauses(prev => [...new Set([...prev, ...enable])].filter(id => !disable.includes(id)));
  }, []);

  const handleClauseDraft = useCallback((title: string, html: string) => {
    setClauseDrafts(prev => [...prev, { title, html }]);
  }, []);

  // Employee auto-fill
  const handleEmployeeSelect = useCallback((formData: Record<string, string>) => {
    setFormFields(prev => ({ ...prev, ...formData }));
    employeeSearch.clear();
  }, [employeeSearch]);

  // Apply smart defaults
  const handleApplyDefaults = useCallback(() => {
    if (!defaults?.field_defaults) return;
    setFormFields(prev => ({ ...defaults.field_defaults, ...prev }));
    if (defaults.common_clause_ids?.length) {
      setEnabledClauses(prev => [...new Set([...prev, ...defaults.common_clause_ids])]);
    }
    setDefaultsApplied(true);
  }, [defaults]);

  // Switch to manual mode
  const switchToManual = () => {
    const params = new URLSearchParams();
    if (selectedDocTypeId) params.set("type", String(selectedDocTypeId));
    if (Object.keys(formFields).length > 0) {
      params.set("data", JSON.stringify(formFields));
    }
    navigate(`/generate?${params.toString()}`);
  };

  // Computed
  const fieldCount = Object.keys(formFields).length;
  const clauseCount = enabledClauses.length;
  const draftCount = clauseDrafts.length;
  const totalActions = fieldCount + clauseCount + draftCount;

  const hasDefaults = useMemo(() => defaults && (
    Object.keys(defaults.field_defaults).length > 0 || defaults.common_clause_ids.length > 0
  ), [defaults]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* Minimal Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-warm-100 bg-background/80 backdrop-blur-sm flex-shrink-0">
        {/* Left: Title */}
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm text-foreground">KI-Assistent</span>

        <div className="flex-1" />

        {/* Center: Selectors */}
        <div className="flex items-center gap-2">
          {teams && teams.length > 0 && (
            <Select
              value={selectedTeamId ? String(selectedTeamId) : ""}
              onValueChange={(v) => { setSelectedTeamId(v ? Number(v) : null); setDefaultsApplied(false); }}
            >
              <SelectTrigger className="w-36 h-8 text-xs border-warm-200">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t: { id: number; name: string }) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {documentTypes && documentTypes.length > 0 && (
            <Select
              value={selectedDocTypeId ? String(selectedDocTypeId) : ""}
              onValueChange={(v) => { setSelectedDocTypeId(v ? Number(v) : null); setDefaultsApplied(false); }}
            >
              <SelectTrigger className="w-44 h-8 text-xs border-warm-200">
                <SelectValue placeholder="Dokumenttyp" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((dt: { id: number; name: string }) => (
                  <SelectItem key={dt.id} value={String(dt.id)}>{dt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="w-px h-5 bg-warm-200 mx-1" />

        {/* Right: Actions */}
        <Button variant="ghost" size="sm" onClick={switchToManual} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <PenLine className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Manuell</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title={sidebarOpen ? "Seitenleiste ausblenden" : "Seitenleiste einblenden"}
        >
          {sidebarOpen ? (
            <PanelRightClose className="w-4 h-4 text-muted-foreground" />
          ) : (
            <PanelRightOpen className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Chat Area — Centered */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
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

        {/* Right Sidebar — Contextual */}
        <div
          className={cn(
            "border-l border-warm-100 bg-warm-50/30 flex flex-col min-h-0 transition-all duration-200 overflow-hidden",
            sidebarOpen ? "w-[300px] flex-shrink-0" : "w-0"
          )}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar Header */}
              <div className="px-4 py-3 border-b border-warm-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Dokument</span>
                  {totalActions > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {totalActions}
                    </Badge>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {/* Employee Search */}
                  <div className="rounded-lg border border-warm-100 bg-background p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Mitarbeitersuche</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={employeeSearch.query}
                        onChange={(e) => employeeSearch.setQuery(e.target.value)}
                        placeholder="Name eingeben..."
                        className="h-8 text-xs pl-8 border-warm-200"
                      />
                      {employeeSearch.isLoading && (
                        <Loader2 className="absolute right-2.5 top-2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {employeeSearch.results.length > 0 && (
                      <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                        {employeeSearch.results.map((emp, i) => (
                          <button
                            key={i}
                            onClick={() => handleEmployeeSelect(emp.form_data)}
                            className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-warm-100 transition-colors text-xs group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{emp.employee_name}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {emp.employee_id && (
                              <span className="text-[10px] text-muted-foreground">#{emp.employee_id}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Smart Defaults */}
                  {hasDefaults && !defaultsApplied && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-medium text-foreground">Team-Vorschläge</span>
                        {defaultsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2">
                        Aus {defaults!.sample_size} früheren Dokumenten
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyDefaults}
                        className="w-full text-xs h-7 gap-1.5 border-primary/20 hover:bg-primary/10"
                      >
                        <Sparkles className="w-3 h-3" />
                        Übernehmen
                      </Button>
                    </div>
                  )}

                  {defaultsApplied && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Vorschläge übernommen
                    </div>
                  )}

                  {/* Form Fields */}
                  {fieldCount > 0 && (
                    <div className="rounded-lg border border-warm-100 bg-background p-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Settings2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-medium">Formulardaten</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                          {fieldCount}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(formFields).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-[11px] py-0.5">
                            <span className="text-muted-foreground truncate">{key}</span>
                            <span className="font-medium text-foreground truncate ml-3 max-w-[55%] text-right">
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clauses */}
                  {clauseCount > 0 && (
                    <div className="rounded-lg border border-warm-100 bg-background p-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs font-medium">Textbausteine</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                          {clauseCount}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {enabledClauses.map(id => (
                          <div key={id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                            Klausel #{id}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clause Drafts */}
                  {draftCount > 0 && (
                    <div className="rounded-lg border border-warm-100 bg-background p-3">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-medium">KI-Entwürfe</span>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                          {draftCount}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        {clauseDrafts.map((draft, i) => (
                          <div key={i} className="px-2.5 py-1.5 bg-amber-50 rounded-md border border-amber-200">
                            <span className="text-[11px] font-medium text-amber-700">{draft.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {totalActions === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="p-3 bg-warm-100 rounded-xl mb-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                        Hier erscheinen Formulardaten und Textbausteine, sobald der Assistent arbeitet.
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Sidebar Footer — Switch to manual */}
              {totalActions > 0 && (
                <div className="p-3 border-t border-warm-100 flex-shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={switchToManual}
                    className="w-full gap-1.5 text-xs"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Im Editor weiterbearbeiten
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
