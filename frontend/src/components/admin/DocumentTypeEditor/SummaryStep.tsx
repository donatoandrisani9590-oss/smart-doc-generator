import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    AlertCircle,
    Briefcase,
    GitBranch,
    Layers,
} from "lucide-react";
import { CATEGORIES } from "./constants";
import type { ClauseSelection, VariantGroupSelection } from "./types";

interface SummaryStepProps {
    name: string;
    category: string;
    countryCode: string;
    isActive: boolean;
    defaultProbationMonths: number;
    defaultNoticePeriod: string;
    defaultVacationDays: number;
    defaultWeeklyHours: number;
    selectedClauses: ClauseSelection[];
    selectedVariantGroups: VariantGroupSelection[];
    createError?: string | null;
    updateError?: string | null;
}

export const SummaryStep = ({
    name,
    category,
    countryCode,
    isActive,
    defaultProbationMonths,
    defaultNoticePeriod,
    defaultVacationDays,
    defaultWeeklyHours,
    selectedClauses,
    selectedVariantGroups,
    createError,
    updateError,
}: SummaryStepProps) => {
    return (
        <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Zusammenfassung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">{name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Kategorie</p>
                            <p className="font-medium">
                                {CATEGORIES.find(c => c.value === category)?.label || category}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Land</p>
                            <p className="font-medium">
                                {countryCode === "DE" ? "Deutschland" : "Italien"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Status</p>
                            <p className={cn(
                                "font-medium",
                                isActive ? "text-green-600" : "text-muted-foreground"
                            )}>
                                {isActive ? "Aktiv" : "Inaktiv"}
                            </p>
                        </div>
                    </div>

                    {/* Default values summary */}
                    <div className="border-t pt-4 mt-4">
                        <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            Standardwerte
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm bg-blue-50 p-3 rounded-lg">
                            <div>
                                <span className="text-muted-foreground">Probezeit:</span>{" "}
                                <span className="font-medium">
                                    {defaultProbationMonths === 0 ? "Keine" : `${defaultProbationMonths} Monate`}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">K{"\u00fc"}ndigungsfrist:</span>{" "}
                                <span className="font-medium">{defaultNoticePeriod}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Urlaubstage:</span>{" "}
                                <span className="font-medium">{defaultVacationDays} Tage</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Wochenstunden:</span>{" "}
                                <span className="font-medium">{defaultWeeklyHours}h</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-4">
                        <p className="text-sm text-muted-foreground mb-2">
                            Klauseln ({selectedClauses.length})
                        </p>
                        <div className="space-y-2">
                            {selectedClauses.map((sc) => (
                                <div
                                    key={sc.clause_id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                                        {sc.display_order}
                                    </span>
                                    <span className="flex-1">
                                        {sc.clause?.title || `Klausel ${sc.clause_id}`}
                                    </span>
                                    <span className={cn(
                                        "text-xs px-2 py-0.5 rounded",
                                        sc.is_mandatory
                                            ? "bg-secondary/20 text-secondary"
                                            : "bg-warm-100 text-muted-foreground"
                                    )}>
                                        {sc.is_mandatory ? "Pflicht" : "Optional"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Variant Groups Summary */}
                    {selectedVariantGroups.length > 0 && (
                        <div className="border-t pt-4">
                            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                                <GitBranch className="w-4 h-4 text-purple-600" />
                                Varianten-Gruppen ({selectedVariantGroups.length})
                            </p>
                            <div className="space-y-2 bg-purple-50 p-3 rounded-lg">
                                {selectedVariantGroups.map((vg) => (
                                    <div
                                        key={vg.variant_group_id}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Layers className="w-4 h-4 text-purple-600" />
                                        <span className="flex-1 font-medium">
                                            {vg.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {vg.variant_count || vg.variants?.length || 0} Varianten
                                        </span>
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded",
                                            vg.is_mandatory
                                                ? "bg-purple-200 text-purple-700"
                                                : "bg-warm-100 text-muted-foreground"
                                        )}>
                                            {vg.is_mandatory ? "Pflicht" : "Optional"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {(createError || updateError) && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {createError || updateError}
                </div>
            )}
        </motion.div>
    );
};
