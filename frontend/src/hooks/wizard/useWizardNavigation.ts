/**
 * useWizardNavigation - Step management, mode switching, validation
 *
 * Handles step navigation (next/prev/goTo), mode toggling (wizard/editor/split-screen),
 * step ordering with optional clauses step, and per-step validation.
 */

import { useState, useCallback, useMemo } from "react";
import type { FormData, Comment } from "@/components/generator/WizardContext";
import {
    STANDARD_STEP_ORDER,
    FULL_STEP_ORDER,
} from "@/components/generator/WizardContext";
import { logError } from "@/lib/logger";
import { getStorageKey } from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// PARAMS
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardNavigationParams {
    /** Current document type ID (needed for localStorage save on step change) */
    documentTypeId: number | null;
    /** Current form data (for validation + localStorage) */
    formData: FormData;
    /** Dynamic form values (for localStorage save) */
    dynamicFormValues: Record<string, string | number | boolean>;
    /** Document title (for localStorage save) */
    documentTitle: string;
    /** Current comments (for localStorage save) */
    comments: Comment[];
}

// ══════════════════════════════════════════════════════════════════════════════
// RETURN TYPE
// ══════════════════════════════════════════════════════════════════════════════

export interface UseWizardNavigationReturn {
    currentStep: number;
    setCurrentStep: (step: number) => void;
    mode: "wizard" | "editor" | "split-screen";
    showClausesStep: boolean;
    stepOrder: number[];
    actualStepIndex: number;
    validationErrors: Array<{ field: string; message: string }>;
    goToStep: (targetStep: number) => Promise<boolean>;
    nextStep: () => Promise<boolean>;
    prevStep: () => void;
    enterEditorMode: () => void;
    exitEditorMode: () => void;
    toggleClausesStep: () => void;
    enterSplitScreenMode: () => void;
    validateStep: (step: number) => boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOOK
// ══════════════════════════════════════════════════════════════════════════════

export function useWizardNavigation(params: UseWizardNavigationParams): UseWizardNavigationReturn {
    const { documentTypeId, formData, dynamicFormValues, documentTitle, comments } = params;

    // State
    const [currentStep, setCurrentStep] = useState(0);
    const [mode, setMode] = useState<"wizard" | "editor" | "split-screen">("wizard");
    const [showClausesStep, setShowClausesStep] = useState(false);
    const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string }>>([]);

    // Computed
    const stepOrder = useMemo(() => {
        return showClausesStep ? FULL_STEP_ORDER : STANDARD_STEP_ORDER;
    }, [showClausesStep]);

    const actualStepIndex = useMemo(() => {
        return stepOrder[currentStep] ?? currentStep;
    }, [stepOrder, currentStep]);

    // ── Validation ──────────────────────────────────────────────────────────

    const validateStep = useCallback((step: number): boolean => {
        const errors: Array<{ field: string; message: string }> = [];

        switch (step) {
            case 0: // Document Type
                if (!documentTypeId) {
                    errors.push({ field: "documentType", message: "Dokumenttyp ist erforderlich" });
                }
                break;

            case 1: // Employee Info
                if (!formData.vorname.trim()) {
                    errors.push({ field: "vorname", message: "Vorname ist erforderlich" });
                }
                if (!formData.nachname.trim()) {
                    errors.push({ field: "nachname", message: "Nachname ist erforderlich" });
                }
                break;

            case 2: // Contract Details
                if (!formData.position.trim()) {
                    errors.push({ field: "position", message: "Position ist erforderlich" });
                }
                if (!formData.gehalt || parseFloat(formData.gehalt) <= 0) {
                    errors.push({ field: "gehalt", message: "Gueltiges Gehalt ist erforderlich" });
                }
                if (!formData.eintrittsdatum) {
                    errors.push({ field: "eintrittsdatum", message: "Eintrittsdatum ist erforderlich" });
                }
                break;

            case 3: // Clauses - optional, no validation needed
                break;

            case 4: // Review
                if (!formData.signatory_name.trim()) {
                    errors.push({ field: "signatory_name", message: "Unterzeichner ist erforderlich" });
                }
                break;
        }

        setValidationErrors(errors);
        return errors.length === 0;
    }, [documentTypeId, formData]);

    // ── Navigation Actions ──────────────────────────────────────────────────

    const goToStep = useCallback(async (targetStep: number): Promise<boolean> => {
        // Validate current step before moving forward
        if (targetStep > currentStep) {
            if (!validateStep(actualStepIndex)) {
                return false;
            }
        }

        // Save to localStorage on step change (including comments)
        if (documentTypeId) {
            try {
                localStorage.setItem(getStorageKey(documentTypeId), JSON.stringify({
                    formData,
                    dynamicFormValues,
                    documentTitle,
                    comments,
                    timestamp: new Date().toISOString(),
                }));
            } catch (e) {
                logError("Failed to save to localStorage", { error: e as unknown as Record<string, unknown> });
            }
        }

        setCurrentStep(targetStep);
        return true;
    }, [currentStep, actualStepIndex, validateStep, documentTypeId, formData, dynamicFormValues, documentTitle, comments]);

    const nextStep = useCallback(async (): Promise<boolean> => {
        const maxStep = stepOrder.length - 1;
        if (currentStep >= maxStep) return false;
        return goToStep(currentStep + 1);
    }, [currentStep, stepOrder.length, goToStep]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep]);

    const enterEditorMode = useCallback(() => {
        setMode("editor");
    }, []);

    const exitEditorMode = useCallback(() => {
        setMode("wizard");
    }, []);

    const toggleClausesStep = useCallback(() => {
        setShowClausesStep(prev => !prev);
    }, []);

    const enterSplitScreenMode = useCallback(() => {
        setMode("split-screen");
    }, []);

    return {
        currentStep,
        setCurrentStep,
        mode,
        showClausesStep,
        stepOrder,
        actualStepIndex,
        validationErrors,
        goToStep,
        nextStep,
        prevStep,
        enterEditorMode,
        exitEditorMode,
        toggleClausesStep,
        enterSplitScreenMode,
        validateStep,
    };
}
