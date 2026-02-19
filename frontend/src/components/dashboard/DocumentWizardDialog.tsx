import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, ChevronRight, Loader2, History, LayoutTemplate, Lightbulb } from "lucide-react";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";

// LocalStorage key für kürzlich verwendete Types
const RECENT_TYPES_KEY = "documentWizard_recentTypes";
const MAX_RECENT_TYPES = 3;

// Hilfsfunktionen für Recently Used
const getRecentTypeIds = (): number[] => {
    try {
        const stored = localStorage.getItem(RECENT_TYPES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const addRecentTypeId = (typeId: number): void => {
    try {
        const recent = getRecentTypeIds().filter(id => id !== typeId);
        recent.unshift(typeId);
        localStorage.setItem(RECENT_TYPES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_TYPES)));
    } catch {
        // Ignore localStorage errors
    }
};

interface DocumentType {
    id: number;
    name: string;
    description?: string;
    country_code: string;
    is_active: boolean;
}

interface DocumentWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const DocumentWizardDialog = ({
    open,
    onOpenChange,
}: DocumentWizardDialogProps) => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && types.length === 0) {
            const loadTypes = async () => {
                setIsLoading(true);
                try {
                    const response = await api.get<DocumentType[]>("/api/v1/document-types");
                    setTypes(response.data.filter((t) => t.is_active));
                } catch (error) {
                    logError("Failed to load document types", { error });
                } finally {
                    setIsLoading(false);
                }
            };
            loadTypes();
        }
    }, [open, types.length]);

    const filteredTypes = types.filter((t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Kürzlich verwendete Types (basierend auf localStorage)
    const recentTypes = useMemo(() => {
        const recentIds = getRecentTypeIds();
        return recentIds
            .map(id => types.find(t => t.id === id))
            .filter((t): t is DocumentType => t !== undefined);
    }, [types]);

    // Zeige Recently Used nur wenn keine Suche aktiv
    const showRecentlyUsed = !searchTerm && recentTypes.length > 0;

    const handleSelectType = (typeId: number) => {
        // Speichere in Recently Used
        addRecentTypeId(typeId);
        // Navigate to generator with pre-selected type
        navigate(`/generate?type=${typeId}`);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white/95 backdrop-blur-sm shadow-2xl border-white/20 p-0 overflow-hidden gap-0">
                <div className="p-6 border-b bg-warm-50/50">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Neues Dokument</DialogTitle>
                        <DialogDescription>
                            Was möchten Sie heute erstellen?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Suchen (z.B. Arbeitsvertrag, Kündigung)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Kürzlich verwendet */}
                            {showRecentlyUsed && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <History className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Kürzlich verwendet
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {recentTypes.map((type) => (
                                            <button
                                                key={`recent-${type.id}`}
                                                onClick={() => handleSelectType(type.id)}
                                                className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 text-left transition-all group"
                                            >
                                                <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                                                <span className="font-medium text-sm text-primary truncate">
                                                    {type.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Alle Dokumenttypen */}
                            {showRecentlyUsed && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-muted-foreground">
                                        Alle Dokumenttypen
                                    </span>
                                    <div className="flex-1 h-px bg-warm-200" />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectType(type.id)}
                                    className="flex items-start gap-3 p-4 rounded-xl border border-warm-100 bg-warm-50/30 hover:bg-primary/5 hover:border-primary/20 text-left transition-all group"
                                >
                                    <div className="p-2.5 bg-white rounded-lg shadow-sm border border-warm-100 group-hover:border-primary/20 group-hover:text-primary transition-colors">
                                        <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-foreground group-hover:text-primary truncate">
                                            {type.name}
                                        </div>
                                        {type.description && (
                                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                {type.description}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-warm-300 group-hover:text-primary/50 self-center" />
                                </button>
                            ))}
                            {filteredTypes.length === 0 && types.length === 0 && (
                                <div className="col-span-2 text-center py-10">
                                    <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-4">
                                        <LayoutTemplate className="w-6 h-6 text-primary" />
                                    </div>
                                    <p className="font-medium text-foreground mb-1">
                                        Noch keine Dokumenttypen vorhanden
                                    </p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Um Dokumente zu erstellen, benötigen Sie zuerst eine Dokumentvorlage.
                                    </p>
                                    <Button
                                        onClick={() => {
                                            onOpenChange(false);
                                            navigate("/settings?tab=templates");
                                        }}
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        <LayoutTemplate className="w-4 h-4 mr-2" />
                                        Vorlage erstellen
                                    </Button>
                                    <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground justify-center">
                                        <Lightbulb className="w-3.5 h-3.5" />
                                        <span>Tipp: Du kannst auch eine bestehende Word-Vorlage importieren.</span>
                                    </div>
                                </div>
                            )}
                            {filteredTypes.length === 0 && types.length > 0 && (
                                <div className="col-span-2 text-center py-8 text-muted-foreground">
                                    Keine Dokumenttypen für „{searchTerm}" gefunden.
                                </div>
                            )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-warm-50 border-t flex justify-end">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Abbrechen
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
