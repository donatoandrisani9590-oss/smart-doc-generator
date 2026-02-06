/**
 * VariantSelector - Auswahl von Klausel-Varianten im Dokument-Generator
 *
 * v4.2 Feature (Kapitel 16.13):
 * - Zeigt Radio-Buttons für Varianten einer Klausel-Gruppe
 * - Standard-Variante ist vorausgewählt
 * - Beschreibung hilft bei der Auswahl
 */

import { useState, useEffect } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════
interface ClauseVariant {
    id: number;
    group_id: number;
    clause_id: number;
    variant_name: string;
    variant_code?: string;
    description?: string;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
    clause_title?: string;
}

interface VariantGroup {
    id: number;
    name: string;
    description?: string;
    category?: string;
    country_code: string;
    is_active: boolean;
    variants: ClauseVariant[];
}

interface VariantSelectorProps {
    /** ID der Varianten-Gruppe */
    groupId: number;
    /** Aktuell ausgewählte Varianten-ID */
    selectedVariantId?: number;
    /** Callback bei Auswahl einer Variante */
    onSelect: (variantId: number, clauseId: number) => void;
    /** Kompakte Darstellung */
    compact?: boolean;
    /** Deaktiviert */
    disabled?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════════
const API_BASE = "/api/v1";

const fetchVariantGroup = async (groupId: number): Promise<VariantGroup | null> => {
    try {
        const res = await apiFetch(`${API_BASE}/clause-variants/groups/${groupId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export const VariantSelector = ({
    groupId,
    selectedVariantId,
    onSelect,
    compact = false,
    disabled = false,
}: VariantSelectorProps) => {
    const [group, setGroup] = useState<VariantGroup | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Lade Varianten-Gruppe
    useEffect(() => {
        const loadGroup = async () => {
            setIsLoading(true);
            setError(null);
            const data = await fetchVariantGroup(groupId);
            if (data) {
                setGroup(data);
                // Wenn keine Variante ausgewählt, wähle Standard-Variante
                if (!selectedVariantId) {
                    const defaultVariant = data.variants.find((v) => v.is_default);
                    if (defaultVariant) {
                        onSelect(defaultVariant.id, defaultVariant.clause_id);
                    } else if (data.variants.length > 0) {
                        onSelect(data.variants[0].id, data.variants[0].clause_id);
                    }
                }
            } else {
                setError("Varianten konnten nicht geladen werden");
            }
            setIsLoading(false);
        };

        loadGroup();
    }, [groupId]);

    // Loading State
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Varianten laden...</span>
            </div>
        );
    }

    // Error State
    if (error || !group) {
        return (
            <div className="text-sm text-red-500 py-2">
                {error || "Keine Varianten verfügbar"}
            </div>
        );
    }

    // Keine Varianten
    if (group.variants.length === 0) {
        return (
            <div className="text-sm text-muted-foreground py-2">
                Keine Varianten definiert
            </div>
        );
    }

    // Sortierte aktive Varianten
    const activeVariants = group.variants
        .filter((v) => v.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

    return (
        <div className={cn("space-y-2", compact ? "py-1" : "py-3")}>
            {/* Gruppen-Header (nur wenn nicht kompakt) */}
            {!compact && group.description && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{group.description}</span>
                </div>
            )}

            {/* Radio-Group für Varianten */}
            <RadioGroup
                value={selectedVariantId?.toString()}
                onValueChange={(value) => {
                    const variant = activeVariants.find((v) => v.id.toString() === value);
                    if (variant) {
                        onSelect(variant.id, variant.clause_id);
                    }
                }}
                disabled={disabled}
                className="space-y-2"
            >
                {activeVariants.map((variant) => (
                    <div
                        key={variant.id}
                        className={cn(
                            "flex items-start space-x-3 rounded-lg border p-3 transition-all",
                            selectedVariantId === variant.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <RadioGroupItem
                            value={variant.id.toString()}
                            id={`variant-${variant.id}`}
                            className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                            <Label
                                htmlFor={`variant-${variant.id}`}
                                className={cn(
                                    "flex items-center gap-2 cursor-pointer font-medium",
                                    disabled && "cursor-not-allowed"
                                )}
                            >
                                {variant.variant_code && (
                                    <Badge variant="outline" className="text-xs font-mono">
                                        {variant.variant_code}
                                    </Badge>
                                )}
                                <span>{variant.variant_name}</span>
                                {variant.is_default && (
                                    <Badge className="bg-secondary/10 text-secondary text-xs ml-1">
                                        <Star className="w-3 h-3 mr-1 fill-current" />
                                        Standard
                                    </Badge>
                                )}
                            </Label>
                            {variant.description && !compact && (
                                <p className="text-xs text-muted-foreground pl-0.5">
                                    {variant.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </RadioGroup>
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// COMPACT VARIANT (Dropdown statt Radio)
// ══════════════════════════════════════════════════════════════════════════════
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const VariantDropdown = ({
    groupId,
    selectedVariantId,
    onSelect,
    disabled = false,
}: Omit<VariantSelectorProps, "compact">) => {
    const [group, setGroup] = useState<VariantGroup | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadGroup = async () => {
            setIsLoading(true);
            const data = await fetchVariantGroup(groupId);
            if (data) {
                setGroup(data);
                if (!selectedVariantId) {
                    const defaultVariant = data.variants.find((v) => v.is_default);
                    if (defaultVariant) {
                        onSelect(defaultVariant.id, defaultVariant.clause_id);
                    }
                }
            }
            setIsLoading(false);
        };
        loadGroup();
    }, [groupId]);

    if (isLoading) {
        return (
            <Select disabled>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Laden..." />
                </SelectTrigger>
            </Select>
        );
    }

    if (!group || group.variants.length === 0) {
        return null;
    }

    const activeVariants = group.variants
        .filter((v) => v.is_active)
        .sort((a, b) => a.sort_order - b.sort_order);

    return (
        <Select
            value={selectedVariantId?.toString()}
            onValueChange={(value) => {
                const variant = activeVariants.find((v) => v.id.toString() === value);
                if (variant) {
                    onSelect(variant.id, variant.clause_id);
                }
            }}
            disabled={disabled}
        >
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Variante wählen..." />
            </SelectTrigger>
            <SelectContent>
                {activeVariants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id.toString()}>
                        <div className="flex items-center gap-2">
                            {variant.variant_code && (
                                <span className="font-mono text-xs text-muted-foreground">
                                    [{variant.variant_code}]
                                </span>
                            )}
                            <span>{variant.variant_name}</span>
                            {variant.is_default && (
                                <Star className="w-3 h-3 text-amber-500 fill-current" />
                            )}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

export default VariantSelector;
