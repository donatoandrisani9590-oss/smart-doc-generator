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
import { FileText, Briefcase, FileSignature, UserMinus, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { logError } from "@/lib/logger";

interface DocumentType {
    id: number;
    name: string;
    description?: string;
    country_code: string;
    is_active: boolean;
}

// Vordefinierte Icons für bekannte Dokumenttypen
const getIconForType = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes("arbeitsvertrag") || lowerName.includes("employment")) {
        return Briefcase;
    }
    if (lowerName.includes("kündigung") || lowerName.includes("termination")) {
        return UserMinus;
    }
    if (lowerName.includes("änderung") || lowerName.includes("amendment")) {
        return FileSignature;
    }
    return FileText;
};

// Vordefinierte Farben für Kacheln
const TILE_COLORS = [
    { bg: "bg-blue-50 hover:bg-blue-100", icon: "bg-blue-100 text-blue-600", border: "border-blue-200" },
    { bg: "bg-purple-50 hover:bg-purple-100", icon: "bg-purple-100 text-purple-600", border: "border-purple-200" },
    { bg: "bg-emerald-50 hover:bg-emerald-100", icon: "bg-emerald-100 text-emerald-600", border: "border-emerald-200" },
];

interface QuickTemplatesProps {
    className?: string;
}

export const QuickTemplates = ({ className }: QuickTemplatesProps) => {
    const navigate = useNavigate();
    const [types, setTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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

    const handleSelectType = (typeId: number) => {
        navigate(`/composer?type=${typeId}`);
    };

    if (isLoading) {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (types.length === 0) {
        return null;
    }

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Schnellstart</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {types.map((type, index) => {
                    const Icon = getIconForType(type.name);
                    const colors = TILE_COLORS[index % TILE_COLORS.length];

                    return (
                        <button
                            key={type.id}
                            onClick={() => handleSelectType(type.id)}
                            className={`
                                flex items-center gap-4 p-5 rounded-2xl border transition-all text-left group
                                ${colors.bg} ${colors.border}
                            `}
                        >
                            <div className={`p-3 rounded-xl ${colors.icon}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                    {type.name}
                                </p>
                                {type.description && (
                                    <p className="text-xs text-gray-500 truncate mt-0.5">
                                        {type.description}
                                    </p>
                                )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuickTemplates;
