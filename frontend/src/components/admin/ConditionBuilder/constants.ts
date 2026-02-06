/**
 * ConditionBuilder - Constants
 *
 * Default field definitions, operators, and quick templates.
 */

import { Sparkles } from "lucide-react";
import { createElement } from "react";
import type { FieldDefinition, OperatorDefinition, QuickTemplate } from "./types";
import { generateId } from "./utils";

// ============================================================================
// FIELD DEFINITIONS (DEFAULT - can be overridden via props)
// ============================================================================

export const DEFAULT_CONDITION_FIELDS: FieldDefinition[] = [
    // Verguetung
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

    // Sonderfaelle
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

export const OPERATORS: Record<string, OperatorDefinition[]> = {
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

const sparklesIcon = createElement(Sparkles, { className: "w-4 h-4" });

export const QUICK_TEMPLATES: QuickTemplate[] = [
    {
        id: "firmenwagen",
        name: "Firmenwagen-Klausel",
        description: "Zeige wenn Firmenwagen = Ja",
        icon: sparklesIcon,
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
        icon: sparklesIcon,
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
        icon: sparklesIcon,
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
        icon: sparklesIcon,
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
        icon: sparklesIcon,
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
        icon: sparklesIcon,
        condition: {
            type: "simple",
            id: generateId(),
            field: "entgeltgruppe",
            operator: "==",
            value: "AT",
        },
    },
];
