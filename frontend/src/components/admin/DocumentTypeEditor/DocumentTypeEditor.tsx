/**
 * DocumentTypeEditor
 *
 * Full editor for creating/editing document types with:
 * - Basic info (name, category, country)
 * - Clause selection with drag-and-drop ordering
 * - Variant group assignment
 */

import { AnimatePresence } from "framer-motion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    FileText,
    Check,
    ChevronRight,
    ChevronLeft,
    Save,
    Loader2,
} from "lucide-react";
import { ClauseFormDialog } from "@/components/clauses/ClauseFormDialog";
import type { DocumentTypeEditorProps } from "./types";
import { useDocumentTypeEditor } from "./useDocumentTypeEditor";
import { BasicsStep } from "./BasicsStep";
import { ClauseSelectionStep } from "./ClauseSelectionStep";
import { SummaryStep } from "./SummaryStep";

const STEP_LABELS = ["Grunddaten", "Klauseln", "\u00dcbersicht"] as const;

export const DocumentTypeEditor = ({
    open,
    onOpenChange,
    editId,
    countryCode: initialCountryCode,
    onSuccess,
}: DocumentTypeEditorProps) => {
    const editor = useDocumentTypeEditor({
        open,
        editId,
        initialCountryCode,
        onOpenChange,
        onSuccess,
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        {editor.isEditing ? "Dokumenttyp bearbeiten" : "Neuer Dokumenttyp"}
                    </DialogTitle>
                </DialogHeader>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 py-4 border-b">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div
                                className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                                    s < editor.step
                                        ? "bg-secondary text-white"
                                        : s === editor.step
                                        ? "bg-primary text-white"
                                        : "bg-warm-200 text-muted-foreground"
                                )}
                            >
                                {s < editor.step ? <Check className="w-4 h-4" /> : s}
                            </div>
                            <span
                                className={cn(
                                    "ml-2 text-sm",
                                    s === editor.step ? "text-primary font-medium" : "text-muted-foreground"
                                )}
                            >
                                {STEP_LABELS[s - 1]}
                            </span>
                            {s < 3 && (
                                <ChevronRight className="w-4 h-4 mx-4 text-warm-400" />
                            )}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4">
                    {editor.loadingDocType ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {editor.step === 1 && (
                                <BasicsStep
                                    name={editor.name}
                                    setName={editor.setName}
                                    description={editor.description}
                                    setDescription={editor.setDescription}
                                    category={editor.category}
                                    setCategory={editor.setCategory}
                                    countryCode={editor.countryCode}
                                    setCountryCode={editor.setCountryCode}
                                    isActive={editor.isActive}
                                    setIsActive={editor.setIsActive}
                                    showAdvancedSettings={editor.showAdvancedSettings}
                                    setShowAdvancedSettings={editor.setShowAdvancedSettings}
                                    defaultProbationMonths={editor.defaultProbationMonths}
                                    setDefaultProbationMonths={editor.setDefaultProbationMonths}
                                    defaultNoticePeriod={editor.defaultNoticePeriod}
                                    setDefaultNoticePeriod={editor.setDefaultNoticePeriod}
                                    defaultVacationDays={editor.defaultVacationDays}
                                    setDefaultVacationDays={editor.setDefaultVacationDays}
                                    defaultWeeklyHours={editor.defaultWeeklyHours}
                                    setDefaultWeeklyHours={editor.setDefaultWeeklyHours}
                                    errors={editor.errors}
                                />
                            )}

                            {editor.step === 2 && (
                                <ClauseSelectionStep
                                    errors={editor.errors}
                                    setErrors={editor.setErrors}
                                    selectedClauses={editor.selectedClauses}
                                    setSelectedClauses={editor.setSelectedClauses}
                                    groupedClauses={editor.groupedClauses}
                                    loadingClauses={editor.loadingClauses}
                                    addClause={editor.addClause}
                                    removeClause={editor.removeClause}
                                    toggleMandatory={editor.toggleMandatory}
                                    reorderClauses={editor.reorderClauses}
                                    selectedVariantGroups={editor.selectedVariantGroups}
                                    unselectedVariantGroups={editor.unselectedVariantGroups}
                                    loadingVariantGroups={editor.loadingVariantGroups}
                                    addVariantGroup={editor.addVariantGroup}
                                    removeVariantGroup={editor.removeVariantGroup}
                                    toggleVariantGroupMandatory={editor.toggleVariantGroupMandatory}
                                    setVariantGroupDefault={editor.setVariantGroupDefault}
                                    setShowClauseCreator={editor.setShowClauseCreator}
                                />
                            )}

                            {editor.step === 3 && (
                                <SummaryStep
                                    name={editor.name}
                                    category={editor.category}
                                    countryCode={editor.countryCode}
                                    isActive={editor.isActive}
                                    defaultProbationMonths={editor.defaultProbationMonths}
                                    defaultNoticePeriod={editor.defaultNoticePeriod}
                                    defaultVacationDays={editor.defaultVacationDays}
                                    defaultWeeklyHours={editor.defaultWeeklyHours}
                                    selectedClauses={editor.selectedClauses}
                                    selectedVariantGroups={editor.selectedVariantGroups}
                                    createError={editor.createMutation.isError ? editor.createMutation.error?.message : null}
                                    updateError={editor.updateMutation.isError ? editor.updateMutation.error?.message : null}
                                />
                            )}
                        </AnimatePresence>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="border-t pt-4">
                    <div className="flex justify-between w-full">
                        <div>
                            {editor.step > 1 && (
                                <Button variant="outline" onClick={editor.handleBack} disabled={editor.isPending}>
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Zur{"\u00fc"}ck
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={editor.isPending}
                            >
                                Abbrechen
                            </Button>
                            {editor.step < 3 ? (
                                <Button onClick={editor.handleNext} className="bg-primary hover:bg-primary/90">
                                    Weiter
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={editor.handleSave}
                                    disabled={editor.isPending}
                                    className="bg-secondary hover:bg-[#5aa86f]"
                                >
                                    {editor.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Speichern...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            {editor.isEditing ? "\u00c4nderungen speichern" : "Dokumenttyp erstellen"}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>

            {/* In-Dialog Clause Creator */}
            <ClauseFormDialog
                open={editor.showClauseCreator}
                onOpenChange={editor.setShowClauseCreator}
                defaultCountryCode={editor.countryCode}
                onSuccess={(newClause) => {
                    editor.addClause(newClause);
                    editor.setShowClauseCreator(false);
                }}
            />
        </Dialog>
    );
};
