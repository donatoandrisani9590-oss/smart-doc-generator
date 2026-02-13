/**
 * StationeryPicker - Briefpapier-Auswahl Dropdown
 *
 * Ermöglicht die Auswahl eines Blanko-Briefpapier-Templates
 * im LeftControlPanel. Unterstützt Auto-Suggest basierend auf
 * dem Ländercode des Dokumenttyps.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stamp, ChevronDown, X, Star } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { apiFetch } from "@/lib/api-client";

interface StationeryOption {
    id: number;
    name: string;
    country_code: string | null;
    thumbnail_url: string | null;
    is_default: boolean;
    has_logo: boolean;
}

interface StationeryPickerProps {
    value: number | null;
    onChange: (id: number | null) => void;
    countryCode?: string;
}

export const StationeryPicker = ({
    value,
    onChange,
    countryCode,
}: StationeryPickerProps) => {
    const [options, setOptions] = useState<StationeryOption[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Briefpapier-Vorlagen laden
    const fetchOptions = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiFetch(
                "/api/v1/user-templates?template_type=stationery"
            );
            if (response.ok) {
                const data = await response.json();
                setOptions(data.items || []);
            }
        } catch {
            // Briefpapier ist optional
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    // Auto-Suggest basierend auf Ländercode
    useEffect(() => {
        if (value === null && countryCode && options.length > 0) {
            const autoSuggest = async () => {
                try {
                    const res = await apiFetch(
                        `/api/v1/user-templates/suggest?country_code=${countryCode}`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data?.template?.id) {
                            onChange(data.template.id);
                        }
                    }
                } catch {
                    // ignorieren
                }
            };
            autoSuggest();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countryCode, options.length]);

    const selectedOption = options.find((o) => o.id === value);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Stamp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                    Briefpapier
                </span>
            </div>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-9 text-sm"
                    >
                        {selectedOption ? (
                            <span className="flex items-center gap-2 truncate">
                                {selectedOption.country_code && (
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] px-1 py-0"
                                    >
                                        {selectedOption.country_code}
                                    </Badge>
                                )}
                                {selectedOption.name}
                            </span>
                        ) : (
                            <span className="text-muted-foreground">
                                Kein Briefpapier
                            </span>
                        )}
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-2 shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto">
                        {/* Kein Briefpapier Option */}
                        <button
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-warm-50 transition-colors flex items-center gap-2 ${
                                value === null
                                    ? "bg-primary/5 text-primary font-medium"
                                    : ""
                            }`}
                            onClick={() => {
                                onChange(null);
                                setIsOpen(false);
                            }}
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                            Kein Briefpapier
                        </button>

                        {/* Trennlinie */}
                        <div className="h-px bg-warm-200 mx-2" />

                        {/* Optionen */}
                        {options.map((opt) => (
                            <button
                                key={opt.id}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-warm-50 transition-colors flex items-center gap-2 ${
                                    value === opt.id
                                        ? "bg-primary/5 text-primary font-medium"
                                        : ""
                                }`}
                                onClick={() => {
                                    onChange(opt.id);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.thumbnail_url ? (
                                    <img
                                        src={opt.thumbnail_url}
                                        alt=""
                                        className="w-8 h-10 object-cover rounded border border-warm-200"
                                        onError={(e) => {
                                            // Fallback bei fehlgeschladenem Thumbnail
                                            e.currentTarget.style.display = "none";
                                            e.currentTarget.nextElementSibling?.classList.remove("hidden");
                                        }}
                                    />
                                ) : null}
                                <div className={`w-8 h-10 bg-warm-100 rounded border border-warm-200 flex items-center justify-center ${opt.thumbnail_url ? "hidden" : ""}`}>
                                    <Stamp className="w-3 h-3 text-warm-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className="truncate">{opt.name}</span>
                                        {opt.is_default && (
                                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 shrink-0" />
                                        )}
                                    </div>
                                    {opt.country_code && (
                                        <span className="text-[10px] text-muted-foreground">
                                            {opt.country_code}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))}

                        {options.length === 0 && !loading && (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                Noch kein Briefpapier hochgeladen
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>

            {/* Entfernen-Link wenn ausgewählt */}
            {value && (
                <button
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => onChange(null)}
                >
                    Briefpapier entfernen
                </button>
            )}
        </div>
    );
};

export default StationeryPicker;
