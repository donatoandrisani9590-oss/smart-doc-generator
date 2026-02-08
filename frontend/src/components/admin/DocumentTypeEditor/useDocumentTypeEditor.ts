import { useState, useEffect, useCallback, useMemo } from "react";
import {
    useClauses,
    useCreateDocumentType,
    useUpdateDocumentType,
    useDocumentType,
    useVariantGroups,
    type Clause,
} from "@/hooks/useApi";
import type { ClauseSelection, VariantGroupSelection } from "./types";

interface UseDocumentTypeEditorOptions {
    open: boolean;
    editId?: number | null;
    initialCountryCode: string;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function useDocumentTypeEditor({
    open,
    editId,
    initialCountryCode,
    onOpenChange,
    onSuccess,
}: UseDocumentTypeEditorOptions) {
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

    // In-Dialog Clause Creation State
    const [showClauseCreator, setShowClauseCreator] = useState(false);
    // Collapsible state for advanced settings
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

    // Default values for this document type
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
                setName("");
                setDescription("");
                setCategory("");
                setCountryCode(initialCountryCode);
                setIsActive(true);
                setSelectedClauses([]);
                setSelectedVariantGroups([]);
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
            setDefaultProbationMonths(existingDocType.default_probation_months ?? 6);
            setDefaultNoticePeriod(existingDocType.default_notice_period ?? "4 Wochen zum Monatsende");
            setDefaultVacationDays(existingDocType.default_vacation_days ?? 30);
            setDefaultWeeklyHours(existingDocType.default_weekly_hours ?? 40);

            if (existingDocType.clauses) {
                const clauseLinks: ClauseSelection[] = existingDocType.clauses.map((c: Clause, idx: number) => ({
                    clause_id: c.id,
                    display_order: idx + 1,
                    is_mandatory: true,
                    clause: c,
                }));
                setSelectedClauses(clauseLinks);
            }

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
    const validateStep1 = useCallback(() => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) {
            newErrors.name = "Name ist erforderlich";
        }
        if (!category) {
            newErrors.category = "Kategorie ist erforderlich";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [name, category]);

    const validateStep2 = useCallback(() => {
        if (selectedClauses.length === 0) {
            setErrors({ clauses: "Mindestens ein Textbaustein ist erforderlich" });
            return false;
        }
        setErrors({});
        return true;
    }, [selectedClauses.length]);

    // Navigation
    const handleNext = useCallback(() => {
        if (step === 1 && validateStep1()) {
            setStep(2);
        } else if (step === 2 && validateStep2()) {
            setStep(3);
        }
    }, [step, validateStep1, validateStep2]);

    const handleBack = useCallback(() => {
        if (step > 1) {
            setStep(step - 1);
        }
    }, [step]);

    // Clause management
    const addClause = useCallback((clause: Clause) => {
        setSelectedClauses((prev) => {
            if (prev.some(sc => sc.clause_id === clause.id)) {
                return prev;
            }
            return [
                ...prev,
                {
                    clause_id: clause.id,
                    display_order: prev.length + 1,
                    is_mandatory: true,
                    clause,
                },
            ];
        });
    }, []);

    const removeClause = useCallback((clauseId: number) => {
        setSelectedClauses((prev) =>
            prev
                .filter(sc => sc.clause_id !== clauseId)
                .map((sc, idx) => ({ ...sc, display_order: idx + 1 }))
        );
    }, []);

    const toggleMandatory = useCallback((clauseId: number) => {
        setSelectedClauses((prev) =>
            prev.map(sc =>
                sc.clause_id === clauseId
                    ? { ...sc, is_mandatory: !sc.is_mandatory }
                    : sc
            )
        );
    }, []);

    const reorderClauses = useCallback((newOrder: Array<ClauseSelection & { id: number | string }>) => {
        setSelectedClauses(
            newOrder.map((sc, idx) => ({
                ...sc,
                clause_id: sc.id as number,
                display_order: idx + 1,
            }))
        );
    }, []);

    // Variant group management
    const addVariantGroup = useCallback((vg: {
        id: number;
        name: string;
        description?: string;
        variants?: Array<{ id: number; variant_name: string; is_default: boolean }>;
    }) => {
        setSelectedVariantGroups((prev) => {
            if (prev.some(svg => svg.variant_group_id === vg.id)) {
                return prev;
            }
            const defaultVariant = vg.variants?.find(v => v.is_default);
            return [
                ...prev,
                {
                    variant_group_id: vg.id,
                    display_order: prev.length + 1,
                    is_mandatory: true,
                    default_variant_id: defaultVariant?.id || null,
                    name: vg.name,
                    description: vg.description,
                    variant_count: vg.variants?.length || 0,
                    variants: vg.variants,
                },
            ];
        });
    }, []);

    const removeVariantGroup = useCallback((groupId: number) => {
        setSelectedVariantGroups((prev) =>
            prev
                .filter(vg => vg.variant_group_id !== groupId)
                .map((vg, idx) => ({ ...vg, display_order: idx + 1 }))
        );
    }, []);

    const toggleVariantGroupMandatory = useCallback((groupId: number) => {
        setSelectedVariantGroups((prev) =>
            prev.map(vg =>
                vg.variant_group_id === groupId
                    ? { ...vg, is_mandatory: !vg.is_mandatory }
                    : vg
            )
        );
    }, []);

    const setVariantGroupDefault = useCallback((groupId: number, variantId: number) => {
        setSelectedVariantGroups((prev) =>
            prev.map(vg =>
                vg.variant_group_id === groupId
                    ? { ...vg, default_variant_id: variantId }
                    : vg
            )
        );
    }, []);

    // Save handler
    const handleSave = useCallback(async () => {
        if (!validateStep1() || !validateStep2()) {
            return;
        }

        const data = {
            name: name.trim(),
            description: description.trim() || null,
            country_code: countryCode,
            category,
            is_active: isActive,
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
    }, [
        validateStep1,
        validateStep2,
        name,
        description,
        countryCode,
        category,
        isActive,
        defaultProbationMonths,
        defaultNoticePeriod,
        defaultVacationDays,
        defaultWeeklyHours,
        selectedClauses,
        selectedVariantGroups,
        isEditing,
        editId,
        updateMutation,
        createMutation,
        onOpenChange,
        onSuccess,
    ]);

    // Computed: Filter available clauses (not yet selected)
    const unselectedClauses = useMemo(
        () => (availableClauses || []).filter(
            (c: Clause) => !selectedClauses.some(sc => sc.clause_id === c.id)
        ),
        [availableClauses, selectedClauses]
    );

    // Computed: Group clauses by category
    const groupedClauses = useMemo(
        () => unselectedClauses.reduce((acc: Record<string, Clause[]>, clause: Clause) => {
            const cat = clause.category || "Sonstige";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(clause);
            return acc;
        }, {}),
        [unselectedClauses]
    );

    // Unselected variant groups
    const unselectedVariantGroups = useMemo(
        () => (availableVariantGroups || []).filter(
            (vg: { id: number }) => !selectedVariantGroups.some(svg => svg.variant_group_id === vg.id)
        ),
        [availableVariantGroups, selectedVariantGroups]
    );

    return {
        // Step navigation
        step,
        handleNext,
        handleBack,

        // Form fields
        name,
        setName,
        description,
        setDescription,
        category,
        setCategory,
        countryCode,
        setCountryCode,
        isActive,
        setIsActive,

        // Advanced settings
        showAdvancedSettings,
        setShowAdvancedSettings,
        defaultProbationMonths,
        setDefaultProbationMonths,
        defaultNoticePeriod,
        setDefaultNoticePeriod,
        defaultVacationDays,
        setDefaultVacationDays,
        defaultWeeklyHours,
        setDefaultWeeklyHours,

        // Errors
        errors,
        setErrors,

        // Clause selection
        selectedClauses,
        setSelectedClauses,
        addClause,
        removeClause,
        toggleMandatory,
        reorderClauses,

        // Variant groups
        selectedVariantGroups,
        addVariantGroup,
        removeVariantGroup,
        toggleVariantGroupMandatory,
        setVariantGroupDefault,

        // Computed values
        groupedClauses,
        unselectedVariantGroups,

        // Loading states
        loadingDocType,
        loadingClauses,
        loadingVariantGroups,

        // Mutations
        createMutation,
        updateMutation,
        isEditing,
        isPending,
        handleSave,

        // Clause creator dialog
        showClauseCreator,
        setShowClauseCreator,
    };
}

export type UseDocumentTypeEditorReturn = ReturnType<typeof useDocumentTypeEditor>;
