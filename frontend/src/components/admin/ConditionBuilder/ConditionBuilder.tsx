/**
 * ConditionBuilder - Visual Condition Editor for Clauses (Main Component)
 *
 * A graphical tool that allows HR staff to define conditional logic
 * for clauses without writing code or JSON.
 *
 * Features (Lawlift-Level):
 * - Drag-and-Drop Interface for conditions
 * - AND/OR Logic with nested groups (up to 3 levels)
 * - Live preview in natural language
 * - Categorized field selection with search
 * - Type-based operators and value input
 * - Validation and error messages
 * - Quick templates for common conditions
 * - Keyboard shortcuts
 * - Undo/Redo functionality
 * - Condition Testing/Simulation
 * - Dynamic fields from API
 */

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Eye,
    EyeOff,
    HelpCircle,
    AlertCircle,
    Undo2,
    Redo2,
    Zap,
    Search,
    Keyboard,
    X,
    FlaskConical,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { DEFAULT_CONDITION_FIELDS, QUICK_TEMPLATES } from "./constants";
import { generateId, createEmptyGroup, cloneConditionWithNewIds } from "./utils";
import { conditionToNaturalLanguage, validateCondition } from "./condition-logic";
import { useHistory } from "./useConditionHistory";
import { ConditionGroupEditor } from "./ConditionGroupEditor";
import { ConditionTester } from "./ConditionTester";
import type { ConditionBuilderProps, ConditionGroup, ClauseCondition, QuickTemplate } from "./types";

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

export default ConditionBuilder;
