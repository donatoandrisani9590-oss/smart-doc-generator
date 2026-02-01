/**
 * ConditionBuilder - Visual Condition Editor für Klauseln
 *
 * Ein grafisches Tool, mit dem HR-Mitarbeiter bedingte Logik für Klauseln
 * definieren können, ohne Code oder JSON schreiben zu müssen.
 *
 * Features (Lawlift-Level):
 * - Drag-and-Drop Interface für Bedingungen
 * - AND/OR Logik mit verschachtelten Gruppen (bis 3 Ebenen)
 * - Live-Vorschau in natürlicher Sprache
 * - Kategorisierte Feldauswahl mit Suche
 * - Typbasierte Operatoren und Werteeingabe
 * - Validierung und Fehlermeldungen
 * - Quick-Templates für häufige Bedingungen
 * - Tastatur-Shortcuts
 * - Undo/Redo Funktionalität
 * - Condition Testing/Simulation
 * - Dynamische Felder aus API
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
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    GitBranch,
    Trash2,
    Eye,
    EyeOff,
    Plus,
    GripVertical,
    ChevronDown,
    ChevronRight,
    HelpCircle,
    Layers,
    AlertCircle,
    CheckCircle2,
    Copy,
    Undo2,
    Redo2,
    Zap,
    Search,
    Play,
    Sparkles,
    Keyboard,
    X,
    FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Condition kind - determines what the condition checks */
export type ConditionKind = "field" | "clause_active" | "variant_selected";

/** Reference to a clause for conditions */
export interface ClauseReference {
    id: number;
    title: string;
}

/** Reference to a variant for conditions */
export interface VariantReference {
    id: number;
    title: string;
    clauseId: number;
    clauseTitle?: string;
}

/** Single condition comparing a field with a value */
export interface SimpleCondition {
    type: "simple";
    id: string;
    /** Kind of condition: field comparison, clause activation, or variant selection */
    conditionKind?: ConditionKind;
    /** Field name (for field conditions) */
    field: string;
    /** Clause ID (for clause_active conditions) */
    clauseId?: number;
    /** Variant ID (for variant_selected conditions) */
    variantId?: number;
    operator: string;
    value: string | number | boolean;
}

/** Group of conditions combined with AND or OR */
export interface ConditionGroup {
    type: "group";
    id: string;
    logic: "and" | "or";
    conditions: (SimpleCondition | ConditionGroup)[];
}

/** Root condition type - can be simple, group, or null */
export type ClauseCondition = SimpleCondition | ConditionGroup | null;

/** Legacy format for backward compatibility */
export interface LegacyCondition {
    field: string;
    operator: string;
    value: string | number | boolean;
}

/** Field definition with metadata */
export interface FieldDefinition {
    name: string;
    label: string;
    type: "number" | "text" | "boolean" | "select" | "date";
    category: string;
    description?: string;
    options?: string[];
    unit?: string;
}

/** Operator definition */
interface OperatorDefinition {
    value: string;
    label: string;
    description?: string;
    requiresValue: boolean;
}

/** Quick Template definition */
interface QuickTemplate {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    condition: SimpleCondition | ConditionGroup;
}

/** Test values for simulation */
interface TestValues {
    [fieldName: string]: string | number | boolean;
}

// ============================================================================
// FIELD DEFINITIONS (DEFAULT - can be overridden via props)
// ============================================================================

const DEFAULT_CONDITION_FIELDS: FieldDefinition[] = [
    // Vergütung
    {
        name: "gehalt_brutto",
        label: "Bruttogehalt (jährlich)",
        type: "number",
        category: "Vergütung",
        description: "Jahresbruttgehalt in Euro",
        unit: "€",
    },
    {
        name: "gehalt_brutto_monat",
        label: "Bruttogehalt (monatlich)",
        type: "number",
        category: "Vergütung",
        description: "Monatsbruttgehalt in Euro",
        unit: "€",
    },
    {
        name: "bonus_prozent",
        label: "Bonus in Prozent",
        type: "number",
        category: "Vergütung",
        description: "Variabler Bonus als Prozentsatz vom Gehalt",
        unit: "%",
    },
    {
        name: "bonus_betrag",
        label: "Bonus Betrag",
        type: "number",
        category: "Vergütung",
        description: "Fester Bonusbetrag in Euro",
        unit: "€",
    },
    {
        name: "urlaubstage",
        label: "Urlaubstage",
        type: "number",
        category: "Vergütung",
        description: "Anzahl der Urlaubstage pro Jahr",
        unit: "Tage",
    },

    // Vertrag
    {
        name: "wochenstunden",
        label: "Wochenstunden",
        type: "number",
        category: "Vertrag",
        description: "Vereinbarte Arbeitsstunden pro Woche",
        unit: "Std.",
    },
    {
        name: "probezeit_monate",
        label: "Probezeit (Monate)",
        type: "number",
        category: "Vertrag",
        description: "Dauer der Probezeit in Monaten",
        unit: "Monate",
    },
    {
        name: "befristet",
        label: "Befristeter Vertrag",
        type: "boolean",
        category: "Vertrag",
        description: "Ist der Arbeitsvertrag befristet?",
    },
    {
        name: "position",
        label: "Position",
        type: "text",
        category: "Vertrag",
        description: "Stellenbezeichnung des Mitarbeiters",
    },
    {
        name: "abteilung",
        label: "Abteilung",
        type: "text",
        category: "Vertrag",
        description: "Zugehörige Abteilung",
    },
    {
        name: "arbeitsort",
        label: "Arbeitsort",
        type: "text",
        category: "Vertrag",
        description: "Hauptarbeitsort des Mitarbeiters",
    },
    {
        name: "entgeltgruppe",
        label: "Entgeltgruppe",
        type: "select",
        category: "Vertrag",
        description: "Tarifliche Entgeltgruppe",
        options: ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "AT"],
    },
    {
        name: "fuehrungsposition",
        label: "Führungsposition",
        type: "boolean",
        category: "Vertrag",
        description: "Hat der Mitarbeiter Führungsverantwortung?",
    },

    // Benefits (Boolean)
    {
        name: "firmenwagen",
        label: "Firmenwagen",
        type: "boolean",
        category: "Benefits",
        description: "Wird ein Firmenwagen gestellt?",
    },
    {
        name: "homeoffice",
        label: "Homeoffice",
        type: "boolean",
        category: "Benefits",
        description: "Ist Homeoffice vereinbart?",
    },
    {
        name: "jobticket",
        label: "Jobticket",
        type: "boolean",
        category: "Benefits",
        description: "Wird ein Jobticket gestellt?",
    },
    {
        name: "betriebliche_altersvorsorge",
        label: "Betriebliche Altersvorsorge",
        type: "boolean",
        category: "Benefits",
        description: "Ist betriebliche Altersvorsorge vereinbart?",
    },
    {
        name: "vwl",
        label: "Vermögenswirksame Leistungen",
        type: "boolean",
        category: "Benefits",
        description: "Werden VWL gezahlt?",
    },
    {
        name: "diensthandy",
        label: "Diensthandy",
        type: "boolean",
        category: "Benefits",
        description: "Wird ein Diensthandy gestellt?",
    },
    {
        name: "laptop",
        label: "Laptop",
        type: "boolean",
        category: "Benefits",
        description: "Wird ein Laptop gestellt?",
    },

    // Benefits (Values)
    {
        name: "firmenwagen_kategorie",
        label: "Firmenwagen Kategorie",
        type: "select",
        category: "Benefits",
        description: "Kategorie des Firmenwagens",
        options: ["Kompaktklasse", "Mittelklasse", "Oberklasse", "Premium"],
    },
    {
        name: "homeoffice_tage",
        label: "Homeoffice Tage/Woche",
        type: "number",
        category: "Benefits",
        description: "Anzahl der Homeoffice-Tage pro Woche",
        unit: "Tage",
    },
    {
        name: "bav_betrag",
        label: "BAV Arbeitgeberzuschuss",
        type: "number",
        category: "Benefits",
        description: "Monatlicher AG-Zuschuss zur BAV",
        unit: "€",
    },

    // Sonderfälle
    {
        name: "wettbewerbsverbot",
        label: "Wettbewerbsverbot",
        type: "boolean",
        category: "Sonderklauseln",
        description: "Ist ein nachvertragliches Wettbewerbsverbot vereinbart?",
    },
    {
        name: "geheimhaltung",
        label: "Erweiterte Geheimhaltung",
        type: "boolean",
        category: "Sonderklauseln",
        description: "Sind erweiterte Geheimhaltungspflichten vereinbart?",
    },
    {
        name: "erfindungen",
        label: "Erfindungsklausel",
        type: "boolean",
        category: "Sonderklauseln",
        description: "Sollen Regelungen zu Arbeitnehmererfindungen aufgenommen werden?",
    },
];

// ============================================================================
// OPERATORS
// ============================================================================

const OPERATORS: Record<string, OperatorDefinition[]> = {
    number: [
        { value: "==", label: "ist gleich", requiresValue: true },
        { value: "!=", label: "ist nicht gleich", requiresValue: true },
        { value: ">", label: "ist größer als", requiresValue: true },
        { value: ">=", label: "ist mindestens", requiresValue: true },
        { value: "<", label: "ist kleiner als", requiresValue: true },
        { value: "<=", label: "ist höchstens", requiresValue: true },
        { value: "between", label: "liegt zwischen", description: "z.B. 50000-80000", requiresValue: true },
    ],
    text: [
        { value: "==", label: "ist gleich", requiresValue: true },
        { value: "!=", label: "ist nicht gleich", requiresValue: true },
        { value: "contains", label: "enthält", requiresValue: true },
        { value: "startsWith", label: "beginnt mit", requiresValue: true },
        { value: "endsWith", label: "endet mit", requiresValue: true },
        { value: "isEmpty", label: "ist leer", requiresValue: false },
        { value: "isNotEmpty", label: "ist ausgefüllt", requiresValue: false },
    ],
    boolean: [
        { value: "==", label: "ist", requiresValue: true },
    ],
    select: [
        { value: "==", label: "ist gleich", requiresValue: true },
        { value: "!=", label: "ist nicht gleich", requiresValue: true },
        { value: "in", label: "ist eines von", description: "Mehrfachauswahl", requiresValue: true },
    ],
    date: [
        { value: "==", label: "ist am", requiresValue: true },
        { value: "!=", label: "ist nicht am", requiresValue: true },
        { value: ">", label: "ist nach", requiresValue: true },
        { value: "<", label: "ist vor", requiresValue: true },
        { value: ">=", label: "ist am oder nach", requiresValue: true },
        { value: "<=", label: "ist am oder vor", requiresValue: true },
    ],
};

// ============================================================================
// QUICK TEMPLATES
// ============================================================================

const generateId = (): string => `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const QUICK_TEMPLATES: QuickTemplate[] = [
    {
        id: "firmenwagen",
        name: "Firmenwagen-Klausel",
        description: "Zeige wenn Firmenwagen = Ja",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "simple",
            id: generateId(),
            field: "firmenwagen",
            operator: "==",
            value: true,
        },
    },
    {
        id: "fuehrungskraft",
        name: "Führungskraft",
        description: "Gehalt > 80.000 € UND Führungsposition",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "group",
            id: generateId(),
            logic: "and",
            conditions: [
                { type: "simple", id: generateId(), field: "gehalt_brutto", operator: ">", value: 80000 },
                { type: "simple", id: generateId(), field: "fuehrungsposition", operator: "==", value: true },
            ],
        },
    },
    {
        id: "homeoffice",
        name: "Homeoffice-Regelung",
        description: "Zeige wenn Homeoffice vereinbart",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "simple",
            id: generateId(),
            field: "homeoffice",
            operator: "==",
            value: true,
        },
    },
    {
        id: "befristet",
        name: "Befristungsklausel",
        description: "Zeige bei befristeten Verträgen",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "simple",
            id: generateId(),
            field: "befristet",
            operator: "==",
            value: true,
        },
    },
    {
        id: "wettbewerb_gehalt",
        name: "Wettbewerbsverbot (qualifiziert)",
        description: "Wettbewerbsverbot UND Gehalt > 100.000 €",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "group",
            id: generateId(),
            logic: "and",
            conditions: [
                { type: "simple", id: generateId(), field: "wettbewerbsverbot", operator: "==", value: true },
                { type: "simple", id: generateId(), field: "gehalt_brutto", operator: ">", value: 100000 },
            ],
        },
    },
    {
        id: "at_mitarbeiter",
        name: "AT-Mitarbeiter",
        description: "Entgeltgruppe = AT",
        icon: <Sparkles className="w-4 h-4" />,
        condition: {
            type: "simple",
            id: generateId(),
            field: "entgeltgruppe",
            operator: "==",
            value: "AT",
        },
    },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getFieldInfo = (fieldName: string, fields: FieldDefinition[]): FieldDefinition | undefined => {
    return fields.find((f) => f.name === fieldName);
};

const getFieldType = (fieldName: string, fields: FieldDefinition[]): string => {
    return getFieldInfo(fieldName, fields)?.type || "text";
};

const getOperatorsForField = (fieldName: string, fields: FieldDefinition[]): OperatorDefinition[] => {
    const fieldType = getFieldType(fieldName, fields);
    return OPERATORS[fieldType] || OPERATORS.text;
};

const groupFieldsByCategory = (fields: FieldDefinition[]): Record<string, FieldDefinition[]> => {
    return fields.reduce((acc, field) => {
        if (!acc[field.category]) acc[field.category] = [];
        acc[field.category].push(field);
        return acc;
    }, {} as Record<string, FieldDefinition[]>);
};

/** Create an empty simple condition */
const createEmptyCondition = (): SimpleCondition => ({
    type: "simple",
    id: generateId(),
    field: "",
    operator: "",
    value: "",
});

/** Create an empty condition group */
const createEmptyGroup = (logic: "and" | "or" = "and"): ConditionGroup => ({
    type: "group",
    id: generateId(),
    logic,
    conditions: [createEmptyCondition()],
});

/** Deep clone a condition with new IDs */
const cloneConditionWithNewIds = (condition: SimpleCondition | ConditionGroup): SimpleCondition | ConditionGroup => {
    if (condition.type === "simple") {
        return { ...condition, id: generateId() };
    }
    return {
        ...condition,
        id: generateId(),
        conditions: condition.conditions.map(cloneConditionWithNewIds),
    };
};

// ============================================================================
// CONDITION TO NATURAL LANGUAGE
// ============================================================================

interface NaturalLanguageOptions {
    fields: FieldDefinition[];
    clauses?: ClauseReference[];
    variants?: VariantReference[];
}

const conditionToNaturalLanguage = (
    condition: ClauseCondition,
    options: NaturalLanguageOptions | FieldDefinition[],
    depth: number = 0
): string => {
    // Handle backwards compatibility - if options is an array, it's the old fields array
    const { fields, clauses = [], variants = [] } = Array.isArray(options)
        ? { fields: options, clauses: [], variants: [] }
        : options;

    if (!condition) return "";

    if (condition.type === "simple") {
        const conditionKind = condition.conditionKind || "field";

        // Handle clause_active conditions
        if (conditionKind === "clause_active" && condition.clauseId) {
            const clause = clauses.find(c => c.id === condition.clauseId);
            const clauseName = clause?.title || `Klausel #${condition.clauseId}`;
            const isActive = condition.value === true;
            const operatorNot = condition.operator === "!=" ? "nicht " : "";
            return `Klausel „${clauseName}" ist ${operatorNot}${isActive ? "aktiv" : "inaktiv"}`;
        }

        // Handle variant_selected conditions
        if (conditionKind === "variant_selected" && condition.variantId) {
            const variant = variants.find(v => v.id === condition.variantId);
            const variantName = variant?.title || `Variante #${condition.variantId}`;
            const isSelected = condition.value === true;
            const operatorNot = condition.operator === "!=" ? "nicht " : "";
            return `Variante „${variantName}" ist ${operatorNot}${isSelected ? "gewählt" : "nicht gewählt"}`;
        }

        // Handle field conditions (default)
        const field = getFieldInfo(condition.field, fields);
        const operators = getOperatorsForField(condition.field, fields);
        const operator = operators.find((o) => o.value === condition.operator);

        if (!field || !operator) return "";

        // Handle operators that don't require a value
        if (!operator.requiresValue) {
            return `„${field.label}" ${operator.label}`;
        }

        // Format the value
        let displayValue: string;
        if (field.type === "boolean") {
            displayValue = condition.value === true ? "Ja" : "Nein";
        } else if (field.type === "number" && typeof condition.value === "number") {
            displayValue = condition.value.toLocaleString("de-DE");
            if (field.unit) displayValue += ` ${field.unit}`;
        } else {
            displayValue = String(condition.value);
        }

        return `„${field.label}" ${operator.label} ${displayValue}`;
    }

    if (condition.type === "group") {
        const parts = condition.conditions
            .map((c) => conditionToNaturalLanguage(c, { fields, clauses, variants }, depth + 1))
            .filter((s) => s.length > 0);

        if (parts.length === 0) return "";
        if (parts.length === 1) return parts[0];

        const connector = condition.logic === "and" ? " UND " : " ODER ";
        const result = parts.join(connector);

        // Add parentheses for nested groups
        return depth > 0 ? `(${result})` : result;
    }

    return "";
};

// ============================================================================
// CONDITION EVALUATION (for testing/simulation)
// ============================================================================

const evaluateCondition = (
    condition: ClauseCondition,
    testValues: TestValues,
    fields: FieldDefinition[]
): boolean => {
    if (!condition) return true; // No condition = always show

    if (condition.type === "simple") {
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
    }

    if (condition.type === "group") {
        const results = condition.conditions.map((c) => evaluateCondition(c, testValues, fields));
        return condition.logic === "and"
            ? results.every((r) => r)
            : results.some((r) => r);
    }

    return false;
};

// ============================================================================
// CONDITION VALIDATION
// ============================================================================

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

const validateCondition = (condition: ClauseCondition, fields: FieldDefinition[]): ValidationResult => {
    const errors: string[] = [];

    if (!condition) {
        return { isValid: true, errors: [] };
    }

    const validateSimple = (c: SimpleCondition, path: string): void => {
        if (!c.field) {
            errors.push(`${path}: Kein Feld ausgewählt`);
        }
        if (!c.operator) {
            errors.push(`${path}: Kein Operator ausgewählt`);
        }
        const operators = getOperatorsForField(c.field, fields);
        const operator = operators.find((o) => o.value === c.operator);
        if (operator?.requiresValue && (c.value === "" || c.value === undefined)) {
            errors.push(`${path}: Kein Wert angegeben`);
        }
        // Validate "between" operator format
        if (c.operator === "between" && c.value) {
            const parts = String(c.value).split("-");
            if (parts.length !== 2 || isNaN(Number(parts[0])) || isNaN(Number(parts[1]))) {
                errors.push(`${path}: Ungültiges Format für "zwischen" (erwartet: Zahl-Zahl, z.B. 50000-80000)`);
            } else if (Number(parts[0]) > Number(parts[1])) {
                errors.push(`${path}: Der erste Wert muss kleiner als der zweite sein`);
            }
        }
    };

    const validateGroup = (g: ConditionGroup, path: string): void => {
        if (g.conditions.length === 0) {
            errors.push(`${path}: Keine Bedingungen in der Gruppe`);
        }
        g.conditions.forEach((c, i) => {
            if (c.type === "simple") {
                validateSimple(c, `${path} → Bedingung ${i + 1}`);
            } else {
                validateGroup(c, `${path} → Gruppe ${i + 1}`);
            }
        });
    };

    if (condition.type === "simple") {
        validateSimple(condition, "Bedingung");
    } else {
        validateGroup(condition, "Gruppe");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

// ============================================================================
// UNDO/REDO HOOK
// ============================================================================

interface HistoryState<T> {
    past: T[];
    present: T;
    future: T[];
}

function useHistory<T>(initialPresent: T) {
    const [state, setState] = useState<HistoryState<T>>({
        past: [],
        present: initialPresent,
        future: [],
    });

    const canUndo = state.past.length > 0;
    const canRedo = state.future.length > 0;

    const set = useCallback((newPresent: T, recordHistory = true) => {
        setState((currentState) => {
            if (recordHistory && JSON.stringify(currentState.present) !== JSON.stringify(newPresent)) {
                return {
                    past: [...currentState.past, currentState.present].slice(-50), // Keep max 50 states
                    present: newPresent,
                    future: [],
                };
            }
            return { ...currentState, present: newPresent };
        });
    }, []);

    const undo = useCallback(() => {
        setState((currentState) => {
            if (currentState.past.length === 0) return currentState;
            const previous = currentState.past[currentState.past.length - 1];
            const newPast = currentState.past.slice(0, -1);
            return {
                past: newPast,
                present: previous,
                future: [currentState.present, ...currentState.future],
            };
        });
    }, []);

    const redo = useCallback(() => {
        setState((currentState) => {
            if (currentState.future.length === 0) return currentState;
            const next = currentState.future[0];
            const newFuture = currentState.future.slice(1);
            return {
                past: [...currentState.past, currentState.present],
                present: next,
                future: newFuture,
            };
        });
    }, []);

    const reset = useCallback((newPresent: T) => {
        setState({
            past: [],
            present: newPresent,
            future: [],
        });
    }, []);

    return { state: state.present, set, undo, redo, canUndo, canRedo, reset };
}

// ============================================================================
// SORTABLE CONDITION ROW COMPONENT
// ============================================================================

interface SortableConditionRowProps {
    condition: SimpleCondition;
    onChange: (condition: SimpleCondition) => void;
    onRemove: () => void;
    onDuplicate?: () => void;
    disabled?: boolean;
    showRemove: boolean;
    index: number;
    fields: FieldDefinition[];
    fieldSearch: string;
    availableClauses: ClauseReference[];
    availableVariants: VariantReference[];
}

const SortableConditionRow = ({
    condition,
    onChange,
    onRemove,
    onDuplicate,
    disabled = false,
    showRemove,
    index,
    fields,
    fieldSearch,
    availableClauses,
    availableVariants,
}: SortableConditionRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: condition.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 1,
    };

    // Determine condition kind (default to "field" for backwards compatibility)
    const conditionKind: ConditionKind = condition.conditionKind || "field";

    const fieldsByCategory = useMemo(() => groupFieldsByCategory(fields), [fields]);
    const fieldInfo = getFieldInfo(condition.field, fields);
    const fieldType = fieldInfo?.type || "text";
    const operators = getOperatorsForField(condition.field, fields);
    const selectedOperator = operators.find((o) => o.value === condition.operator);

    // Get clause/variant info
    const selectedClause = availableClauses.find(c => c.id === condition.clauseId);
    const selectedVariant = availableVariants.find(v => v.id === condition.variantId);

    // Filter fields based on search
    const filteredFieldsByCategory = useMemo(() => {
        if (!fieldSearch) return fieldsByCategory;
        const search = fieldSearch.toLowerCase();
        const result: Record<string, FieldDefinition[]> = {};
        Object.entries(fieldsByCategory).forEach(([category, categoryFields]) => {
            const filtered = categoryFields.filter(
                (f) =>
                    f.label.toLowerCase().includes(search) ||
                    f.name.toLowerCase().includes(search) ||
                    f.description?.toLowerCase().includes(search)
            );
            if (filtered.length > 0) {
                result[category] = filtered;
            }
        });
        return result;
    }, [fieldsByCategory, fieldSearch]);

    // Filter clauses based on search
    const filteredClauses = useMemo(() => {
        if (!fieldSearch) return availableClauses;
        const search = fieldSearch.toLowerCase();
        return availableClauses.filter(c => c.title.toLowerCase().includes(search));
    }, [availableClauses, fieldSearch]);

    // Filter variants based on search
    const filteredVariants = useMemo(() => {
        if (!fieldSearch) return availableVariants;
        const search = fieldSearch.toLowerCase();
        return availableVariants.filter(v =>
            v.title.toLowerCase().includes(search) ||
            v.clauseTitle?.toLowerCase().includes(search)
        );
    }, [availableVariants, fieldSearch]);

    // Group variants by clause
    const variantsByClause = useMemo(() => {
        const grouped: Record<number, { clauseTitle: string; variants: VariantReference[] }> = {};
        filteredVariants.forEach(v => {
            if (!grouped[v.clauseId]) {
                grouped[v.clauseId] = { clauseTitle: v.clauseTitle || `Klausel ${v.clauseId}`, variants: [] };
            }
            grouped[v.clauseId].variants.push(v);
        });
        return grouped;
    }, [filteredVariants]);

    const handleConditionKindChange = (newKind: ConditionKind) => {
        // Reset the condition when changing kind
        onChange({
            ...condition,
            conditionKind: newKind,
            field: "",
            clauseId: undefined,
            variantId: undefined,
            operator: newKind === "field" ? "" : "==",
            value: newKind === "field" ? "" : true,
        });
    };

    const handleFieldChange = (newField: string) => {
        const newFieldInfo = getFieldInfo(newField, fields);
        const newType = newFieldInfo?.type || "text";
        const newOperators = OPERATORS[newType] || OPERATORS.text;

        let defaultValue: string | number | boolean = "";
        if (newType === "boolean") {
            defaultValue = true;
        }

        onChange({
            ...condition,
            conditionKind: "field",
            field: newField,
            clauseId: undefined,
            variantId: undefined,
            operator: newOperators[0]?.value || "==",
            value: defaultValue,
        });
    };

    const handleClauseChange = (clauseId: string) => {
        onChange({
            ...condition,
            conditionKind: "clause_active",
            field: "",
            clauseId: parseInt(clauseId, 10),
            variantId: undefined,
            operator: "==",
            value: true,
        });
    };

    const handleVariantChange = (variantId: string) => {
        onChange({
            ...condition,
            conditionKind: "variant_selected",
            field: "",
            clauseId: undefined,
            variantId: parseInt(variantId, 10),
            operator: "==",
            value: true,
        });
    };

    const handleOperatorChange = (newOperator: string) => {
        const operator = operators.find((o) => o.value === newOperator);
        const newValue = operator?.requiresValue ? condition.value : "";
        onChange({
            ...condition,
            operator: newOperator,
            value: newValue,
        });
    };

    const handleValueChange = (newValue: string | number | boolean) => {
        onChange({
            ...condition,
            value: newValue,
        });
    };

    const renderValueInput = () => {
        if (selectedOperator && !selectedOperator.requiresValue) {
            return (
                <div className="flex items-center px-3 py-2 bg-muted/50 rounded-md text-sm text-muted-foreground italic">
                    — kein Wert erforderlich —
                </div>
            );
        }

        switch (fieldType) {
            case "boolean":
                return (
                    <Select
                        value={condition.value === true ? "true" : "false"}
                        onValueChange={(v) => handleValueChange(v === "true")}
                        disabled={disabled || !condition.field}
                    >
                        <SelectTrigger className="min-w-[150px]">
                            <SelectValue placeholder="Wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    Ja / Aktiviert
                                </div>
                            </SelectItem>
                            <SelectItem value="false">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                                    Nein / Deaktiviert
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                );

            case "select":
                return (
                    <Select
                        value={String(condition.value)}
                        onValueChange={handleValueChange}
                        disabled={disabled || !condition.field}
                    >
                        <SelectTrigger className="min-w-[150px]">
                            <SelectValue placeholder="Wert wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                            {fieldInfo?.options?.map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                );

            case "number":
                // Special handling for "between" operator
                if (condition.operator === "between") {
                    const parts = String(condition.value || "").split("-");
                    const minValue = parts[0] || "";
                    const maxValue = parts[1] || "";
                    return (
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                value={minValue}
                                onChange={(e) => handleValueChange(`${e.target.value}-${maxValue}`)}
                                placeholder="Von"
                                disabled={disabled || !condition.field}
                                className="w-24"
                            />
                            <span className="text-muted-foreground">—</span>
                            <Input
                                type="number"
                                value={maxValue}
                                onChange={(e) => handleValueChange(`${minValue}-${e.target.value}`)}
                                placeholder="Bis"
                                disabled={disabled || !condition.field}
                                className="w-24"
                            />
                            {fieldInfo?.unit && (
                                <span className="text-sm text-muted-foreground">
                                    {fieldInfo.unit}
                                </span>
                            )}
                        </div>
                    );
                }
                return (
                    <div className="relative">
                        <Input
                            type="number"
                            value={condition.value === "" ? "" : Number(condition.value)}
                            onChange={(e) => handleValueChange(e.target.value === "" ? "" : Number(e.target.value))}
                            placeholder={fieldInfo?.unit ? `z.B. 80000` : "Wert"}
                            disabled={disabled || !condition.field}
                            className="min-w-[120px] pr-12"
                        />
                        {fieldInfo?.unit && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {fieldInfo.unit}
                            </span>
                        )}
                    </div>
                );

            default:
                return (
                    <Input
                        type="text"
                        value={String(condition.value)}
                        onChange={(e) => handleValueChange(e.target.value)}
                        placeholder="z.B. Manager"
                        disabled={disabled || !condition.field}
                        className="min-w-[150px]"
                    />
                );
        }
    };

    // Check if clause/variant conditions are available
    const hasClauseConditions = availableClauses.length > 0;
    const hasVariantConditions = availableVariants.length > 0;
    const showKindSelector = hasClauseConditions || hasVariantConditions;

    // Render the target selector based on condition kind
    const renderTargetSelector = () => {
        switch (conditionKind) {
            case "clause_active":
                return (
                    <Select
                        value={condition.clauseId?.toString() || ""}
                        onValueChange={handleClauseChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Klausel wählen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {filteredClauses.map((clause) => (
                                <SelectItem key={clause.id} value={clause.id.toString()}>
                                    {clause.title}
                                </SelectItem>
                            ))}
                            {filteredClauses.length === 0 && (
                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                    Keine Klauseln verfügbar
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                );

            case "variant_selected":
                return (
                    <Select
                        value={condition.variantId?.toString() || ""}
                        onValueChange={handleVariantChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Variante wählen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {Object.entries(variantsByClause).map(([clauseId, { clauseTitle, variants }]) => (
                                <SelectGroup key={clauseId}>
                                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {clauseTitle}
                                    </SelectLabel>
                                    {variants.map((variant) => (
                                        <SelectItem key={variant.id} value={variant.id.toString()}>
                                            {variant.title}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                            {Object.keys(variantsByClause).length === 0 && (
                                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                                    Keine Varianten verfügbar
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                );

            default: // "field"
                return (
                    <Select
                        value={condition.field}
                        onValueChange={handleFieldChange}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Feld wählen..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            {Object.entries(filteredFieldsByCategory).map(([category, categoryFields]) => (
                                <SelectGroup key={category}>
                                    <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {category}
                                    </SelectLabel>
                                    {categoryFields.map((field) => (
                                        <SelectItem key={field.name} value={field.name}>
                                            <div className="flex items-center gap-2">
                                                <span>{field.label}</span>
                                                {field.description && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {field.description}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                );
        }
    };

    // For clause_active and variant_selected, we show a simpler operator/value UI
    const renderClauseVariantOperator = () => (
        <Select
            value={condition.operator}
            onValueChange={(v) => onChange({ ...condition, operator: v })}
            disabled={disabled}
        >
            <SelectTrigger className="min-w-[120px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="==">ist</SelectItem>
                <SelectItem value="!=">ist nicht</SelectItem>
            </SelectContent>
        </Select>
    );

    const renderClauseVariantValue = () => (
        <Select
            value={condition.value === true ? "true" : "false"}
            onValueChange={(v) => handleValueChange(v === "true")}
            disabled={disabled}
        >
            <SelectTrigger className="min-w-[130px]">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="true">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        {conditionKind === "clause_active" ? "aktiv" : "gewählt"}
                    </div>
                </SelectItem>
                <SelectItem value="false">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        {conditionKind === "clause_active" ? "nicht aktiv" : "nicht gewählt"}
                    </div>
                </SelectItem>
            </SelectContent>
        </Select>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group flex items-center gap-2 p-3 rounded-lg border bg-card transition-all",
                "hover:border-primary/30 hover:shadow-sm",
                isDragging && "shadow-lg border-primary ring-2 ring-primary/20",
                disabled && "opacity-60"
            )}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="flex-shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none"
            >
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Row Number */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                {index + 1}
            </div>

            {/* Condition Kind Selector - only shown if clauses/variants are available */}
            {showKindSelector && (
                <div className="flex-shrink-0 min-w-[130px]">
                    <Select
                        value={conditionKind}
                        onValueChange={(v) => handleConditionKindChange(v as ConditionKind)}
                        disabled={disabled}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="field">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4" />
                                    Feld
                                </div>
                            </SelectItem>
                            {hasClauseConditions && (
                                <SelectItem value="clause_active">
                                    <div className="flex items-center gap-2">
                                        <GitBranch className="w-4 h-4" />
                                        Klausel
                                    </div>
                                </SelectItem>
                            )}
                            {hasVariantConditions && (
                                <SelectItem value="variant_selected">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Variante
                                    </div>
                                </SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Target Selector (Field / Clause / Variant) */}
            <div className="flex-1 min-w-[180px]">
                {renderTargetSelector()}
            </div>

            {/* Operator & Value - different for field vs clause/variant */}
            {conditionKind === "field" ? (
                <>
                    {/* Operator Selector */}
                    <div className="flex-shrink-0 min-w-[140px]">
                        <Select
                            value={condition.operator}
                            onValueChange={handleOperatorChange}
                            disabled={disabled || !condition.field}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Bedingung..." />
                            </SelectTrigger>
                            <SelectContent>
                                {operators.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                        <div className="flex items-center gap-2">
                                            <span>{op.label}</span>
                                            {op.description && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({op.description})
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Value Input */}
                    <div className="flex-shrink-0">
                        {renderValueInput()}
                    </div>
                </>
            ) : (
                <>
                    {/* Simplified Operator for Clause/Variant */}
                    <div className="flex-shrink-0">
                        {renderClauseVariantOperator()}
                    </div>

                    {/* Simplified Value for Clause/Variant */}
                    <div className="flex-shrink-0">
                        {renderClauseVariantValue()}
                    </div>

                    {/* Show selected item info */}
                    {conditionKind === "clause_active" && selectedClause && (
                        <Badge variant="outline" className="text-xs">
                            {selectedClause.title}
                        </Badge>
                    )}
                    {conditionKind === "variant_selected" && selectedVariant && (
                        <Badge variant="outline" className="text-xs">
                            {selectedVariant.title}
                        </Badge>
                    )}
                </>
            )}

            {/* Action Buttons */}
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDuplicate && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onDuplicate}
                                    disabled={disabled}
                                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bedingung duplizieren (Strg+D)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {showRemove && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onRemove}
                                    disabled={disabled}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Bedingung entfernen (Entf)</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// CONDITION GROUP COMPONENT
// ============================================================================

interface ConditionGroupEditorProps {
    group: ConditionGroup;
    onChange: (group: ConditionGroup) => void;
    onRemove?: () => void;
    disabled?: boolean;
    isRoot?: boolean;
    depth?: number;
    fields: FieldDefinition[];
    fieldSearch: string;
    availableClauses: ClauseReference[];
    availableVariants: VariantReference[];
}

const ConditionGroupEditor = ({
    group,
    onChange,
    onRemove,
    disabled = false,
    isRoot: _isRoot = false,
    depth = 0,
    fields,
    fieldSearch,
    availableClauses,
    availableVariants,
}: ConditionGroupEditorProps) => {
    void _isRoot;
    const [isCollapsed, setIsCollapsed] = useState(false);

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = group.conditions.findIndex(
                (c) => c.id === active.id
            );
            const newIndex = group.conditions.findIndex(
                (c) => c.id === over.id
            );

            if (oldIndex !== -1 && newIndex !== -1) {
                onChange({
                    ...group,
                    conditions: arrayMove(group.conditions, oldIndex, newIndex),
                });
            }
        }
    };

    const handleLogicChange = (logic: "and" | "or") => {
        onChange({ ...group, logic });
    };

    const handleConditionChange = (index: number, newCondition: SimpleCondition | ConditionGroup) => {
        const newConditions = [...group.conditions];
        newConditions[index] = newCondition;
        onChange({ ...group, conditions: newConditions });
    };

    const handleRemoveCondition = (index: number) => {
        const newConditions = group.conditions.filter((_, i) => i !== index);
        if (newConditions.length === 0) {
            newConditions.push(createEmptyCondition());
        }
        onChange({ ...group, conditions: newConditions });
    };

    const handleAddCondition = () => {
        onChange({
            ...group,
            conditions: [...group.conditions, createEmptyCondition()],
        });
    };

    const handleAddGroup = (logic: "and" | "or") => {
        onChange({
            ...group,
            conditions: [...group.conditions, createEmptyGroup(logic)],
        });
    };

    const handleDuplicateCondition = (index: number) => {
        const conditionToDuplicate = group.conditions[index];
        const newConditions = [...group.conditions];
        newConditions.splice(index + 1, 0, cloneConditionWithNewIds(conditionToDuplicate));
        onChange({ ...group, conditions: newConditions });
    };

    const borderColor = depth === 0
        ? "border-primary/20"
        : group.logic === "and"
            ? "border-blue-200 dark:border-blue-800"
            : "border-amber-200 dark:border-amber-800";

    const bgColor = depth === 0
        ? "bg-background"
        : group.logic === "and"
            ? "bg-blue-50/50 dark:bg-blue-950/20"
            : "bg-amber-50/50 dark:bg-amber-950/20";

    // Get sortable IDs (only simple conditions for now)
    const sortableIds = group.conditions.map((c) => c.id);

    return (
        <div className={cn(
            "rounded-lg border-2 border-dashed p-4 transition-all",
            borderColor,
            bgColor,
            depth > 0 && "ml-4"
        )}>
            {/* Group Header */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                {/* Collapse Toggle */}
                {depth > 0 && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="h-6 w-6 text-muted-foreground"
                    >
                        {isCollapsed ? (
                            <ChevronRight className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </Button>
                )}

                {/* Group Icon */}
                <div className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded",
                    group.logic === "and" ? "bg-blue-100 dark:bg-blue-900" : "bg-amber-100 dark:bg-amber-900"
                )}>
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        {depth === 0 ? "Bedingungsgruppe" : "Untergruppe"}
                    </span>
                </div>

                {/* Logic Toggle */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    <Button
                        variant={group.logic === "and" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLogicChange("and")}
                        disabled={disabled}
                        className={cn(
                            "h-7 px-3 text-xs font-semibold",
                            group.logic === "and" && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        )}
                    >
                        UND
                    </Button>
                    <Button
                        variant={group.logic === "or" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => handleLogicChange("or")}
                        disabled={disabled}
                        className={cn(
                            "h-7 px-3 text-xs font-semibold",
                            group.logic === "or" && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                        )}
                    >
                        ODER
                    </Button>
                </div>

                {/* Logic Explanation */}
                <span className="text-xs text-muted-foreground flex-1">
                    {group.logic === "and"
                        ? "Alle Bedingungen müssen erfüllt sein"
                        : "Mindestens eine Bedingung muss erfüllt sein"}
                </span>

                {/* Remove Group Button */}
                {depth > 0 && onRemove && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onRemove}
                                    disabled={disabled}
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gruppe entfernen</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* Conditions */}
            {!isCollapsed && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortableIds}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-2">
                            {group.conditions.map((condition, index) => (
                                <div key={condition.id}>
                                    {/* Logic Connector */}
                                    {index > 0 && (
                                        <div className="flex items-center gap-2 py-1 pl-8">
                                            <Badge
                                                variant={group.logic === "and" ? "default" : "secondary"}
                                                className={cn(
                                                    "text-xs",
                                                    group.logic === "and"
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                        : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                                )}
                                            >
                                                {group.logic === "and" ? "UND" : "ODER"}
                                            </Badge>
                                            <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                                        </div>
                                    )}

                                    {/* Condition or Nested Group */}
                                    {condition.type === "simple" ? (
                                        <SortableConditionRow
                                            condition={condition}
                                            onChange={(newCond) => handleConditionChange(index, newCond)}
                                            onRemove={() => handleRemoveCondition(index)}
                                            onDuplicate={() => handleDuplicateCondition(index)}
                                            disabled={disabled}
                                            showRemove={group.conditions.length > 1}
                                            index={index}
                                            fields={fields}
                                            fieldSearch={fieldSearch}
                                            availableClauses={availableClauses}
                                            availableVariants={availableVariants}
                                        />
                                    ) : (
                                        <ConditionGroupEditor
                                            group={condition}
                                            onChange={(newGroup) => handleConditionChange(index, newGroup)}
                                            onRemove={() => handleRemoveCondition(index)}
                                            disabled={disabled}
                                            depth={depth + 1}
                                            fields={fields}
                                            fieldSearch={fieldSearch}
                                            availableClauses={availableClauses}
                                            availableVariants={availableVariants}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {/* Add Buttons */}
            {!isCollapsed && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-muted-foreground/20 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddCondition}
                        disabled={disabled}
                        className="gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Bedingung
                    </Button>

                    {depth < 2 && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddGroup("and")}
                                disabled={disabled}
                                className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                UND-Gruppe
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddGroup("or")}
                                disabled={disabled}
                                className="gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950"
                            >
                                <Layers className="w-3.5 h-3.5" />
                                ODER-Gruppe
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// CONDITION TESTER COMPONENT
// ============================================================================

interface ConditionTesterProps {
    condition: ClauseCondition;
    fields: FieldDefinition[];
    onClose: () => void;
}

const ConditionTester = ({ condition, fields, onClose }: ConditionTesterProps) => {
    const usedFields = useMemo(() => getConditionFields(condition), [condition]);
    const [testValues, setTestValues] = useState<TestValues>({});
    const [result, setResult] = useState<boolean | null>(null);

    // Initialize test values
    useEffect(() => {
        const initial: TestValues = {};
        usedFields.forEach((fieldName) => {
            const field = getFieldInfo(fieldName, fields);
            if (field) {
                if (field.type === "boolean") initial[fieldName] = false;
                else if (field.type === "number") initial[fieldName] = 0;
                else initial[fieldName] = "";
            }
        });
        setTestValues(initial);
    }, [usedFields, fields]);

    const handleTest = () => {
        const testResult = evaluateCondition(condition, testValues, fields);
        setResult(testResult);
    };

    const handleValueChange = (fieldName: string, value: string | number | boolean) => {
        setTestValues((prev) => ({ ...prev, [fieldName]: value }));
        setResult(null);
    };

    return (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
                Geben Sie Testwerte ein, um zu prüfen, ob die Bedingung erfüllt wird:
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {usedFields.map((fieldName) => {
                    const field = getFieldInfo(fieldName, fields);
                    if (!field) return null;

                    return (
                        <div key={fieldName} className="flex items-center gap-3">
                            <Label className="w-1/3 text-sm truncate">{field.label}:</Label>
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
                                            <SelectItem value="true">Ja</SelectItem>
                                            <SelectItem value="false">Nein</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : field.type === "select" ? (
                                    <Select
                                        value={String(testValues[fieldName] || "")}
                                        onValueChange={(v) => handleValueChange(fieldName, v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Wählen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {field.options?.map((opt) => (
                                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
            </div>

            {usedFields.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                    Keine Felder in der Bedingung definiert.
                </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                    Schließen
                </Button>
                <Button onClick={handleTest} disabled={usedFields.length === 0}>
                    <Play className="w-4 h-4 mr-2" />
                    Testen
                </Button>
            </div>

            {result !== null && (
                <div className={cn(
                    "p-4 rounded-lg border-2 flex items-center gap-3",
                    result
                        ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700"
                        : "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700"
                )}>
                    {result ? (
                        <>
                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                            <div>
                                <p className="font-medium text-green-800 dark:text-green-200">Bedingung erfüllt!</p>
                                <p className="text-sm text-green-700 dark:text-green-300">Die Klausel wird angezeigt.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <X className="w-6 h-6 text-red-600" />
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Bedingung nicht erfüllt</p>
                                <p className="text-sm text-red-700 dark:text-red-300">Die Klausel wird ausgeblendet.</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN CONDITION BUILDER COMPONENT
// ============================================================================

interface ConditionBuilderProps {
    condition: ClauseCondition;
    onChange: (condition: ClauseCondition) => void;
    disabled?: boolean;
    fields?: FieldDefinition[];
    /** Available clauses for "clause is active" conditions */
    availableClauses?: ClauseReference[];
    /** Available variants for "variant is selected" conditions */
    availableVariants?: VariantReference[];
    showTemplates?: boolean;
    showTester?: boolean;
    showShortcuts?: boolean;
}

export const ConditionBuilder = ({
    condition,
    onChange,
    disabled = false,
    fields = DEFAULT_CONDITION_FIELDS,
    availableClauses = [],
    availableVariants = [],
    showTemplates = true,
    showTester = true,
    showShortcuts = true,
}: ConditionBuilderProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEnabled, setIsEnabled] = useState(!!condition);
    const [fieldSearch, setFieldSearch] = useState("");
    const [showTesterDialog, setShowTesterDialog] = useState(false);
    const [showTemplatesPopover, setShowTemplatesPopover] = useState(false);
    const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

    // Undo/Redo
    const {
        state: historyCondition,
        set: setHistoryCondition,
        undo,
        redo,
        canUndo,
        canRedo,
        reset: resetHistory,
    } = useHistory<ClauseCondition>(condition);

    // Sync external condition with history (only when condition prop changes from outside)
    const lastExternalCondition = useRef<string>(JSON.stringify(condition));
    useEffect(() => {
        const currentExternal = JSON.stringify(condition);
        if (currentExternal !== lastExternalCondition.current) {
            lastExternalCondition.current = currentExternal;
            if (currentExternal !== JSON.stringify(historyCondition)) {
                resetHistory(condition);
            }
        }
    }, [condition, historyCondition, resetHistory]);

    // Update parent when history changes
    useEffect(() => {
        const historyJson = JSON.stringify(historyCondition);
        if (historyJson !== lastExternalCondition.current) {
            lastExternalCondition.current = historyJson;
            onChange(historyCondition);
        }
    }, [historyCondition, onChange]);

    // Normalize condition
    const normalizedCondition = useMemo((): ConditionGroup | null => {
        if (!historyCondition) return null;
        if (historyCondition.type === "group") return historyCondition;
        return {
            type: "group",
            id: generateId(),
            logic: "and",
            conditions: [historyCondition],
        };
    }, [historyCondition]);

    // Initialize
    useEffect(() => {
        if (isEnabled && !historyCondition) {
            setHistoryCondition(createEmptyGroup("and"));
        }
    }, [isEnabled, historyCondition, setHistoryCondition]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!containerRef.current?.contains(document.activeElement)) return;
            if (disabled) return;

            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
                e.preventDefault();
                redo();
                return;
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [undo, redo, disabled]);

    const handleToggle = (enabled: boolean) => {
        setIsEnabled(enabled);
        if (!enabled) {
            setHistoryCondition(null);
        } else if (!historyCondition) {
            setHistoryCondition(createEmptyGroup("and"));
        }
    };

    const handleGroupChange = (newGroup: ConditionGroup) => {
        setHistoryCondition(newGroup);
    };

    const handleClear = () => {
        setIsEnabled(false);
        setHistoryCondition(null);
    };

    const handleApplyTemplate = (template: QuickTemplate) => {
        const newCondition = cloneConditionWithNewIds(template.condition);
        if (normalizedCondition) {
            // Add to existing conditions
            setHistoryCondition({
                ...normalizedCondition,
                conditions: [...normalizedCondition.conditions, newCondition],
            });
        } else {
            // Start fresh with template
            if (newCondition.type === "group") {
                setHistoryCondition(newCondition);
            } else {
                setHistoryCondition({
                    type: "group",
                    id: generateId(),
                    logic: "and",
                    conditions: [newCondition],
                });
            }
        }
        setShowTemplatesPopover(false);
    };

    // Validation
    const validation = useMemo(() => validateCondition(historyCondition, fields), [historyCondition, fields]);

    // Natural language preview
    const previewText = useMemo(
        () => conditionToNaturalLanguage(historyCondition, {
            fields,
            clauses: availableClauses,
            variants: availableVariants,
        }),
        [historyCondition, fields, availableClauses, availableVariants]
    );

    return (
        <Card ref={containerRef} className={cn("overflow-hidden", disabled && "opacity-60")}>
            <CardHeader className="pb-3 bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-primary" />
                        Bedingte Anzeige
                        {isEnabled && (
                            <Badge variant="secondary" className="ml-2 font-normal">
                                Aktiv
                            </Badge>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {/* Undo/Redo */}
                        {isEnabled && (
                            <div className="flex items-center gap-1 mr-2">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={undo}
                                                disabled={!canUndo || disabled}
                                                className="h-8 w-8"
                                            >
                                                <Undo2 className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Rückgängig (Strg+Z)</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={redo}
                                                disabled={!canRedo || disabled}
                                                className="h-8 w-8"
                                            >
                                                <Redo2 className="w-4 h-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Wiederholen (Strg+Y)</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}

                        <Label
                            htmlFor="condition-toggle"
                            className="text-sm text-muted-foreground cursor-pointer"
                        >
                            {isEnabled ? "Deaktivieren" : "Aktivieren"}
                        </Label>
                        <Switch
                            id="condition-toggle"
                            checked={isEnabled}
                            onCheckedChange={handleToggle}
                            disabled={disabled}
                        />
                    </div>
                </div>
            </CardHeader>

            {isEnabled && normalizedCondition && (
                <CardContent className="pt-4 space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Field Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Feld suchen..."
                                value={fieldSearch}
                                onChange={(e) => setFieldSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                            {fieldSearch && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setFieldSearch("")}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-1">
                            {/* Quick Templates */}
                            {showTemplates && (
                                <Popover open={showTemplatesPopover} onOpenChange={setShowTemplatesPopover}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <Zap className="w-4 h-4" />
                                            Vorlagen
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-2" align="start">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium px-2 py-1">Schnellvorlagen</p>
                                            {QUICK_TEMPLATES.map((template) => (
                                                <Button
                                                    key={template.id}
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleApplyTemplate(template)}
                                                    className="w-full justify-start gap-2 h-auto py-2"
                                                >
                                                    {template.icon}
                                                    <div className="text-left">
                                                        <div className="font-medium">{template.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {template.description}
                                                        </div>
                                                    </div>
                                                </Button>
                                            ))}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            )}

                            {/* Tester */}
                            {showTester && (
                                <Dialog open={showTesterDialog} onOpenChange={setShowTesterDialog}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <FlaskConical className="w-4 h-4" />
                                            Testen
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                                <FlaskConical className="w-5 h-5" />
                                                Bedingung testen
                                            </DialogTitle>
                                            <DialogDescription>
                                                Prüfen Sie, ob die Klausel mit bestimmten Werten angezeigt wird.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ConditionTester
                                            condition={historyCondition}
                                            fields={fields}
                                            onClose={() => setShowTesterDialog(false)}
                                        />
                                    </DialogContent>
                                </Dialog>
                            )}

                            {/* Keyboard Shortcuts */}
                            {showShortcuts && (
                                <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9">
                                            <Keyboard className="w-4 h-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-sm">
                                        <DialogHeader>
                                            <DialogTitle>Tastaturkürzel</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-2">
                                            {[
                                                { keys: "Strg + Z", action: "Rückgängig" },
                                                { keys: "Strg + Y", action: "Wiederholen" },
                                                { keys: "Strg + Shift + Z", action: "Wiederholen (alternativ)" },
                                            ].map(({ keys, action }) => (
                                                <div key={keys} className="flex items-center justify-between py-2 border-b last:border-0">
                                                    <span className="text-sm">{action}</span>
                                                    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                                                        {keys}
                                                    </kbd>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-3">
                                            Tipp: Verwenden Sie die Buttons zum Duplizieren und Löschen von Bedingungen.
                                        </p>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setShowShortcutsDialog(false)}>
                                                Schließen
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                        <p className="flex items-start gap-2">
                            <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>
                                Definieren Sie, wann diese Klausel erscheint. Verknüpfen Sie Bedingungen mit{" "}
                                <strong className="text-blue-600">UND</strong> (alle müssen zutreffen) oder{" "}
                                <strong className="text-amber-600">ODER</strong> (mindestens eine muss zutreffen).
                                Ziehen Sie Bedingungen per Drag & Drop in die gewünschte Reihenfolge.
                            </span>
                        </p>
                    </div>

                    {/* Condition Editor */}
                    <ConditionGroupEditor
                        group={normalizedCondition}
                        onChange={handleGroupChange}
                        disabled={disabled}
                        isRoot
                        depth={0}
                        fields={fields}
                        fieldSearch={fieldSearch}
                        availableClauses={availableClauses}
                        availableVariants={availableVariants}
                    />

                    {/* Live Preview */}
                    {previewText && (
                        <div className={cn(
                            "rounded-lg p-4 border",
                            validation.isValid
                                ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                                : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                        )}>
                            <div className="flex items-start gap-3">
                                <div className={cn(
                                    "flex-shrink-0 p-2 rounded-full",
                                    validation.isValid
                                        ? "bg-green-100 dark:bg-green-900"
                                        : "bg-amber-100 dark:bg-amber-900"
                                )}>
                                    <Eye className={cn(
                                        "w-4 h-4",
                                        validation.isValid
                                            ? "text-green-600 dark:text-green-400"
                                            : "text-amber-600 dark:text-amber-400"
                                    )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                        Vorschau — Die Klausel wird angezeigt wenn:
                                    </p>
                                    <p className="text-base font-medium break-words">
                                        {previewText}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Validation Errors */}
                    {!validation.isValid && (
                        <div className="rounded-lg p-3 bg-destructive/10 border border-destructive/30">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 text-destructive flex-shrink-0" />
                                <div className="text-sm">
                                    <p className="font-medium text-destructive mb-1">
                                        Bitte vervollständigen Sie die Bedingung:
                                    </p>
                                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                                        {validation.errors.map((error, i) => (
                                            <li key={i}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Clear Button */}
                    <div className="flex justify-end pt-2 border-t">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            disabled={disabled}
                            className="text-muted-foreground hover:text-destructive gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Alle Bedingungen entfernen
                        </Button>
                    </div>
                </CardContent>
            )}

            {!isEnabled && (
                <CardContent className="py-6">
                    <div className="flex items-center justify-center gap-3 text-muted-foreground">
                        <EyeOff className="w-5 h-5" />
                        <span className="text-sm">
                            Diese Klausel wird <strong>immer</strong> angezeigt (keine Bedingung aktiv).
                        </span>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

// ============================================================================
// JSON CONVERSION HELPERS
// ============================================================================

/** Convert condition to JSON for storage */
export const conditionToJson = (condition: ClauseCondition): string | null => {
    if (!condition) return null;
    return JSON.stringify(condition);
};

/** Parse JSON to condition, handling legacy formats */
export const jsonToCondition = (json: string | null): ClauseCondition => {
    if (!json) return null;

    try {
        const parsed = JSON.parse(json);

        // Handle legacy format
        if (parsed && typeof parsed === "object" && !parsed.type) {
            if (parsed.and || parsed.or) {
                const logic = parsed.and ? "and" : "or";
                const conditions = (parsed.and || parsed.or) as LegacyCondition[];
                return {
                    type: "group",
                    id: generateId(),
                    logic,
                    conditions: conditions.map((c) => ({
                        type: "simple" as const,
                        id: generateId(),
                        field: c.field,
                        operator: c.operator,
                        value: c.value,
                    })),
                };
            }

            return {
                type: "simple",
                id: generateId(),
                field: parsed.field,
                operator: parsed.operator,
                value: parsed.value,
            };
        }

        // Ensure IDs exist
        const ensureIds = (c: SimpleCondition | ConditionGroup): SimpleCondition | ConditionGroup => {
            if (c.type === "simple") {
                return { ...c, id: c.id || generateId() };
            }
            return {
                ...c,
                id: c.id || generateId(),
                conditions: c.conditions.map(ensureIds),
            };
        };

        if (parsed.type) {
            return ensureIds(parsed);
        }

        return parsed as ClauseCondition;
    } catch {
        return null;
    }
};

/** Validate condition completeness */
export const isConditionComplete = (
    condition: ClauseCondition,
    fields: FieldDefinition[] = DEFAULT_CONDITION_FIELDS
): boolean => {
    const result = validateCondition(condition, fields);
    return result.isValid;
};

/** Get all field names used in condition */
export const getConditionFields = (condition: ClauseCondition): string[] => {
    if (!condition) return [];

    const fields: string[] = [];

    const collect = (c: ClauseCondition): void => {
        if (!c) return;
        if (c.type === "simple") {
            if (c.field) fields.push(c.field);
        } else if (c.type === "group") {
            c.conditions.forEach(collect);
        }
    };

    collect(condition);
    return [...new Set(fields)];
};

/** Evaluate condition with test values */
export const testCondition = (
    condition: ClauseCondition,
    values: TestValues,
    fields: FieldDefinition[] = DEFAULT_CONDITION_FIELDS
): boolean => {
    return evaluateCondition(condition, values, fields);
};

export default ConditionBuilder;
