/**
 * DocumentTypeEditor
 *
 * Full editor for creating/editing document types with:
 * - Basic info (name, category, country)
 * - Clause selection with drag-and-drop ordering
 * - Condition builder for conditional clauses
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    SortableList,
    SortableItemWrapper,
    DragHandle,
} from "@/components/ui/drag-drop";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    useClauses,
    useCreateDocumentType,
    useUpdateDocumentType,
    useDocumentType,
    useVariantGroups,
    type Clause,
    type DocumentTypeClauseLink,
} from "@/hooks/useApi";
import {
    GripVertical,
    Plus,
    Save,
    Loader2,
    FileText,
    Check,
    X,
    ChevronRight,
    ChevronLeft,
    ChevronDown,
    Settings2,
    AlertCircle,
    Clock,
    Calendar,
    Briefcase,
    Layers,
    GitBranch,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ClauseFormDialog } from "@/components/clauses/ClauseFormDialog";

interface ClauseSelection extends DocumentTypeClauseLink {
    clause?: Clause;
}

interface VariantGroupSelection {
    variant_group_id: number;
    display_order: number;
    is_mandatory: boolean;
    default_variant_id?: number | null;
    // Für Anzeige
    name?: string;
    description?: string;
    variant_count?: number;
    variants?: Array<{
        id: number;
        variant_name: string;
        is_default: boolean;
    }>;
}

interface DocumentTypeEditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editId?: number | null;
    countryCode: string;
    onSuccess?: () => void;
}

const CATEGORIES = [
    // Hauptkategorien
    { value: "contract", label: "Arbeitsvertrag" },
    { value: "amendment", label: "Änderungsvertrag" },
    { value: "agreement", label: "Vereinbarung" },
    // HR-Korrespondenz (NEU)
    { value: "letter", label: "Schreiben" },
    { value: "invitation", label: "Einladung" },
    { value: "care", label: "Fürsorgegespräch / BEM" },
    { value: "notice", label: "Kündigung" },
    { value: "warning", label: "Abmahnung" },
    { value: "certificate", label: "Bescheinigung / Zeugnis" },
    // Sonstiges
    { value: "other", label: "Sonstiges" },
];

export const DocumentTypeEditor = ({
    open,
    onOpenChange,
    editId,
    countryCode: initialCountryCode,
    onSuccess,
}: DocumentTypeEditorProps) => {
    // Form state
    const [step, setStep] = useState(1);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<string>("");
    const [countryCode, setCountryCode] = useState(initialCountryCode);
    const [isActive, setIsActive] = useState(true);
    const [selectedClauses, setSelectedClauses] = useState<ClauseSelection[]>([]);
    const [selectedVariantGroups, setSelectedVariantGroups] = useState<VariantGroupSelection[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // In-Dialog Clause Creation State (UX-Verbesserung)
    const [showClauseCreator, setShowClauseCreator] = useState(false);
    // Collapsible state für erweiterte Einstellungen
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // Standardwerte für diesen Dokumenttyp
    const [defaultProbationMonths, setDefaultProbationMonths] = useState(6);
    const [defaultNoticePeriod, setDefaultNoticePeriod] = useState("4 Wochen zum Monatsende");
    const [defaultVacationDays, setDefaultVacationDays] = useState(30);
    const [defaultWeeklyHours, setDefaultWeeklyHours] = useState(40);

    // Data fetching
    const { data: existingDocType, isLoading: loadingDocType } = useDocumentType(editId || 0);
    const { data: availableClauses, isLoading: loadingClauses } = useClauses(countryCode);
    const { data: availableVariantGroups, isLoading: loadingVariantGroups } = useVariantGroups(countryCode);

    // Mutations
    const createMutation = useCreateDocumentType();
    const updateMutation = useUpdateDocumentType();

    const isEditing = !!editId;
    const isPending = createMutation.isPending || updateMutation.isPending;

    // Reset form when opening/closing
    useEffect(() => {
        if (open) {
            setStep(1);
            setErrors({});
            if (!editId) {
                // New document type
                setName("");
                setDescription("");
                setCategory("");
                setCountryCode(initialCountryCode);
                setIsActive(true);
                setSelectedClauses([]);
                setSelectedVariantGroups([]);
                // Reset defaults
                setDefaultProbationMonths(6);
                setDefaultNoticePeriod("4 Wochen zum Monatsende");
                setDefaultVacationDays(30);
                setDefaultWeeklyHours(40);
            }
        }
    }, [open, editId, initialCountryCode]);

    // Load existing document type data
    useEffect(() => {
        if (existingDocType && editId) {
            setName(existingDocType.name || "");
            setDescription(existingDocType.description || "");
            setCategory(existingDocType.category || "");
            setCountryCode(existingDocType.country_code || initialCountryCode);
            setIsActive(existingDocType.is_active !== false);
            // Load default values
            setDefaultProbationMonths(existingDocType.default_probation_months ?? 6);
            setDefaultNoticePeriod(existingDocType.default_notice_period ?? "4 Wochen zum Monatsende");
            setDefaultVacationDays(existingDocType.default_vacation_days ?? 30);
            setDefaultWeeklyHours(existingDocType.default_weekly_hours ?? 40);
            // Load clause links if available
            if (existingDocType.clauses) {
                const clauseLinks: ClauseSelection[] = existingDocType.clauses.map((c: Clause, idx: number) => ({
                    clause_id: c.id,
                    display_order: idx + 1,
                    is_mandatory: true,
                    clause: c,
                }));
                setSelectedClauses(clauseLinks);
            }
            // Load variant group links if available
            if (existingDocType.variant_groups) {
                const vgLinks: VariantGroupSelection[] = existingDocType.variant_groups.map((vg: VariantGroupSelection) => ({
                    variant_group_id: vg.variant_group_id,
                    display_order: vg.display_order,
                    is_mandatory: vg.is_mandatory,
                    default_variant_id: vg.default_variant_id,
                    name: vg.name,
                    description: vg.description,
                    variant_count: vg.variant_count,
                    variants: vg.variants,
                }));
                setSelectedVariantGroups(vgLinks);
            }
        }
    }, [existingDocType, editId, initialCountryCode]);

    // Validation
    const validateStep1 = () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = "Name ist erforderlich";
        }
        if (!category) {
            newErrors.category = "Kategorie ist erforderlich";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        if (selectedClauses.length === 0) {
            setErrors({ clauses: "Mindestens eine Klausel ist erforderlich" });
            return false;
        }
        setErrors({});
        return true;
    };

    // Navigation
    const handleNext = () => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
        }
    };

    // Clause management
    const addClause = (clause: Clause) => {
        if (selectedClauses.some(sc => sc.clause_id === clause.id)) {
            return; // Already added
        }
        setSelectedClauses([
            ...selectedClauses,
            {
                clause_id: clause.id,
                display_order: selectedClauses.length + 1,
                is_mandatory: true,
                clause,
            },
        ]);
    };

    const removeClause = (clauseId: number) => {
        setSelectedClauses(
            selectedClauses
                .filter(sc => sc.clause_id !== clauseId)
                .map((sc, idx) => ({ ...sc, display_order: idx + 1 }))
        );
    };

    const toggleMandatory = (clauseId: number) => {
        setSelectedClauses(
            selectedClauses.map(sc =>
                sc.clause_id === clauseId
                    ? { ...sc, is_mandatory: !sc.is_mandatory }
                    : sc
            )
        );
    };

    // Variant group management
    const addVariantGroup = (vg: { id: number; name: string; description?: string; variants?: Array<{ id: number; variant_name: string; is_default: boolean }> }) => {
        if (selectedVariantGroups.some(svg => svg.variant_group_id === vg.id)) {
            return; // Already added
        }
        const defaultVariant = vg.variants?.find(v => v.is_default);
        setSelectedVariantGroups([
            ...selectedVariantGroups,
            {
                variant_group_id: vg.id,
                display_order: selectedVariantGroups.length + 1,
                is_mandatory: true,
                default_variant_id: defaultVariant?.id || null,
                name: vg.name,
                description: vg.description,
                variant_count: vg.variants?.length || 0,
                variants: vg.variants,
            },
        ]);
    };

    const removeVariantGroup = (groupId: number) => {
        setSelectedVariantGroups(
            selectedVariantGroups
                .filter(vg => vg.variant_group_id !== groupId)
                .map((vg, idx) => ({ ...vg, display_order: idx + 1 }))
        );
    };

    const toggleVariantGroupMandatory = (groupId: number) => {
        setSelectedVariantGroups(
            selectedVariantGroups.map(vg =>
                vg.variant_group_id === groupId
                    ? { ...vg, is_mandatory: !vg.is_mandatory }
                    : vg
            )
        );
    };

    const setVariantGroupDefault = (groupId: number, variantId: number) => {
        setSelectedVariantGroups(
            selectedVariantGroups.map(vg =>
                vg.variant_group_id === groupId
                    ? { ...vg, default_variant_id: variantId }
                    : vg
            )
        );
    };

    // Save handler
    const handleSave = async () => {
        if (!validateStep1() || !validateStep2()) {
            return;
        }

        const data = {
            name: name.trim(),
            description: description.trim() || null,
            country_code: countryCode,
            category,
            is_active: isActive,
            // Standardwerte für diesen Dokumenttyp
            default_probation_months: defaultProbationMonths,
            default_notice_period: defaultNoticePeriod,
            default_vacation_days: defaultVacationDays,
            default_weekly_hours: defaultWeeklyHours,
            clauses: selectedClauses.map((sc, idx) => ({
                clause_id: sc.clause_id,
                display_order: idx + 1,
                is_mandatory: sc.is_mandatory,
            })),
            variant_groups: selectedVariantGroups.map((vg, idx) => ({
                variant_group_id: vg.variant_group_id,
                display_order: idx + 1,
                is_mandatory: vg.is_mandatory,
                default_variant_id: vg.default_variant_id,
            })),
        };

        try {
            if (isEditing && editId) {
                await updateMutation.mutateAsync({ id: editId, data });
            } else {
                await createMutation.mutateAsync(data);
            }
            onOpenChange(false);
            onSuccess?.();
        } catch {
            // Error handled by mutation
        }
    };

    // Filter available clauses (not yet selected)
    const unselectedClauses = (availableClauses || []).filter(
        (c: Clause) => !selectedClauses.some(sc => sc.clause_id === c.id)
    );

    // Group clauses by category
    const groupedClauses = unselectedClauses.reduce((acc: Record<string, Clause[]>, clause: Clause) => {
        const cat = clause.category || "Sonstige";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(clause);
        return acc;
    }, {});

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        {isEditing ? "Dokumenttyp bearbeiten" : "Neuer Dokumenttyp"}
                    </DialogTitle>
                </DialogHeader>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 py-4 border-b">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                    s < step
                                        ? "bg-secondary text-white"
                                        : s === step
                                        ? "bg-primary text-white"
                                        : "bg-gray-200 text-gray-500"
                                )}
                            >
                                {s < step ? <Check className="w-4 h-4" /> : s}
                            </div>
                            <span
                                className={cn(
                                    "ml-2 text-sm",
                                    s === step ? "text-primary font-medium" : "text-gray-500"
                                )}
                            >
                                {s === 1 && "Grunddaten"}
                                {s === 2 && "Klauseln"}
                                {s === 3 && "Übersicht"}
                            </span>
                            {s < 3 && (
                                <ChevronRight className="w-4 h-4 mx-4 text-gray-400" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4">
                    {loadingDocType ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {/* Step 1: Basic Info */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="grid gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">Name des Dokumenttyps *</Label>
                                            <Input
                                                id="name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="z.B. Arbeitsvertrag Vollzeit"
                                                className={errors.name ? "border-red-500" : ""}
                                            />
                                            {errors.name && (
                                                <p className="text-sm text-red-500">{errors.name}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Kategorie *</Label>
                                                <Select value={category} onValueChange={setCategory}>
                                                    <SelectTrigger className={errors.category ? "border-red-500" : ""}>
                                                        <SelectValue placeholder="Kategorie wählen" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {CATEGORIES.map((cat) => (
                                                            <SelectItem key={cat.value} value={cat.value}>
                                                                {cat.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors.category && (
                                                    <p className="text-sm text-red-500">{errors.category}</p>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Land</Label>
                                                <Select value={countryCode} onValueChange={setCountryCode}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="DE">🇩🇪 Deutschland</SelectItem>
                                                        <SelectItem value="IT">🇮🇹 Italien</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="description">Beschreibung</Label>
                                            <Textarea
                                                id="description"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Kurze Beschreibung des Dokumenttyps..."
                                                rows={2}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="active"
                                                checked={isActive}
                                                onCheckedChange={(checked) => setIsActive(checked === true)}
                                            />
                                            <Label htmlFor="active" className="font-normal">
                                                Dokumenttyp ist aktiv
                                            </Label>
                                        </div>
                                    </div>

                                    {/* Erweiterte Einstellungen (Collapsible) */}
                                    <Collapsible
                                        open={showAdvancedSettings}
                                        onOpenChange={setShowAdvancedSettings}
                                        className="mt-6"
                                    >
                                        <CollapsibleTrigger asChild>
                                            <button
                                                type="button"
                                                className="flex items-center gap-2 w-full p-3 rounded-lg border border-blue-200 bg-blue-50/30 hover:bg-blue-50 transition-colors text-left group"
                                            >
                                                <ChevronDown className={cn(
                                                    "w-4 h-4 text-blue-600 transition-transform duration-200",
                                                    showAdvancedSettings && "rotate-180"
                                                )} />
                                                <Briefcase className="w-4 h-4 text-blue-600" />
                                                <div className="flex-1">
                                                    <span className="font-medium text-sm text-blue-800">
                                                        Erweiterte Einstellungen
                                                    </span>
                                                    <span className="text-xs text-blue-600 ml-2">
                                                        (optional)
                                                    </span>
                                                </div>
                                                {!showAdvancedSettings && (defaultProbationMonths !== 6 || defaultVacationDays !== 30 || defaultWeeklyHours !== 40) && (
                                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                        Angepasst
                                                    </span>
                                                )}
                                            </button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-3">
                                            <Card className="border-blue-200 bg-blue-50/30">
                                                <CardHeader className="pb-3">
                                                    <p className="text-xs text-blue-600">
                                                        Diese Werte werden beim Erstellen eines Dokuments dieses Typs vorausgefüllt
                                                    </p>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="flex items-center gap-2">
                                                                <Clock className="w-4 h-4 text-blue-600" />
                                                                Probezeit
                                                            </Label>
                                                            <Select
                                                                value={String(defaultProbationMonths)}
                                                                onValueChange={(v) => setDefaultProbationMonths(parseInt(v))}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="0">Keine Probezeit</SelectItem>
                                                                    <SelectItem value="3">3 Monate</SelectItem>
                                                                    <SelectItem value="6">6 Monate</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <p className="text-xs text-muted-foreground">
                                                                In DE max. 6 Monate erlaubt.
                                                            </p>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Kündigungsfrist</Label>
                                                            <Input
                                                                value={defaultNoticePeriod}
                                                                onChange={(e) => setDefaultNoticePeriod(e.target.value)}
                                                                placeholder="4 Wochen zum Monatsende"
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Gesetzliches Minimum: 4 Wochen.
                                                            </p>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label className="flex items-center gap-2">
                                                                <Calendar className="w-4 h-4 text-blue-600" />
                                                                Urlaubstage/Jahr
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                value={defaultVacationDays}
                                                                onChange={(e) => setDefaultVacationDays(parseInt(e.target.value) || 30)}
                                                                min={20}
                                                                max={40}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Minimum: 20 Tage. Üblich: 25-30.
                                                            </p>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <Label>Wochenstunden</Label>
                                                            <Input
                                                                type="number"
                                                                value={defaultWeeklyHours}
                                                                onChange={(e) => setDefaultWeeklyHours(parseInt(e.target.value) || 40)}
                                                                min={10}
                                                                max={48}
                                                            />
                                                            <p className="text-xs text-muted-foreground">
                                                                Vollzeit: 40h. Max: 48h/Woche.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </motion.div>
                            )}

                            {/* Step 2: Clause Selection */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    {errors.clauses && (
                                        <div className="flex items-center justify-between p-3 bg-red-50 text-red-700 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4" />
                                                {errors.clauses}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setShowClauseCreator(true)}
                                                className="bg-white hover:bg-red-100 text-red-700 border-red-300"
                                            >
                                                <Plus className="w-4 h-4 mr-1" />
                                                Klausel erstellen
                                            </Button>
                                        </div>
                                    )}

                                    {/* Quick Action Button für neue Klausel */}
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowClauseCreator(true)}
                                            className="gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Neue Klausel erstellen
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 h-[450px]">
                                        {/* Available Clauses */}
                                        <Card className="overflow-hidden">
                                            <CardHeader className="py-3 bg-gray-50">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    Verfügbare Klauseln
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0 overflow-y-auto h-[calc(100%-48px)]">
                                                {loadingClauses ? (
                                                    <div className="flex items-center justify-center py-8">
                                                        <Loader2 className="w-6 h-6 animate-spin" />
                                                    </div>
                                                ) : Object.keys(groupedClauses).length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500">
                                                        Alle Klauseln wurden hinzugefügt
                                                    </div>
                                                ) : (
                                                    <div className="divide-y">
                                                        {Object.entries(groupedClauses).map(([cat, clauses]) => (
                                                            <div key={cat}>
                                                                <div className="px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                                                                    {cat}
                                                                </div>
                                                                {(clauses as Clause[]).map((clause) => (
                                                                    <div
                                                                        key={clause.id}
                                                                        className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer group"
                                                                        onClick={() => addClause(clause)}
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium truncate">
                                                                                {clause.title}
                                                                            </p>
                                                                            <p className="text-xs text-gray-500">
                                                                                v{clause.version}
                                                                            </p>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Plus className="w-4 h-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>

                                        {/* Selected Clauses */}
                                        <Card className="overflow-hidden">
                                            <CardHeader className="py-3 bg-primary/5">
                                                <CardTitle className="text-sm flex items-center gap-2">
                                                    <Settings2 className="w-4 h-4" />
                                                    Ausgewählte Klauseln ({selectedClauses.length})
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0 overflow-y-auto h-[calc(100%-48px)]">
                                                {selectedClauses.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500">
                                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">Keine Klauseln ausgewählt</p>
                                                        <p className="text-xs">
                                                            Klicken Sie links auf eine Klausel, um sie hinzuzufügen
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <SortableList
                                                        items={selectedClauses.map((sc) => ({
                                                            ...sc,
                                                            id: sc.clause_id,
                                                        }))}
                                                        onReorder={(newOrder) => {
                                                            setSelectedClauses(
                                                                newOrder.map((sc, idx) => ({
                                                                    ...sc,
                                                                    clause_id: sc.id as number,
                                                                    display_order: idx + 1,
                                                                }))
                                                            );
                                                        }}
                                                        className="divide-y"
                                                        renderItem={(item, index) => (
                                                            <SortableItemWrapper
                                                                id={item.id}
                                                                className="bg-white hover:bg-gray-50"
                                                            >
                                                                <div className="flex items-center gap-2 p-3">
                                                                    <DragHandle className="w-6 h-6" />
                                                                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                                                                        {index + 1}
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium truncate">
                                                                            {item.clause?.title || `Klausel ${item.clause_id}`}
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => toggleMandatory(item.clause_id)}
                                                                            className={cn(
                                                                                "px-2 py-1 text-xs rounded transition-colors",
                                                                                item.is_mandatory
                                                                                    ? "bg-secondary/20 text-secondary"
                                                                                    : "bg-gray-100 text-gray-500"
                                                                            )}
                                                                        >
                                                                            {item.is_mandatory ? "Pflicht" : "Optional"}
                                                                        </button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => removeClause(item.clause_id)}
                                                                        >
                                                                            <X className="w-4 h-4 text-red-500" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </SortableItemWrapper>
                                                        )}
                                                        renderDragOverlay={(item) => (
                                                            <div className="flex items-center gap-2 p-3 bg-white border rounded-lg shadow-lg">
                                                                <GripVertical className="w-4 h-4 text-gray-400" />
                                                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                                                                    {selectedClauses.findIndex(sc => sc.clause_id === item.id) + 1}
                                                                </span>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {item.clause?.title || `Klausel ${item.clause_id}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    />
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Varianten-Gruppen Sektion */}
                                    <div className="mt-6 border-t pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="w-4 h-4 text-purple-600" />
                                                <span className="font-medium text-sm">Varianten-Gruppen</span>
                                                <span className="text-xs text-muted-foreground">
                                                    (optional)
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            Varianten-Gruppen ermöglichen es dem Benutzer im Generator zwischen verschiedenen Klausel-Varianten zu wählen (z.B. verschiedene Kündigungsfristen).
                                        </p>

                                        <div className="grid grid-cols-2 gap-4 h-[250px]">
                                            {/* Available Variant Groups */}
                                            <Card className="overflow-hidden border-purple-200">
                                                <CardHeader className="py-2 bg-purple-50">
                                                    <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                                                        <Layers className="w-4 h-4" />
                                                        Verfügbare Gruppen
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0 overflow-y-auto h-[calc(100%-40px)]">
                                                    {loadingVariantGroups ? (
                                                        <div className="flex items-center justify-center py-4">
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        </div>
                                                    ) : !availableVariantGroups || availableVariantGroups.filter(
                                                        (vg: { id: number }) => !selectedVariantGroups.some(svg => svg.variant_group_id === vg.id)
                                                    ).length === 0 ? (
                                                        <div className="p-3 text-center text-gray-500 text-xs">
                                                            Keine weiteren Varianten-Gruppen verfügbar
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y">
                                                            {availableVariantGroups
                                                                .filter((vg: { id: number }) => !selectedVariantGroups.some(svg => svg.variant_group_id === vg.id))
                                                                .map((vg: { id: number; name: string; description?: string; variants?: Array<{ id: number; variant_name: string; is_default: boolean }> }) => (
                                                                    <div
                                                                        key={vg.id}
                                                                        className="flex items-center justify-between p-2 hover:bg-purple-50 cursor-pointer group"
                                                                        onClick={() => addVariantGroup(vg)}
                                                                    >
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium truncate">{vg.name}</p>
                                                                            <p className="text-xs text-gray-500">
                                                                                {vg.variants?.length || 0} Varianten
                                                                            </p>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                                                                        >
                                                                            <Plus className="w-4 h-4 text-purple-600" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>

                                            {/* Selected Variant Groups */}
                                            <Card className="overflow-hidden border-purple-200">
                                                <CardHeader className="py-2 bg-purple-100/50">
                                                    <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
                                                        <GitBranch className="w-4 h-4" />
                                                        Zugeordnete Gruppen ({selectedVariantGroups.length})
                                                    </CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-0 overflow-y-auto h-[calc(100%-40px)]">
                                                    {selectedVariantGroups.length === 0 ? (
                                                        <div className="p-3 text-center text-gray-500">
                                                            <Layers className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                                            <p className="text-xs">Keine Varianten-Gruppen zugeordnet</p>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y">
                                                            {selectedVariantGroups.map((vg) => (
                                                                <div
                                                                    key={vg.variant_group_id}
                                                                    className="p-2 bg-white hover:bg-gray-50"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium truncate">
                                                                                {vg.name}
                                                                            </p>
                                                                            <p className="text-xs text-gray-500">
                                                                                {vg.variant_count || vg.variants?.length || 0} Varianten
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => toggleVariantGroupMandatory(vg.variant_group_id)}
                                                                            className={cn(
                                                                                "px-2 py-0.5 text-xs rounded",
                                                                                vg.is_mandatory
                                                                                    ? "bg-purple-100 text-purple-700"
                                                                                    : "bg-gray-100 text-gray-500"
                                                                            )}
                                                                        >
                                                                            {vg.is_mandatory ? "Pflicht" : "Optional"}
                                                                        </button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            className="h-7 w-7 p-0"
                                                                            onClick={() => removeVariantGroup(vg.variant_group_id)}
                                                                        >
                                                                            <X className="w-4 h-4 text-red-500" />
                                                                        </Button>
                                                                    </div>
                                                                    {/* Standard-Variante wählen */}
                                                                    {vg.variants && vg.variants.length > 0 && (
                                                                        <div className="mt-2">
                                                                            <Select
                                                                                value={String(vg.default_variant_id || "")}
                                                                                onValueChange={(val) => setVariantGroupDefault(vg.variant_group_id, parseInt(val))}
                                                                            >
                                                                                <SelectTrigger className="h-7 text-xs">
                                                                                    <SelectValue placeholder="Standard-Variante wählen" />
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {vg.variants.map((v) => (
                                                                                        <SelectItem key={v.id} value={String(v.id)}>
                                                                                            {v.variant_name} {v.is_default && "(Gruppen-Standard)"}
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Summary */}
                            {step === 3 && (
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
                                                    <p className="text-sm text-gray-500">Name</p>
                                                    <p className="font-medium">{name}</p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Kategorie</p>
                                                    <p className="font-medium">
                                                        {CATEGORIES.find(c => c.value === category)?.label || category}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Land</p>
                                                    <p className="font-medium">
                                                        {countryCode === "DE" ? "🇩🇪 Deutschland" : "🇮🇹 Italien"}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-sm text-gray-500">Status</p>
                                                    <p className={cn(
                                                        "font-medium",
                                                        isActive ? "text-green-600" : "text-gray-500"
                                                    )}>
                                                        {isActive ? "Aktiv" : "Inaktiv"}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Standardwerte Zusammenfassung */}
                                            <div className="border-t pt-4 mt-4">
                                                <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                                                    <Briefcase className="w-4 h-4" />
                                                    Standardwerte
                                                </p>
                                                <div className="grid grid-cols-2 gap-2 text-sm bg-blue-50 p-3 rounded-lg">
                                                    <div>
                                                        <span className="text-gray-500">Probezeit:</span>{" "}
                                                        <span className="font-medium">
                                                            {defaultProbationMonths === 0 ? "Keine" : `${defaultProbationMonths} Monate`}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Kündigungsfrist:</span>{" "}
                                                        <span className="font-medium">{defaultNoticePeriod}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Urlaubstage:</span>{" "}
                                                        <span className="font-medium">{defaultVacationDays} Tage</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Wochenstunden:</span>{" "}
                                                        <span className="font-medium">{defaultWeeklyHours}h</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="border-t pt-4">
                                                <p className="text-sm text-gray-500 mb-2">
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
                                                                    : "bg-gray-100 text-gray-500"
                                                            )}>
                                                                {sc.is_mandatory ? "Pflicht" : "Optional"}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Varianten-Gruppen Zusammenfassung */}
                                            {selectedVariantGroups.length > 0 && (
                                                <div className="border-t pt-4">
                                                    <p className="text-sm text-gray-500 mb-2 flex items-center gap-2">
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
                                                                <span className="text-xs text-gray-500">
                                                                    {vg.variant_count || vg.variants?.length || 0} Varianten
                                                                </span>
                                                                <span className={cn(
                                                                    "text-xs px-2 py-0.5 rounded",
                                                                    vg.is_mandatory
                                                                        ? "bg-purple-200 text-purple-700"
                                                                        : "bg-gray-100 text-gray-500"
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

                                    {(createMutation.isError || updateMutation.isError) && (
                                        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                                            <AlertCircle className="w-4 h-4" />
                                            {createMutation.error?.message || updateMutation.error?.message}
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="border-t pt-4">
                    <div className="flex justify-between w-full">
                        <div>
                            {step > 1 && (
                                <Button variant="outline" onClick={handleBack} disabled={isPending}>
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Zurück
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                Abbrechen
                            </Button>
                            {step < 3 ? (
                                <Button onClick={handleNext} className="bg-primary hover:bg-primary/90">
                                    Weiter
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="bg-secondary hover:bg-[#5aa86f]"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Speichern...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            {isEditing ? "Änderungen speichern" : "Dokumenttyp erstellen"}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>

            {/* In-Dialog Clause Creator (UX-Verbesserung) */}
            <ClauseFormDialog
                open={showClauseCreator}
                onOpenChange={setShowClauseCreator}
                defaultCountryCode={countryCode}
                onSuccess={(newClause) => {
                    // Automatisch die neu erstellte Klausel zur Auswahl hinzufügen
                    addClause(newClause);
                    setShowClauseCreator(false);
                }}
            />
        </Dialog>
    );
};
