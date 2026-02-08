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
import { FileText, ArrowRight, Search, Clock, Star, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWizardContext } from "../WizardContext";
import { SmartModeDialog } from "../SmartModeDialog";

interface DocumentType {
    id: number;
    name: string;
    category?: string;
}

interface StepDocumentTypeProps {
    documentTypes: DocumentType[];
    isLoading?: boolean;
}

// LocalStorage key für Nutzungshistorie
const RECENT_TYPES_KEY = "sdg_recent_document_types";
const MAX_RECENT = 5;

export const StepDocumentType = ({ documentTypes, isLoading }: StepDocumentTypeProps) => {
    const { state, actions } = useWizardContext();
    const [searchQuery, setSearchQuery] = useState("");
    const [recentTypeIds, setRecentTypeIds] = useState<number[]>([]);
    const [isSmartModeOpen, setIsSmartModeOpen] = useState(false);

    // Lade Zuletzt-verwendet beim Mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(RECENT_TYPES_KEY);
            if (stored) {
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
            {/* Header - Kompakt und clean */}
            <div className="pb-4 border-b">
                <h1 className="text-2xl font-semibold text-foreground">
                    Neues Dokument erstellen
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Wählen Sie eine Vorlage und geben Sie dem Dokument einen Namen.
                </p>
            </div>

            {/* Dokumenttyp Auswahl */}
            <div className="space-y-4">
                {/* Suchfeld - Clean und prominent */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                    <Input
                        id="document-type-search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Dokumenttyp suchen..."
                        className="h-11 pl-11 pr-10 border-warm-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
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
                {selectedType && (
                    <div className="flex items-center gap-3 p-3 bg-primary/5 border-l-4 border-l-primary border border-primary/10 rounded-lg">
                        <Star className="w-4 h-4 text-primary fill-primary shrink-0" />
                        <span className="font-medium text-foreground">{selectedType.name}</span>
                        {selectedType.category && (
                            <Badge variant="outline" className="text-xs bg-white">
                                {selectedType.category}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6 text-warm-400 hover:text-muted-foreground"
                            onClick={() => actions.setDocumentType(0)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                )}

                {/* Dokumenttyp-Liste - Saubere Gruppierung */}
                <div className="border border-warm-200 rounded-lg overflow-hidden bg-white">
                    <ScrollArea className="h-[300px]">
                        <div className="divide-y divide-warm-100">
                            {/* Zuletzt verwendet */}
                            {!searchQuery && recentTypes.length > 0 && (
                                <div>
                                    <div className="px-4 py-2.5 bg-warm-50/80 border-b border-warm-100">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
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
                                                        {type.category}
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
                                    <div className="px-4 py-2.5 bg-warm-50/80 border-b border-warm-100">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                            {category}
                                        </span>
                                    </div>
                                    <div>
                                        {types.map((type, idx) => (
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
                                                    "text-sm",
                                                    state.documentTypeId === type.id ? "font-medium text-foreground" : "text-foreground"
                                                )}>{type.name}</span>
                                            </button>
                                        ))}
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
                </div>

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
                        className="h-11 border-warm-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />
                    <p className="text-xs text-muted-foreground">
                        Dieser Name erscheint in Ihrer Dokumentübersicht.
                    </p>
                </div>
            </div>

            {/* Action Buttons - Klare visuelle Hierarchie */}
            <div className="pt-6 border-t border-warm-100">
                <div className="flex items-center justify-center gap-4">
                    {/* Sekundärer Button: Manuell */}
                    <Button
                        variant="outline"
                        onClick={() => actions.enterSplitScreenMode()}
                        disabled={!canProceed}
                        className="h-11 px-6 border-warm-200 text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                        Manuell erstellen
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <span className="text-sm text-warm-400">oder</span>

                    {/* Primärer Button: Mit KI - Klar hervorgehoben */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={() => setIsSmartModeOpen(true)}
                                    disabled={!canProceed}
                                    className="h-11 px-7 bg-primary hover:bg-primary/90 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Mit KI erstellen
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Beschreiben Sie einfach, was Sie brauchen</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
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
                    className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                    Eigene Word-Vorlage importieren
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
};

export default StepDocumentType;
