/**
 * ConditionTester - Erweitertes Test-Tool fuer bedingte Klauseln
 *
 * Features:
 * - Simulations-Mode mit editierbaren Test-Daten
 * - Formular zum Eingeben von Testwerten
 * - Live-Ergebnis: Bedingung erfuellt / Nicht erfuellt
 * - Highlighting welcher Teil der Bedingung true/false ist
 * - "Test mit aktuellen Daten" Button
 * - Clause-Aktivitaets-Simulation
 * - Variant-Auswahl-Simulation
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    CheckCircle2,
    XCircle,
    Play,
    RotateCcw,
    FlaskConical,
    ChevronRight,
    ChevronDown,
    FileText,
    ToggleLeft,
    Layers,
    Info,
    Sparkles,
    ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES (imported from ConditionBuilder pattern)
// ============================================================================

export type ConditionKind = "field" | "clause_active" | "variant_selected";

export interface ClauseReference {
    id: number;
    title: string;
}

export interface VariantReference {
    id: number;
    title: string;
    clauseId: number;
    clauseTitle?: string;
}

export interface SimpleCondition {
    type: "simple";
    id: string;
    conditionKind?: ConditionKind;
    field: string;
    clauseId?: number;
    variantId?: number;
    operator: string;
    value: string | number | boolean;
}

export interface ConditionGroup {
    type: "group";
    id: string;
    logic: "and" | "or";
    conditions: (SimpleCondition | ConditionGroup)[];
}

export type ClauseCondition = SimpleCondition | ConditionGroup | null;

export interface FieldDefinition {
    name: string;
    label: string;
    type: "number" | "text" | "boolean" | "select" | "date";
    category: string;
    description?: string;
    options?: string[];
    unit?: string;
}

// ============================================================================
// TEST DATA TYPES
// ============================================================================

export interface TestValues {
    [fieldName: string]: string | number | boolean;
}

export interface ClauseTestState {
    [clauseId: number]: boolean;
}

export interface VariantTestState {
    [variantId: number]: boolean;
}

export interface ConditionEvaluationResult {
    result: boolean;
    details: EvaluationDetail[];
}

export interface EvaluationDetail {
    conditionId: string;
    conditionType: "simple" | "group";
    result: boolean;
    description: string;
    children?: EvaluationDetail[];
}

// ============================================================================
// PROPS
// ============================================================================

export interface ConditionTesterProps {
    /** The condition to test */
    condition: ClauseCondition;
    /** Available field definitions */
    availableFields: FieldDefinition[];
    /** Available clauses for clause_active conditions */
    availableClauses?: ClauseReference[];
    /** Available variants for variant_selected conditions */
    availableVariants?: VariantReference[];
    /** Current form data (for "Test with current data" feature) */
    currentFormData?: Record<string, unknown>;
    /** Current active clauses (for "Test with current data" feature) */
    currentActiveClauses?: number[];
    /** Current selected variants (for "Test with current data" feature) */
    currentSelectedVariants?: number[];
    /** Whether the dialog is open */
    open?: boolean;
    /** Callback when dialog closes */
    onOpenChange?: (open: boolean) => void;
    /** Callback when test is run */
    onTestResult?: (result: boolean, details: EvaluationDetail[]) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all field names used in a condition
 */
const getConditionFields = (condition: ClauseCondition): string[] => {
    if (!condition) return [];

    if (condition.type === "simple") {
        return condition.conditionKind === "field" && condition.field ? [condition.field] : [];
    }

    const fields = new Set<string>();
    condition.conditions.forEach((c) => {
        getConditionFields(c).forEach((f) => fields.add(f));
    });
    return Array.from(fields);
};

/**
 * Get all clause IDs used in a condition
 */
const getConditionClauses = (condition: ClauseCondition): number[] => {
    if (!condition) return [];

    if (condition.type === "simple") {
        return condition.conditionKind === "clause_active" && condition.clauseId
            ? [condition.clauseId]
            : [];
    }

    const clauses = new Set<number>();
    condition.conditions.forEach((c) => {
        getConditionClauses(c).forEach((id) => clauses.add(id));
    });
    return Array.from(clauses);
};

/**
 * Get all variant IDs used in a condition
 */
const getConditionVariants = (condition: ClauseCondition): number[] => {
    if (!condition) return [];

    if (condition.type === "simple") {
        return condition.conditionKind === "variant_selected" && condition.variantId
            ? [condition.variantId]
            : [];
    }

    const variants = new Set<number>();
    condition.conditions.forEach((c) => {
        getConditionVariants(c).forEach((id) => variants.add(id));
    });
    return Array.from(variants);
};

/**
 * Get field info from field definitions
 */
const getFieldInfo = (fieldName: string, fields: FieldDefinition[]): FieldDefinition | undefined => {
    return fields.find((f) => f.name === fieldName);
};

// Note: groupFieldsByCategory is available if needed for future field grouping UI
// Currently not used but kept for potential feature extension

/**
 * Evaluate a single simple condition
 */
const evaluateSimpleCondition = (
    condition: SimpleCondition,
    testValues: TestValues,
    activeClauseIds: number[],
    selectedVariantIds: number[]
): boolean => {
    const kind = condition.conditionKind || "field";

    // Handle clause_active conditions
    if (kind === "clause_active" && condition.clauseId !== undefined) {
        const isActive = activeClauseIds.includes(condition.clauseId);
        const expectedActive = condition.value === true;
        return condition.operator === "==" ? isActive === expectedActive : isActive !== expectedActive;
    }

    // Handle variant_selected conditions
    if (kind === "variant_selected" && condition.variantId !== undefined) {
        const isSelected = selectedVariantIds.includes(condition.variantId);
        const expectedSelected = condition.value === true;
        return condition.operator === "==" ? isSelected === expectedSelected : isSelected !== expectedSelected;
    }

    // Handle field conditions
    const fieldValue = testValues[condition.field];
    const conditionValue = condition.value;

    if (fieldValue === undefined) return false;

    switch (condition.operator) {
        case "==":
            return fieldValue === conditionValue;
        case "!=":
            return fieldValue !== conditionValue;
        case ">":
            return Number(fieldValue) > Number(conditionValue);
        case ">=":
            return Number(fieldValue) >= Number(conditionValue);
        case "<":
            return Number(fieldValue) < Number(conditionValue);
        case "<=":
            return Number(fieldValue) <= Number(conditionValue);
        case "contains":
            return String(fieldValue).toLowerCase().includes(String(conditionValue).toLowerCase());
        case "startsWith":
            return String(fieldValue).toLowerCase().startsWith(String(conditionValue).toLowerCase());
        case "endsWith":
            return String(fieldValue).toLowerCase().endsWith(String(conditionValue).toLowerCase());
        case "isEmpty":
            return fieldValue === "" || fieldValue === null || fieldValue === undefined;
        case "isNotEmpty":
            return fieldValue !== "" && fieldValue !== null && fieldValue !== undefined;
        case "between": {
            const parts = String(conditionValue).split("-");
            if (parts.length !== 2) return false;
            const min = Number(parts[0]);
            const max = Number(parts[1]);
            if (isNaN(min) || isNaN(max)) return false;
            const numValue = Number(fieldValue);
            return numValue >= min && numValue <= max;
        }
        default:
            return false;
    }
};

/**
 * Evaluate a condition with detailed results
 */
const evaluateConditionWithDetails = (
    condition: ClauseCondition,
    testValues: TestValues,
    activeClauseIds: number[],
    selectedVariantIds: number[],
    fields: FieldDefinition[],
    clauses: ClauseReference[],
    variants: VariantReference[]
): ConditionEvaluationResult => {
    if (!condition) {
        return { result: true, details: [] };
    }

    const evaluateWithDetail = (
        cond: SimpleCondition | ConditionGroup
    ): EvaluationDetail => {
        if (cond.type === "simple") {
            const result = evaluateSimpleCondition(cond, testValues, activeClauseIds, selectedVariantIds);
            const description = getConditionDescription(cond, fields, clauses, variants);
            return {
                conditionId: cond.id,
                conditionType: "simple",
                result,
                description,
            };
        }

        // Group condition
        const childResults = cond.conditions.map(evaluateWithDetail);
        const groupResult = cond.logic === "and"
            ? childResults.every((r) => r.result)
            : childResults.some((r) => r.result);

        return {
            conditionId: cond.id,
            conditionType: "group",
            result: groupResult,
            description: cond.logic === "and" ? "UND-Gruppe" : "ODER-Gruppe",
            children: childResults,
        };
    };

    const rootDetail = evaluateWithDetail(condition);
    return {
        result: rootDetail.result,
        details: rootDetail.conditionType === "group" ? rootDetail.children || [] : [rootDetail],
    };
};

/**
 * Get human-readable description of a condition
 */
const getConditionDescription = (
    condition: SimpleCondition,
    fields: FieldDefinition[],
    clauses: ClauseReference[],
    variants: VariantReference[]
): string => {
    const kind = condition.conditionKind || "field";

    if (kind === "clause_active" && condition.clauseId) {
        const clause = clauses.find((c) => c.id === condition.clauseId);
        const clauseName = clause?.title || `Klausel #${condition.clauseId}`;
        const isActive = condition.value === true;
        return `Klausel "${clauseName}" ist ${isActive ? "aktiv" : "inaktiv"}`;
    }

    if (kind === "variant_selected" && condition.variantId) {
        const variant = variants.find((v) => v.id === condition.variantId);
        const variantName = variant?.title || `Variante #${condition.variantId}`;
        const isSelected = condition.value === true;
        return `Variante "${variantName}" ist ${isSelected ? "gewaehlt" : "nicht gewaehlt"}`;
    }

    const field = fields.find((f) => f.name === condition.field);
    const fieldLabel = field?.label || condition.field;
    const operatorLabels: Record<string, string> = {
        "==": "ist gleich",
        "!=": "ist nicht gleich",
        ">": "ist groesser als",
        ">=": "ist mindestens",
        "<": "ist kleiner als",
        "<=": "ist hoechstens",
        "contains": "enthaelt",
        "startsWith": "beginnt mit",
        "endsWith": "endet mit",
        "isEmpty": "ist leer",
        "isNotEmpty": "ist ausgefuellt",
        "between": "liegt zwischen",
    };

    const operatorLabel = operatorLabels[condition.operator] || condition.operator;

    if (condition.operator === "isEmpty" || condition.operator === "isNotEmpty") {
        return `"${fieldLabel}" ${operatorLabel}`;
    }

    let valueDisplay: string;
    if (typeof condition.value === "boolean") {
        valueDisplay = condition.value ? "Ja" : "Nein";
    } else if (typeof condition.value === "number") {
        valueDisplay = condition.value.toLocaleString("de-DE");
        if (field?.unit) valueDisplay += ` ${field.unit}`;
    } else {
        valueDisplay = String(condition.value);
    }

    return `"${fieldLabel}" ${operatorLabel} ${valueDisplay}`;
};

// ============================================================================
// EVALUATION RESULT DISPLAY COMPONENT
// ============================================================================

interface EvaluationResultDisplayProps {
    detail: EvaluationDetail;
    depth?: number;
}

const EvaluationResultDisplay = ({ detail, depth = 0 }: EvaluationResultDisplayProps) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = detail.children && detail.children.length > 0;

    return (
        <div className={cn("space-y-1", depth > 0 && "ml-4 pl-4 border-l-2 border-muted")}>
            <div
                className={cn(
                    "flex items-center gap-2 p-2 rounded-md transition-colors",
                    detail.result
                        ? "bg-green-50 dark:bg-green-950/30"
                        : "bg-red-50 dark:bg-red-950/30"
                )}
            >
                {hasChildren && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </Button>
                )}
                {!hasChildren && <div className="w-5" />}

                {detail.result ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}

                <span
                    className={cn(
                        "text-sm font-medium",
                        detail.result
                            ? "text-green-800 dark:text-green-200"
                            : "text-red-800 dark:text-red-200"
                    )}
                >
                    {detail.description}
                </span>

                <Badge
                    variant="outline"
                    className={cn(
                        "ml-auto text-xs",
                        detail.result
                            ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-300"
                            : "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300"
                    )}
                >
                    {detail.result ? "WAHR" : "FALSCH"}
                </Badge>
            </div>

            {hasChildren && isExpanded && (
                <div className="space-y-1">
                    {detail.children?.map((child) => (
                        <EvaluationResultDisplay key={child.conditionId} detail={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ConditionTester = ({
    condition,
    availableFields,
    availableClauses = [],
    availableVariants = [],
    currentFormData,
    currentActiveClauses,
    currentSelectedVariants,
    open,
    onOpenChange,
    onTestResult,
}: ConditionTesterProps) => {
    // Get used fields, clauses, and variants from condition
    const usedFields = useMemo(() => getConditionFields(condition), [condition]);
    const usedClauses = useMemo(() => getConditionClauses(condition), [condition]);
    const usedVariants = useMemo(() => getConditionVariants(condition), [condition]);

    // Helper to create initial values
    const createInitialTestValues = useCallback((fields: string[]): TestValues => {
        const values: TestValues = {};
        fields.forEach((fieldName) => {
            const field = getFieldInfo(fieldName, availableFields);
            if (field) {
                if (field.type === "boolean") values[fieldName] = false;
                else if (field.type === "number") values[fieldName] = 0;
                else values[fieldName] = "";
            }
        });
        return values;
    }, [availableFields]);

    const createInitialClauseStates = useCallback((clauseIds: number[]): ClauseTestState => {
        const states: ClauseTestState = {};
        clauseIds.forEach((clauseId) => {
            states[clauseId] = false;
        });
        return states;
    }, []);

    const createInitialVariantStates = useCallback((variantIds: number[]): VariantTestState => {
        const states: VariantTestState = {};
        variantIds.forEach((variantId) => {
            states[variantId] = false;
        });
        return states;
    }, []);

    // Test values state - use function initializer
    const [testValues, setTestValues] = useState<TestValues>(() =>
        createInitialTestValues(usedFields)
    );
    const [clauseStates, setClauseStates] = useState<ClauseTestState>(() =>
        createInitialClauseStates(usedClauses)
    );
    const [variantStates, setVariantStates] = useState<VariantTestState>(() =>
        createInitialVariantStates(usedVariants)
    );

    // Result state
    const [evaluationResult, setEvaluationResult] = useState<ConditionEvaluationResult | null>(null);
    const [activeTab, setActiveTab] = useState<string>("fields");

    // Track condition identity for reset - use a stable key
    const conditionKey = useMemo(() => JSON.stringify(condition), [condition]);
    const prevConditionKeyRef = useRef(conditionKey);

    // Reset when condition changes significantly
    useEffect(() => {
        if (conditionKey !== prevConditionKeyRef.current) {
            prevConditionKeyRef.current = conditionKey;
            // Schedule reset after render
            const timer = setTimeout(() => {
                setTestValues(createInitialTestValues(usedFields));
                setClauseStates(createInitialClauseStates(usedClauses));
                setVariantStates(createInitialVariantStates(usedVariants));
                setEvaluationResult(null);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [conditionKey, usedFields, usedClauses, usedVariants, createInitialTestValues, createInitialClauseStates, createInitialVariantStates]);

    // Run test
    const handleTest = useCallback(() => {
        const activeClauseIds = Object.entries(clauseStates)
            .filter(([, active]) => active)
            .map(([id]) => parseInt(id, 10));

        const selectedVariantIds = Object.entries(variantStates)
            .filter(([, selected]) => selected)
            .map(([id]) => parseInt(id, 10));

        const result = evaluateConditionWithDetails(
            condition,
            testValues,
            activeClauseIds,
            selectedVariantIds,
            availableFields,
            availableClauses,
            availableVariants
        );

        setEvaluationResult(result);
        onTestResult?.(result.result, result.details);
    }, [condition, testValues, clauseStates, variantStates, availableFields, availableClauses, availableVariants, onTestResult]);

    // Load current data
    const handleLoadCurrentData = useCallback(() => {
        if (currentFormData) {
            const newValues: TestValues = {};
            usedFields.forEach((fieldName) => {
                if (fieldName in currentFormData) {
                    newValues[fieldName] = currentFormData[fieldName] as string | number | boolean;
                } else {
                    const field = getFieldInfo(fieldName, availableFields);
                    if (field) {
                        if (field.type === "boolean") newValues[fieldName] = false;
                        else if (field.type === "number") newValues[fieldName] = 0;
                        else newValues[fieldName] = "";
                    }
                }
            });
            setTestValues(newValues);
        }

        if (currentActiveClauses) {
            const newClauseStates: ClauseTestState = {};
            usedClauses.forEach((clauseId) => {
                newClauseStates[clauseId] = currentActiveClauses.includes(clauseId);
            });
            setClauseStates(newClauseStates);
        }

        if (currentSelectedVariants) {
            const newVariantStates: VariantTestState = {};
            usedVariants.forEach((variantId) => {
                newVariantStates[variantId] = currentSelectedVariants.includes(variantId);
            });
            setVariantStates(newVariantStates);
        }

        setEvaluationResult(null);
    }, [currentFormData, currentActiveClauses, currentSelectedVariants, usedFields, usedClauses, usedVariants, availableFields]);

    // Reset values
    const handleReset = useCallback(() => {
        const initialValues: TestValues = {};
        usedFields.forEach((fieldName) => {
            const field = getFieldInfo(fieldName, availableFields);
            if (field) {
                if (field.type === "boolean") initialValues[fieldName] = false;
                else if (field.type === "number") initialValues[fieldName] = 0;
                else initialValues[fieldName] = "";
            }
        });
        setTestValues(initialValues);

        const initialClauseStates: ClauseTestState = {};
        usedClauses.forEach((clauseId) => {
            initialClauseStates[clauseId] = false;
        });
        setClauseStates(initialClauseStates);

        const initialVariantStates: VariantTestState = {};
        usedVariants.forEach((variantId) => {
            initialVariantStates[variantId] = false;
        });
        setVariantStates(initialVariantStates);

        setEvaluationResult(null);
    }, [usedFields, usedClauses, usedVariants, availableFields]);

    // Handle field value change
    const handleValueChange = useCallback((fieldName: string, value: string | number | boolean) => {
        setTestValues((prev) => ({ ...prev, [fieldName]: value }));
        setEvaluationResult(null);
    }, []);

    // Handle clause state change
    const handleClauseChange = useCallback((clauseId: number, active: boolean) => {
        setClauseStates((prev) => ({ ...prev, [clauseId]: active }));
        setEvaluationResult(null);
    }, []);

    // Handle variant state change
    const handleVariantChange = useCallback((variantId: number, selected: boolean) => {
        setVariantStates((prev) => ({ ...prev, [variantId]: selected }));
        setEvaluationResult(null);
    }, []);

    // Check if there's anything to test
    const hasTestableConditions = usedFields.length > 0 || usedClauses.length > 0 || usedVariants.length > 0;
    const hasCurrentData = currentFormData || currentActiveClauses || currentSelectedVariants;

    // Content for standalone usage
    const content = (
        <div className="space-y-4">
            {/* Info */}
            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                    Geben Sie Testwerte ein und klicken Sie auf "Testen", um zu pruefen, ob die Bedingung erfuellt wird.
                    Das Ergebnis zeigt an, welche Teile der Bedingung wahr oder falsch sind.
                </p>
            </div>

            {!hasTestableConditions ? (
                <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Keine testbaren Bedingungen</p>
                    <p className="text-sm">Diese Bedingung enthaelt keine Felder, Klauseln oder Varianten zum Testen.</p>
                </div>
            ) : (
                <>
                    {/* Tabs for different condition types */}
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="fields" disabled={usedFields.length === 0}>
                                <FileText className="h-4 w-4 mr-2" />
                                Felder ({usedFields.length})
                            </TabsTrigger>
                            <TabsTrigger value="clauses" disabled={usedClauses.length === 0}>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Klauseln ({usedClauses.length})
                            </TabsTrigger>
                            <TabsTrigger value="variants" disabled={usedVariants.length === 0}>
                                <Layers className="h-4 w-4 mr-2" />
                                Varianten ({usedVariants.length})
                            </TabsTrigger>
                        </TabsList>

                        {/* Fields Tab */}
                        <TabsContent value="fields" className="mt-4">
                            <ScrollArea className="max-h-[250px]">
                                <div className="space-y-3 pr-4">
                                    {usedFields.map((fieldName) => {
                                        const field = getFieldInfo(fieldName, availableFields);
                                        if (!field) return null;

                                        return (
                                            <div key={fieldName} className="flex items-center gap-3">
                                                <Label className="w-1/3 text-sm truncate" title={field.description}>
                                                    {field.label}
                                                    {field.unit && (
                                                        <span className="text-muted-foreground ml-1">({field.unit})</span>
                                                    )}
                                                </Label>
                                                <div className="flex-1">
                                                    {field.type === "boolean" ? (
                                                        <Select
                                                            value={testValues[fieldName] === true ? "true" : "false"}
                                                            onValueChange={(v) => handleValueChange(fieldName, v === "true")}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="true">
                                                                    <div className="flex items-center gap-2">
                                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                        Ja
                                                                    </div>
                                                                </SelectItem>
                                                                <SelectItem value="false">
                                                                    <div className="flex items-center gap-2">
                                                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                                                        Nein
                                                                    </div>
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : field.type === "select" ? (
                                                        <Select
                                                            value={String(testValues[fieldName] || "")}
                                                            onValueChange={(v) => handleValueChange(fieldName, v)}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Waehlen..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {field.options?.map((opt) => (
                                                                    <SelectItem key={opt} value={opt}>
                                                                        {opt}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : field.type === "number" ? (
                                                        <Input
                                                            type="number"
                                                            value={testValues[fieldName] as number}
                                                            onChange={(e) => handleValueChange(fieldName, Number(e.target.value))}
                                                            placeholder="0"
                                                        />
                                                    ) : (
                                                        <Input
                                                            type="text"
                                                            value={testValues[fieldName] as string}
                                                            onChange={(e) => handleValueChange(fieldName, e.target.value)}
                                                            placeholder="..."
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {usedFields.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            Keine Feldwerte in dieser Bedingung verwendet.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Clauses Tab */}
                        <TabsContent value="clauses" className="mt-4">
                            <ScrollArea className="max-h-[250px]">
                                <div className="space-y-3 pr-4">
                                    {usedClauses.map((clauseId) => {
                                        const clause = availableClauses.find((c) => c.id === clauseId);
                                        return (
                                            <div key={clauseId} className="flex items-center justify-between p-2 rounded-md border">
                                                <div className="flex items-center gap-2">
                                                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm">
                                                        {clause?.title || `Klausel #${clauseId}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">
                                                        {clauseStates[clauseId] ? "Aktiv" : "Inaktiv"}
                                                    </Label>
                                                    <Switch
                                                        checked={clauseStates[clauseId] || false}
                                                        onCheckedChange={(checked) => handleClauseChange(clauseId, checked)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {usedClauses.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            Keine Klausel-Aktivitaet in dieser Bedingung verwendet.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Variants Tab */}
                        <TabsContent value="variants" className="mt-4">
                            <ScrollArea className="max-h-[250px]">
                                <div className="space-y-3 pr-4">
                                    {usedVariants.map((variantId) => {
                                        const variant = availableVariants.find((v) => v.id === variantId);
                                        return (
                                            <div key={variantId} className="flex items-center justify-between p-2 rounded-md border">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <span className="text-sm">
                                                            {variant?.title || `Variante #${variantId}`}
                                                        </span>
                                                        {variant?.clauseTitle && (
                                                            <span className="text-xs text-muted-foreground ml-2">
                                                                ({variant.clauseTitle})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">
                                                        {variantStates[variantId] ? "Gewaehlt" : "Nicht gewaehlt"}
                                                    </Label>
                                                    <Switch
                                                        checked={variantStates[variantId] || false}
                                                        onCheckedChange={(checked) => handleVariantChange(variantId, checked)}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {usedVariants.length === 0 && (
                                        <p className="text-center text-muted-foreground py-4">
                                            Keine Varianten-Auswahl in dieser Bedingung verwendet.
                                        </p>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>

                    <Separator />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Zuruecksetzen
                        </Button>

                        {hasCurrentData && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="sm" onClick={handleLoadCurrentData}>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Aktuelle Daten laden
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        Uebernimmt die aktuellen Formularwerte fuer den Test
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        <div className="flex-1" />

                        <Button onClick={handleTest}>
                            <Play className="h-4 w-4 mr-2" />
                            Testen
                        </Button>
                    </div>

                    {/* Result */}
                    {evaluationResult && (
                        <div className="space-y-3">
                            <Separator />

                            {/* Overall Result */}
                            <div
                                className={cn(
                                    "p-4 rounded-lg border-2 flex items-center gap-3",
                                    evaluationResult.result
                                        ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                                        : "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
                                )}
                            >
                                {evaluationResult.result ? (
                                    <>
                                        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                                        <div>
                                            <p className="font-semibold text-green-800 dark:text-green-200">
                                                Bedingung erfuellt!
                                            </p>
                                            <p className="text-sm text-green-700 dark:text-green-300">
                                                Die Klausel wird mit diesen Werten angezeigt.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                                        <div>
                                            <p className="font-semibold text-red-800 dark:text-red-200">
                                                Bedingung nicht erfuellt
                                            </p>
                                            <p className="text-sm text-red-700 dark:text-red-300">
                                                Die Klausel wird mit diesen Werten ausgeblendet.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Detailed Results */}
                            {evaluationResult.details.length > 0 && (
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <ArrowRight className="h-4 w-4" />
                                            Detaillierte Auswertung
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <ScrollArea className="max-h-[200px]">
                                            <div className="space-y-1">
                                                {evaluationResult.details.map((detail) => (
                                                    <EvaluationResultDisplay key={detail.conditionId} detail={detail} />
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // If open/onOpenChange provided, wrap in Dialog
    if (open !== undefined && onOpenChange) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FlaskConical className="h-5 w-5" />
                            Bedingung testen
                        </DialogTitle>
                        <DialogDescription>
                            Simulieren Sie verschiedene Szenarien, um zu pruefen, wann die Klausel angezeigt wird.
                        </DialogDescription>
                    </DialogHeader>
                    {content}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Schliessen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    // Standalone usage
    return content;
};

export default ConditionTester;
