/**
 * QuickTemplates - Schnellzugriff auf häufig genutzte Templates
 *
 * Zeigt die Top 3 Dokumenttypen als prominente Kacheln auf dem Dashboard.
 * Ermöglicht One-Click-Start für häufig genutzte Dokumente.
 *
 * PandaDoc-inspiriert: Templates im Vordergrund
 * v1.0: Initial implementation
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Briefcase, FileSignature, UserMinus, Wand2, Award, AlertTriangle, Home, GraduationCap, Car, FileCheck, Clock, Gift, ScrollText, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";
import { SmartModeDialog } from "@/components/generator/SmartModeDialog";

interface DocumentType {
    id: number;
    name: string;
    description?: string;
    country_code: string;
    is_active: boolean;
}

// Vordefinierte Icons für bekannte Dokumenttypen
// Erweitert für alle HR-Dokumenttypen (Phase 1-3)
const getIconForType = (name: string) => {
    const lowerName = name.toLowerCase();

    // PHASE 1: Einstellung & Onboarding
    if (lowerName.includes("arbeitsvertrag") || lowerName.includes("employment") || lowerName.includes("anstellung")) {
        return Briefcase;
    }
    if (lowerName.includes("einstellungszusage") || lowerName.includes("zusage")) {
        return FileCheck;
    }
    if (lowerName.includes("absage") || lowerName.includes("ablehnung")) {
        return FileText;
    }
    if (lowerName.includes("geheimhaltung") || lowerName.includes("verschwiegenheit") || lowerName.includes("nda")) {
        return Shield;
    }

    // PHASE 2: Laufendes Arbeitsverhältnis
    if (lowerName.includes("nachtrag") || lowerName.includes("änderung") || lowerName.includes("amendment")) {
        return FileSignature;
    }
    if (lowerName.includes("gehaltserh") || lowerName.includes("beförderung") || lowerName.includes("promotion")) {
        return Award;
    }
    if (lowerName.includes("abmahnung") || lowerName.includes("warning")) {
        return AlertTriangle;
    }
    if (lowerName.includes("homeoffice") || lowerName.includes("remote") || lowerName.includes("telearbeit")) {
        return Home;
    }
    if (lowerName.includes("fortbildung") || lowerName.includes("schulung") || lowerName.includes("weiterbildung")) {
        return GraduationCap;
    }
    if (lowerName.includes("firmenwagen") || lowerName.includes("dienstwagen")) {
        return Car;
    }
    if (lowerName.includes("bonus") || lowerName.includes("prämie")) {
        return Gift;
    }
    if (lowerName.includes("überstunden") || lowerName.includes("arbeitszeit")) {
        return Clock;
    }
    if (lowerName.includes("elternzeit") || lowerName.includes("mutterschutz")) {
        return FileText;
    }

    // PHASE 3: Beendigung
    if (lowerName.includes("kündigung") || lowerName.includes("termination") || lowerName.includes("aufhebung")) {
        return UserMinus;
    }
    if (lowerName.includes("zeugnis") || lowerName.includes("certificate") || lowerName.includes("reference")) {
        return ScrollText;
    }
    if (lowerName.includes("freistellung")) {
        return FileCheck;
    }

    return FileText;
};

// SimpleDocs-Style: Soft Cards mit farbigen Icons
const TILE_COLORS = [
    { bg: "hover:bg-blue-50/50", icon: "text-blue-600" },
    { bg: "hover:bg-purple-50/50", icon: "text-purple-600" },
    { bg: "hover:bg-emerald-50/50", icon: "text-emerald-600" },
];

interface QuickTemplatesProps {
    className?: string;
}

export const QuickTemplates = ({ className }: QuickTemplatesProps) => {
    const navigate = useNavigate();
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [smartModeOpen, setSmartModeOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<DocumentType | null>(null);

    useEffect(() => {
        const loadTypes = async () => {
            try {
                const response = await api.get<DocumentType[]>("/api/v1/document-types/");
                // Nur aktive Types, Top 3
                const activeTypes = response.data.filter((t) => t.is_active).slice(0, 3);
                setTypes(activeTypes);
            } catch (error) {
                logError("Failed to load document types for quick templates", { error });
            } finally {
                setIsLoading(false);
            }
        };
        loadTypes();
    }, []);

    const handleSelectType = (type: DocumentType, useSmartMode: boolean = false) => {
        if (useSmartMode) {
            setSelectedType(type);
            setSmartModeOpen(true);
        } else {
            navigate(`/generate?type=${type.id}`);
        }
    };

    const handleSmartModeComplete = (formData: Record<string, unknown>, title: string) => {
        // Navigate to editor with pre-filled data
        const params = new URLSearchParams();
        params.set("type", String(selectedType?.id));
        params.set("data", JSON.stringify(formData));
        params.set("title", title);
        navigate(`/generate?${params.toString()}`);
    };

    if (isLoading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${className}`}>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
            </div>
        );
    }

    if (types.length === 0) {
        return null;
    }

    return (
        <div className={`space-y-3 ${className}`}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schnellstart</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {types.map((type, index) => {
                    const Icon = getIconForType(type.name);
                    const colors = TILE_COLORS[index % TILE_COLORS.length];

                    return (
                        <div
                            key={type.id}
                            className={`
                                relative flex items-center gap-3 p-4 card-soft text-left group
                                ${colors.bg}
                            `}
                        >
                            <button
                                onClick={() => handleSelectType(type, false)}
                                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                                <Icon className={`w-5 h-5 shrink-0 ${colors.icon}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {type.name}
                                    </p>
                                    {type.description && (
                                        <p className="text-xs text-muted-foreground truncate">
                                            {type.description}
                                        </p>
                                    )}
                                </div>
                            </button>
                            {/* KI Button */}
                            <button
                                onClick={() => handleSelectType(type, true)}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors shrink-0"
                                title="Mit KI erstellen"
                            >
                                <Wand2 className="w-3 h-3" />
                                KI
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Smart Mode Dialog */}
            {selectedType && (
                <SmartModeDialog
                    open={smartModeOpen}
                    onOpenChange={setSmartModeOpen}
                    documentTypeId={selectedType.id}
                    documentTypeName={selectedType.name}
                    onComplete={handleSmartModeComplete}
                />
            )}
        </div>
    );
};

export default QuickTemplates;
