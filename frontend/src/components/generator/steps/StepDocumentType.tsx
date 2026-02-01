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
import { Card, CardContent } from "@/components/ui/card";
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
        <div className="max-w-xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Welches Dokument erstellen?</h2>
                <p className="text-muted-foreground">
                    Wählen Sie eine Vorlage und geben Sie dem Dokument einen Namen.
                </p>
            </div>

            {/* Dokumenttyp Auswahl */}
            <Card>
                <CardContent className="pt-6 space-y-4">
                    {/* Suchfeld */}
                    <div className="space-y-2">
                        <Label htmlFor="document-type-search">Dokumenttyp suchen</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                id="document-type-search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Suchen nach Name oder Kategorie..."
                                className="h-12 text-base pl-10 pr-10"
                                disabled={isLoading}
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Ausgewählter Typ */}
                    {selectedType && (
                        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                            <Star className="w-4 h-4 text-primary fill-primary" />
                            <span className="font-medium">{selectedType.name}</span>
                            {selectedType.category && (
                                <Badge variant="secondary" className="text-xs">
                                    {selectedType.category}
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="ml-auto h-6 w-6"
                                onClick={() => actions.setDocumentType(0)}
                            >
                                <X className="w-3 h-3" />
                            </Button>
                        </div>
                    )}

                    {/* Dokumenttyp-Liste */}
                    <ScrollArea className="h-[280px] border rounded-lg">
                        <div className="p-2 space-y-4">
                            {/* Zuletzt verwendet */}
                            {!searchQuery && recentTypes.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 px-2 py-1">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Zuletzt verwendet
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {recentTypes.map((type) => (
                                            <button
                                                key={`recent-${type.id}`}
                                                onClick={() => handleDocumentTypeChange(type.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                                                    state.documentTypeId === type.id
                                                        ? "bg-primary/10 text-primary"
                                                        : "hover:bg-muted"
                                                )}
                                            >
                                                <FileText className="w-4 h-4 shrink-0" />
                                                <span className="flex-1 truncate">{type.name}</span>
                                                {type.category && (
                                                    <Badge variant="outline" className="text-xs shrink-0">
                                                        {type.category}
                                                    </Badge>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Kategorisierte Liste */}
                            {Object.entries(groupedTypes).map(([category, types]) => (
                                <div key={category} className="space-y-2">
                                    <div className="px-2 py-1">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            {category}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {types.map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => handleDocumentTypeChange(type.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                                                    state.documentTypeId === type.id
                                                        ? "bg-primary/10 text-primary"
                                                        : "hover:bg-muted"
                                                )}
                                            >
                                                <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                <span className="flex-1 truncate">{type.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {/* Keine Ergebnisse */}
                            {filteredTypes.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Keine Dokumenttypen gefunden für "{searchQuery}"</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Dokumenttitel */}
                    <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="document-title">
                            Wie soll das Dokument heißen?
                        </Label>
                        <Input
                            id="document-title"
                            value={state.documentTitle}
                            onChange={(e) => actions.setDocumentTitle(e.target.value)}
                            placeholder="Titel für Ihre Dokumentübersicht"
                            className="h-12 text-base"
                        />
                        <p className="text-xs text-muted-foreground">
                            Dieser Titel erscheint in Ihrer Dokumentübersicht.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons - Wizard oder Smart Mode */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* Klassischer Wizard Button */}
                <Button
                    size="lg"
                    variant="outline"
                    onClick={() => actions.enterSplitScreenMode()}
                    disabled={!canProceed}
                    className="gap-2 w-full sm:w-auto"
                >
                    <FileText className="w-4 h-4" />
                    Manuell erstellen
                    <ArrowRight className="w-4 h-4" />
                </Button>

                {/* ODER Trenner */}
                <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="h-px w-8 bg-border hidden sm:block" />
                    <span className="text-sm font-medium">ODER</span>
                    <div className="h-px w-8 bg-border hidden sm:block" />
                </div>

                {/* Smart Mode Button - Prominent mit Gradient */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="lg"
                                onClick={() => setIsSmartModeOpen(true)}
                                disabled={!canProceed}
                                className="gap-2 w-full sm:w-auto bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                            >
                                <Sparkles className="w-5 h-5" />
                                Mit KI erstellen
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-slate-900 text-white">
                            <p>Beschreiben Sie einfach, was Sie brauchen</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>

            {/* Hinweis wenn kein Dokumenttyp ausgewaehlt */}
            {!canProceed && (
                <p className="text-center text-sm text-muted-foreground">
                    Bitte waehlen Sie zuerst einen Dokumenttyp aus.
                </p>
            )}

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

            {/* Tipp */}
            <div className="text-center pt-4 border-t">
                <a
                    href="/settings?tab=templates"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                    <FileText className="w-3 h-3" />
                    Sie können auch eine eigene Word-Vorlage importieren
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    );
};

export default StepDocumentType;
