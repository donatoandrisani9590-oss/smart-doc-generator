/**
 * StepDocumentType - Schritt 1: Dokumenttyp und Titel wählen
 *
 * Aufgeräumte Oberfläche mit:
 * 1. Suchfeld für Dokumenttypen (Typeahead)
 * 2. "Zuletzt verwendet" Sektion
 * 3. Kategorisierte Dokumenttyp-Liste
 * 4. Dokumenttitel-Eingabe
 * 
 * v4.2.1: Erweiterte Suchfunktion und Zuletzt-verwendet
 */

import { useState, useMemo, useEffect } from "react";
import { FileText, ArrowRight, Search, Clock, Star, X, Sparkles, LayoutTemplate, ChevronDown, Scale } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWizardContext } from "../WizardContext";
import { SmartModeDialog } from "../SmartModeDialog";
import { apiFetch } from "@/lib/api-client";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
    updated_at?: string | null;
}

interface StepDocumentTypeProps {
    documentTypes: DocumentType[];
    isLoading?: boolean;
}

// LocalStorage key für Nutzungshistorie
const RECENT_TYPES_KEY = "sdg_recent_document_types";
const MAX_RECENT = 5;

interface UserTemplateOption {
    id: number;
    name: string;
    has_logo: boolean;
    has_header: boolean;
    has_footer: boolean;
    scope: string;
    category: string | null;
    is_own: boolean;
}

// Übersetzung der Kategorie-Labels (DB speichert englische Keys)
const CATEGORY_LABELS: Record<string, string> = {
    contract: "Vertrag",
    letter: "Brief",
    memo: "Mitteilung",
    certificate: "Bescheinigung",
    amendment: "Nachtrag",
    default: "Allgemein",
};

function translateCategory(category: string): string {
    const lower = category.toLowerCase();
    return CATEGORY_LABELS[lower] || category;
}

/** Formatiert ein ISO-Datum als kurzen Rechtsstand-Text (z.B. "Stand: Feb 2025") */
function formatRechtsstand(dateStr?: string | null): string | null {
    if (!dateStr) return null;
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return null;
        return date.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
    } catch {
        return null;
    }
}

export const StepDocumentType = ({ documentTypes, isLoading }: StepDocumentTypeProps) => {
    const { state, actions } = useWizardContext();
    const [searchQuery, setSearchQuery] = useState("");
    const [recentTypeIds, setRecentTypeIds] = useState<number[]>([]);
    const [isSmartModeOpen, setIsSmartModeOpen] = useState(false);
    const [userTemplates, setUserTemplates] = useState<UserTemplateOption[]>([]);
    const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
    const [showTypeList, setShowTypeList] = useState(true);

    // Fetch user templates
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const response = await apiFetch("/api/v1/user-templates");
                if (response.ok) {
                    const data = await response.json();
                    setUserTemplates(data.items || []);
                }
            } catch {
                // Silently ignore - templates are optional
            }
        };
        fetchTemplates();
    }, []);

    // Lade Zuletzt-verwendet beim Mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_TYPES_KEY);
            if (stored) {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: initialize state from localStorage on mount
                setRecentTypeIds(JSON.parse(stored));
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    // Speichere ausgewählten Typ in Zuletzt-verwendet
    const saveRecentType = (typeId: number) => {
        try {
            const updated = [typeId, ...recentTypeIds.filter(id => id !== typeId)].slice(0, MAX_RECENT);
            setRecentTypeIds(updated);
            localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify(updated));
        } catch {
            // Ignore localStorage errors
        }
    };

    const handleDocumentTypeChange = (typeId: number) => {
        actions.setDocumentType(typeId);
        saveRecentType(typeId);
        setShowTypeList(false);
    };

    // Gefilterte Dokumenttypen basierend auf Suche
    const filteredTypes = useMemo(() => {
        if (!searchQuery.trim()) {
            return documentTypes;
        }
        const query = searchQuery.toLowerCase();
        return documentTypes.filter(
            (type) =>
                type.name.toLowerCase().includes(query) ||
                type.category?.toLowerCase().includes(query)
        );
    }, [documentTypes, searchQuery]);

    // Zuletzt verwendete Typen (nur die noch existierenden)
    const recentTypes = useMemo(() => {
        return recentTypeIds
            .map(id => documentTypes.find(t => t.id === id))
            .filter((t): t is DocumentType => t !== undefined);
    }, [recentTypeIds, documentTypes]);

    // Gruppiere nach Kategorie
    const groupedTypes = useMemo(() => {
        const groups: Record<string, DocumentType[]> = {};
        for (const type of filteredTypes) {
            const category = type.category || "Sonstige";
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(type);
        }
        return groups;
    }, [filteredTypes]);

    const canProceed = !!state.documentTypeId;
    const selectedType = documentTypes.find(t => t.id === state.documentTypeId);

    return (
        <div className="max-w-xl mx-auto space-y-6">
            {/* Header */}
            <div className="pb-4">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight">
                    Neues Dokument erstellen
                </h1>
                <p className="text-[13px] text-muted-foreground/60 mt-1">
                    Wählen Sie eine Vorlage und geben Sie dem Dokument einen Namen.
                </p>
            </div>

            {/* Dokumenttyp Auswahl */}
            <div className="space-y-4">
                {/* Suchfeld - Clean und prominent */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                    <Input
                        id="document-type-search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Dokumenttyp suchen..."
                        className="h-11 pl-11 pr-10 border-0 shadow-[var(--shadow-elevated)] rounded-2xl bg-card focus:ring-0 focus:shadow-[var(--shadow-elevated-hover)]"
                        disabled={isLoading}
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-warm-400 hover:text-muted-foreground"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Ausgewählter Typ - Deutliche Hervorhebung */}
                {selectedType && (() => {
                    const rechtsstand = formatRechtsstand(selectedType.updated_at);
                    return (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border-l-4 border-l-primary border border-primary/10 rounded-lg">
                        <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                        <span className="font-medium text-foreground">{selectedType.name}</span>
                        {selectedType.category && (
                            <Badge variant="outline" className="text-xs bg-white">
                                {translateCategory(selectedType.category)}
                            </Badge>
                        )}
                        {rechtsstand && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[10px] bg-white/80 text-muted-foreground gap-1 cursor-help">
                                            <Scale className="w-3 h-3" />
                                            Stand: {rechtsstand}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        Letzte Aktualisierung der Vorlage
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6 text-warm-400 hover:text-muted-foreground"
                            onClick={() => { actions.setDocumentType(0); setShowTypeList(true); }}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                    );
                })()}

                {/* Dokumenttyp-Liste - Saubere Gruppierung */}
                {showTypeList && <div className="ive-card overflow-hidden">
                    <ScrollArea className="h-[300px]">
                        <div className="divide-y divide-warm-100">
                            {/* Zuletzt verwendet */}
                            {!searchQuery && recentTypes.length > 0 && (
                                <div>
                                    <div className="px-4 py-2.5">
                                        <span className="ive-section-header flex items-center gap-1.5">
                                            <Clock className="w-3 h-3" />
                                            Zuletzt verwendet
                                        </span>
                                    </div>
                                    <div>
                                        {recentTypes.map((type) => (
                                            <button
                                                key={`recent-${type.id}`}
                                                onClick={() => handleDocumentTypeChange(type.id)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 text-left transition-all border-b border-warm-50 last:border-b-0",
                                                    state.documentTypeId === type.id
                                                        ? "bg-primary/5 border-l-[3px] border-l-primary"
                                                        : "hover:bg-warm-50"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <FileText className={cn(
                                                        "w-4 h-4 shrink-0",
                                                        state.documentTypeId === type.id ? "text-primary" : "text-warm-400"
                                                    )} />
                                                    <span className={cn(
                                                        "text-sm",
                                                        state.documentTypeId === type.id ? "font-medium text-foreground" : "text-foreground"
                                                    )}>{type.name}</span>
                                                </div>
                                                {type.category && (
                                                    <span className="text-[11px] px-2 py-0.5 bg-warm-100 text-muted-foreground rounded">
                                                        {translateCategory(type.category)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Kategorisierte Liste */}
                            {Object.entries(groupedTypes).map(([category, types]) => (
                                <div key={category}>
                                    <div className="px-4 py-2.5">
                                        <span className="ive-section-header">
                                            {translateCategory(category)}
                                        </span>
                                    </div>
                                    <div>
                                        {types.map((type, idx) => {
                                            const stand = formatRechtsstand(type.updated_at);
                                            return (
                                            <button
                                                key={type.id}
                                                onClick={() => handleDocumentTypeChange(type.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
                                                    idx < types.length - 1 && "border-b border-warm-50",
                                                    state.documentTypeId === type.id
                                                        ? "bg-primary/5 border-l-[3px] border-l-primary"
                                                        : "hover:bg-warm-50"
                                                )}
                                            >
                                                <FileText className={cn(
                                                    "w-4 h-4 shrink-0",
                                                    state.documentTypeId === type.id ? "text-primary" : "text-warm-400"
                                                )} />
                                                <span className={cn(
                                                    "text-sm flex-1",
                                                    state.documentTypeId === type.id ? "font-medium text-foreground" : "text-foreground"
                                                )}>{type.name}</span>
                                                {stand && (
                                                    <span className="text-[10px] text-muted-foreground/70 shrink-0">
                                                        {stand}
                                                    </span>
                                                )}
                                            </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* Keine Ergebnisse */}
                            {filteredTypes.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">
                                    <Search className="w-8 h-8 mx-auto mb-2 text-warm-300" />
                                    <p className="text-sm">Keine Ergebnisse für "{searchQuery}"</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>}

                {/* Dokumenttitel */}
                <div className="space-y-2 pt-4">
                    <Label htmlFor="document-title" className="text-sm font-medium text-foreground">
                        Dokumentname
                    </Label>
                    <Input
                        id="document-title"
                        value={state.documentTitle}
                        onChange={(e) => actions.setDocumentTitle(e.target.value)}
                        placeholder="z.B. Arbeitsvertrag Max Müller"
                        className="h-11 border-border focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <p className="text-xs text-muted-foreground">
                        Dieser Name erscheint in Ihrer Dokumentübersicht.
                    </p>
                </div>

                {/* Vorlage verwenden (optional, collapsible) */}
                {userTemplates.length > 0 && (
                    <Collapsible open={templateSectionOpen || !!state.userTemplateId} onOpenChange={setTemplateSectionOpen}>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2 group">
                            <LayoutTemplate className="w-4 h-4" />
                            <span>Vorlage verwenden</span>
                            <ChevronDown className={cn(
                                "w-3.5 h-3.5 transition-transform ml-auto",
                                (templateSectionOpen || !!state.userTemplateId) && "rotate-180"
                            )} />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3 space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Verwenden Sie eine DOCX-Vorlage als Layout-Basis (mit Logo, Kopf-/Fusszeile).
                            </p>
                            <div className="grid gap-2">
                                {/* "Keine Vorlage" Option */}
                                <button
                                    onClick={() => actions.setUserTemplateId(null)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm",
                                        !state.userTemplateId
                                            ? "border-primary bg-primary/5 text-foreground font-medium"
                                            : "border-border hover:border-border/80 text-muted-foreground"
                                    )}
                                >
                                    Standard-Layout (ohne Vorlage)
                                </button>

                                {/* Own templates */}
                                {userTemplates.filter(t => t.is_own).length > 0 && (
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                                        Eigene Vorlagen
                                    </div>
                                )}
                                {userTemplates.filter(t => t.is_own).map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => actions.setUserTemplateId(template.id)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
                                            state.userTemplateId === template.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-border/80"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className={cn(
                                                "w-4 h-4 shrink-0",
                                                state.userTemplateId === template.id ? "text-primary" : "text-warm-400"
                                            )} />
                                            <span className={cn(
                                                "text-sm truncate",
                                                state.userTemplateId === template.id ? "font-medium text-foreground" : "text-foreground"
                                            )}>
                                                {template.name}
                                            </span>
                                            <div className="flex gap-1 ml-auto shrink-0">
                                                {template.has_logo && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Logo</Badge>
                                                )}
                                                {template.has_header && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Kopf</Badge>
                                                )}
                                                {template.has_footer && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Fuss</Badge>
                                                )}
                                                {template.category && (
                                                    <Badge variant="outline" className="text-[9px] py-0 px-1">{template.category}</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}

                                {/* Shared templates */}
                                {userTemplates.filter(t => !t.is_own).length > 0 && (
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                                        Geteilte Vorlagen
                                    </div>
                                )}
                                {userTemplates.filter(t => !t.is_own).map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => actions.setUserTemplateId(template.id)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
                                            state.userTemplateId === template.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-border/80"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className={cn(
                                                "w-4 h-4 shrink-0",
                                                state.userTemplateId === template.id ? "text-primary" : "text-warm-400"
                                            )} />
                                            <span className={cn(
                                                "text-sm truncate",
                                                state.userTemplateId === template.id ? "font-medium text-foreground" : "text-foreground"
                                            )}>
                                                {template.name}
                                            </span>
                                            <div className="flex gap-1 ml-auto shrink-0">
                                                {template.has_logo && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Logo</Badge>
                                                )}
                                                {template.has_header && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Kopf</Badge>
                                                )}
                                                {template.has_footer && (
                                                    <Badge variant="secondary" className="text-[9px] py-0 px-1">Fuss</Badge>
                                                )}
                                                {template.category && (
                                                    <Badge variant="outline" className="text-[9px] py-0 px-1">{template.category}</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>

            {/* Action Buttons */}
            <div className="pt-6">
                <div className="flex items-center justify-center gap-3">
                    <Button
                        onClick={() => actions.enterSplitScreenMode()}
                        disabled={!canProceed}
                        className="h-11 px-6 rounded-xl shadow-[var(--shadow-elevated)] disabled:opacity-50"
                    >
                        Manuell erstellen
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <Button
                        variant="ghost"
                        onClick={() => setIsSmartModeOpen(true)}
                        disabled={!canProceed}
                        className="h-11 px-6 text-primary/70 hover:bg-primary/5 rounded-xl disabled:opacity-50"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Mit KI erstellen
                    </Button>
                </div>

                {/* Hinweis wenn kein Dokumenttyp ausgewählt */}
                {!canProceed && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                        Bitte wählen Sie zuerst einen Dokumenttyp aus.
                    </p>
                )}
            </div>

            {/* Smart Mode Dialog */}
            {selectedType && (
                <SmartModeDialog
                    open={isSmartModeOpen}
                    onOpenChange={setIsSmartModeOpen}
                    documentTypeId={selectedType.id}
                    documentTypeName={selectedType.name}
                    onComplete={(smartModeData, title) => {
                        // Setze den Titel
                        actions.setDocumentTitle(title);

                        // Bekannte FormData-Felder
                        const knownFields = [
                            'vorname', 'nachname', 'strasse', 'plz', 'ort', 'geburtsdatum',
                            'position', 'gehalt', 'eintrittsdatum', 'wochenstunden', 'probezeit',
                            'urlaubstage', 'firmenwagen', 'homeoffice', 'signatory_name'
                        ];

                        // Trenne bekannte und dynamische Felder
                        const formDataFields: Record<string, unknown> = {};

                        for (const [key, value] of Object.entries(smartModeData)) {
                            if (knownFields.includes(key)) {
                                formDataFields[key] = value;
                            } else {
                                // Dynamische Felder einzeln setzen
                                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                                    actions.updateDynamicField(key, value);
                                }
                            }
                        }

                        // Setze bekannte FormData-Felder
                        if (Object.keys(formDataFields).length > 0) {
                            actions.setFormData(formDataFields as Partial<import('../WizardContext').FormData>);
                        }

                        // Wechsle zum Editor
                        actions.enterSplitScreenMode();
                    }}
                />
            )}

            {/* Dezenter Tipp */}
            <div className="text-center">
                <a
                    href="/settings?tab=templates"
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors inline-flex items-center gap-1"
                >
                    Eigene Word-Vorlage importieren
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
};

export default StepDocumentType;
