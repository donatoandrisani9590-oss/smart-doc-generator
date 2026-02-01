/**
 * ClauseFormDialog - Vollständiger Dialog für Klauselerstellung/-bearbeitung
 *
 * Features:
 * - Mehrstufiger Wizard für neue Klauseln
 * - Integrierter TipTap WYSIWYG Editor
 * - Platzhalter-Picker mit Validierung
 * - Kategorie-Auswahl mit Vorschlägen
 * - Land-Auswahl (DE/IT)
 * - Live-Vorschau
 * - Validierung vor Speicherung
 * - Warnung bei ungespeicherten Änderungen (QA Fix)
 *
 * v2.0: UX-Verbesserungen für Release
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClauseEditor } from "@/components/admin/ClauseEditor";
import {
    useCreateClause,
    useUpdateClause,
    useClauses,
    type Clause,
    type ClauseCreateRequest,
} from "@/hooks/useApi";
import {
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    Tag,
    Eye,
    Save,
    X,
    Info,
    Lightbulb,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClauseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editClause?: Clause | null; // Wenn vorhanden, Bearbeitungsmodus
    defaultCountryCode?: string;
    onSuccess?: (clause: Clause) => void;
}

type WizardStep = "basics" | "content" | "preview";

const CATEGORIES = [
    // Arbeitsvertrag-Kategorien
    { value: "Einleitung", label: "Einleitung", description: "Allgemeine Einleitungstexte", group: "Arbeitsvertrag" },
    { value: "Arbeitszeit", label: "Arbeitszeit", description: "Regelungen zur Arbeitszeit", group: "Arbeitsvertrag" },
    { value: "Vergütung", label: "Vergütung", description: "Gehalt und Zusatzleistungen", group: "Arbeitsvertrag" },
    { value: "Urlaub", label: "Urlaub", description: "Urlaubsregelungen", group: "Arbeitsvertrag" },
    { value: "Kündigung", label: "Kündigung", description: "Kündigungsfristen und -bedingungen", group: "Arbeitsvertrag" },
    { value: "Geheimhaltung", label: "Geheimhaltung", description: "Vertraulichkeitsklauseln", group: "Arbeitsvertrag" },
    { value: "Wettbewerb", label: "Wettbewerb", description: "Wettbewerbsverbote", group: "Arbeitsvertrag" },
    { value: "Nebenleistungen", label: "Nebenleistungen", description: "Benefits und Zusatzleistungen", group: "Arbeitsvertrag" },
    // HR-Korrespondenz-Kategorien (NEU)
    { value: "Einladung", label: "Einladung", description: "Einladungsschreiben", group: "HR-Korrespondenz" },
    { value: "Mitteilung", label: "Mitteilung", description: "Allgemeine Mitteilungen", group: "HR-Korrespondenz" },
    { value: "Fürsorge", label: "Fürsorge", description: "Fürsorgegespräche, BEM", group: "HR-Korrespondenz" },
    { value: "Abmahnung", label: "Abmahnung", description: "Abmahnungen und Verwarnungen", group: "HR-Korrespondenz" },
    { value: "Zeugnis", label: "Zeugnis", description: "Arbeitszeugnisse", group: "HR-Korrespondenz" },
    // Allgemein
    { value: "Sonstiges", label: "Sonstiges", description: "Weitere Klauseln", group: "Allgemein" },
];

const COUNTRIES = [
    { value: "DE", label: "Deutschland", flag: "🇩🇪" },
    { value: "IT", label: "Italien", flag: "🇮🇹" },
];

export const ClauseFormDialog = ({
    open,
    onOpenChange,
    editClause,
    defaultCountryCode = "DE",
    onSuccess,
}: ClauseFormDialogProps) => {
    const isEditMode = !!editClause;

    // Form State
    const [currentStep, setCurrentStep] = useState<WizardStep>("basics");
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [customCategory, setCustomCategory] = useState("");
    const [countryCode, setCountryCode] = useState(defaultCountryCode);
    const [content, setContent] = useState("");
    const [isActive, setIsActive] = useState(true);

    // Validation State
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // ═══════════════════════════════════════════════════════════════════════════
    // UNSAVED CHANGES TRACKING (QA Critical Fix)
    // ═══════════════════════════════════════════════════════════════════════════
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const initialValuesRef = useRef<{
        title: string;
        category: string;
        content: string;
    } | null>(null);

    // Track if user has made changes
    const hasUnsavedChanges = useCallback(() => {
        if (!initialValuesRef.current) return false;
        return (
            title !== initialValuesRef.current.title ||
            category !== initialValuesRef.current.category ||
            content !== initialValuesRef.current.content
        );
    }, [title, category, content]);

    // Handle close attempt with unsaved changes
    const handleCloseAttempt = useCallback((shouldClose: boolean) => {
        if (!shouldClose) {
            // Dialog is being closed
            if (hasUnsavedChanges()) {
                setShowDiscardDialog(true);
            } else {
                onOpenChange(false);
            }
        } else {
            onOpenChange(true);
        }
    }, [hasUnsavedChanges, onOpenChange]);

    // Confirm discard
    const handleConfirmDiscard = useCallback(() => {
        setShowDiscardDialog(false);
        onOpenChange(false);
    }, [onOpenChange]);

    // API Hooks
    const createMutation = useCreateClause();
    const updateMutation = useUpdateClause();
    const { data: existingClauses } = useClauses(countryCode);

    // Initialize form when editing
    useEffect(() => {
        if (editClause) {
            setTitle(editClause.title || "");
            setCategory(editClause.category || "");
            setCountryCode(editClause.country_code || "DE");
            setContent(editClause.content || "");
            setIsActive(editClause.is_active);
            setCurrentStep("content"); // Skip to content in edit mode
            // Store initial values for change detection
            initialValuesRef.current = {
                title: editClause.title || "",
                category: editClause.category || "",
                content: editClause.content || "",
            };
        } else {
            // Reset form for new clause
            setTitle("");
            setCategory("");
            setCustomCategory("");
            setCountryCode(defaultCountryCode);
            setContent("");
            setIsActive(true);
            setCurrentStep("basics");
            setErrors({});
            setTouched({});
            // Store initial values (empty)
            initialValuesRef.current = {
                title: "",
                category: "",
                content: "",
            };
        }
    }, [editClause, defaultCountryCode, open]);

    // Validation
    const validateBasics = useCallback(() => {
        const newErrors: Record<string, string> = {};

        if (!title.trim()) {
            newErrors.title = "Titel ist erforderlich";
        } else if (title.length < 3) {
            newErrors.title = "Titel muss mindestens 3 Zeichen haben";
        } else if (title.length > 200) {
            newErrors.title = "Titel darf maximal 200 Zeichen haben";
        }

        // Check for duplicate titles
        const effectiveCategory = category === "custom" ? customCategory : category;
        const duplicate = existingClauses?.find(
            (c: Clause) =>
                c.title?.toLowerCase() === title.toLowerCase() &&
                c.id !== editClause?.id
        );
        if (duplicate) {
            newErrors.title = "Eine Klausel mit diesem Titel existiert bereits";
        }

        if (!effectiveCategory) {
            newErrors.category = "Kategorie ist erforderlich";
        }

        if (category === "custom" && !customCategory.trim()) {
            newErrors.customCategory = "Bitte geben Sie eine Kategorie ein";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [title, category, customCategory, existingClauses, editClause]);

    const validateContent = useCallback(() => {
        const newErrors: Record<string, string> = {};

        // Strip HTML tags and check for actual content
        const textContent = content.replace(/<[^>]*>/g, "").trim();
        if (!textContent) {
            newErrors.content = "Klauseltext ist erforderlich";
        } else if (textContent.length < 10) {
            newErrors.content = "Klauseltext muss mindestens 10 Zeichen haben";
        }

        setErrors((prev) => ({ ...prev, ...newErrors }));
        return !newErrors.content;
    }, [content]);

    // Navigation
    const canProceedToContent = title.trim() && (category === "custom" ? customCategory.trim() : category);
    const canProceedToPreview = content.replace(/<[^>]*>/g, "").trim().length >= 10;

    const handleNext = () => {
        if (currentStep === "basics") {
            setTouched({ title: true, category: true, customCategory: true });
            if (validateBasics()) {
                setCurrentStep("content");
            }
        } else if (currentStep === "content") {
            setTouched((prev) => ({ ...prev, content: true }));
            if (validateContent()) {
                setCurrentStep("preview");
            }
        }
    };

    const handleBack = () => {
        if (currentStep === "content") {
            setCurrentStep("basics");
        } else if (currentStep === "preview") {
            setCurrentStep("content");
        }
    };

    // Save
    const handleSave = async () => {
        if (!validateBasics() || !validateContent()) {
            return;
        }

        const effectiveCategory = category === "custom" ? customCategory : category;

        const clauseData: ClauseCreateRequest = {
            title: title.trim(),
            content_html: content,
            country_code: countryCode,
            category: effectiveCategory,
            is_active: isActive,
        };

        try {
            let result;
            if (isEditMode && editClause) {
                result = await updateMutation.mutateAsync({
                    id: editClause.id,
                    data: clauseData,
                });
            } else {
                result = await createMutation.mutateAsync(clauseData);
            }

            onSuccess?.(result);
            onOpenChange(false);
        } catch (error) {
            // Error is handled by mutation
            console.error("Save failed:", error);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const saveError = createMutation.error || updateMutation.error;

    // Render step indicator
    const renderStepIndicator = () => {
        const steps = [
            { key: "basics", label: "Grundlagen", icon: Tag },
            { key: "content", label: "Inhalt", icon: FileText },
            { key: "preview", label: "Vorschau", icon: Eye },
        ];

        const currentIndex = steps.findIndex((s) => s.key === currentStep);

        return (
            <div className="flex items-center justify-center gap-2 mb-6">
                {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = step.key === currentStep;
                    const isCompleted = index < currentIndex;

                    return (
                        <div key={step.key} className="flex items-center">
                            <button
                                type="button"
                                onClick={() => {
                                    // Only allow going back
                                    if (index < currentIndex) {
                                        setCurrentStep(step.key as WizardStep);
                                    }
                                }}
                                disabled={index > currentIndex}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
                                    isActive && "bg-primary text-white",
                                    isCompleted && "bg-secondary/20 text-secondary cursor-pointer hover:bg-secondary/30",
                                    !isActive && !isCompleted && "text-muted-foreground"
                                )}
                            >
                                {isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Icon className="w-4 h-4" />
                                )}
                                <span className="text-sm font-medium hidden sm:inline">
                                    {step.label}
                                </span>
                            </button>
                            {index < steps.length - 1 && (
                                <ChevronRight className="w-4 h-4 mx-2 text-border" />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Step: Basics
    const renderBasicsStep = () => (
        <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="title" className="text-sm font-medium">
                        Titel der Klausel <span className="text-red-500">*</span>
                    </Label>
                    <span className={cn(
                        "text-xs",
                        title.length > 180 ? "text-amber-600 font-medium" : "text-muted-foreground",
                        title.length > 200 && "text-red-500 font-medium"
                    )}>
                        {title.length}/200
                    </span>
                </div>
                <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 200))}
                    onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                    placeholder="z.B. Arbeitszeit Vollzeit 40h"
                    className={cn(
                        "text-base",
                        touched.title && errors.title && "border-red-500 focus-visible:ring-red-500"
                    )}
                    autoFocus
                    maxLength={200}
                />
                {touched.title && errors.title && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.title}
                    </p>
                )}
                <p className="text-xs text-muted-foreground">
                    Wählen Sie einen eindeutigen, beschreibenden Titel
                </p>
            </div>

            {/* Category */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    Kategorie <span className="text-red-500">*</span>
                </Label>
                <Select
                    value={category}
                    onValueChange={(value) => {
                        setCategory(value);
                        if (value !== "custom") setCustomCategory("");
                    }}
                >
                    <SelectTrigger className={cn(
                        "w-full",
                        touched.category && errors.category && "border-red-500 focus:ring-red-500"
                    )}>
                        <SelectValue placeholder="Kategorie auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground px-2">Arbeitsvertrag</SelectLabel>
                            {CATEGORIES.filter(c => c.group === "Arbeitsvertrag").map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    <div className="flex items-center gap-2">
                                        <span>{cat.label}</span>
                                        <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground px-2">HR-Korrespondenz</SelectLabel>
                            {CATEGORIES.filter(c => c.group === "HR-Korrespondenz").map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    <div className="flex items-center gap-2">
                                        <span>{cat.label}</span>
                                        <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground px-2">Allgemein</SelectLabel>
                            {CATEGORIES.filter(c => c.group === "Allgemein").map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                    <div className="flex items-center gap-2">
                                        <span>{cat.label}</span>
                                        <span className="text-xs text-muted-foreground">- {cat.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-xs text-muted-foreground px-2">Eigene</SelectLabel>
                            <SelectItem value="custom">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3 h-3" />
                                    <span>Eigene Kategorie anlegen</span>
                                </div>
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>

                {category === "custom" && (
                    <Input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        onBlur={() => setTouched((prev) => ({ ...prev, customCategory: true }))}
                        placeholder="Name der neuen Kategorie"
                        className={cn(
                            "mt-2",
                            touched.customCategory && errors.customCategory && "border-red-500"
                        )}
                        autoFocus
                    />
                )}

                {touched.category && errors.category && (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.category}
                    </p>
                )}
            </div>

            {/* Country */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">
                    Land <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                    {COUNTRIES.map((country) => (
                        <button
                            key={country.value}
                            type="button"
                            onClick={() => setCountryCode(country.value)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-all",
                                countryCode === country.value
                                    ? "border-primary bg-primary/5 ring-1 ring-[#243186]"
                                    : "border-border hover:border-primary/50"
                            )}
                        >
                            <span className="text-lg">{country.flag}</span>
                            <span className="font-medium text-sm">{country.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tips */}
            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-2">
                        <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-foreground">
                            <strong>Tipp:</strong> Verwenden Sie eindeutige Titel, die den Inhalt
                            der Klausel beschreiben. Das erleichtert das spätere Auffinden.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    // Step: Content
    const renderContentStep = () => (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-foreground">Klauseltext bearbeiten</h3>
                    <p className="text-sm text-muted-foreground">
                        Verwenden Sie Platzhalter wie {"{{mitarbeiter_name}}"} für variable Felder
                    </p>
                </div>
                <Badge variant="outline" className="bg-primary/5">
                    {countryCode === "DE" ? "🇩🇪 Deutsch" : "🇮🇹 Italienisch"}
                </Badge>
            </div>

            <ClauseEditor
                content={content}
                onChange={setContent}
                countryCode={countryCode}
                strictMode={true}
            />

            {touched.content && errors.content && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.content}
                </p>
            )}

            <Card className="bg-amber-50 border-amber-200">
                <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-amber-800">
                            <strong>Hinweis:</strong> Die Platzhalter-Validierung erfolgt automatisch
                            beim Speichern. Tippfehler werden erkannt und Korrekturvorschläge angezeigt.
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    // Step: Preview
    const renderPreviewStep = () => {
        const effectiveCategory = category === "custom" ? customCategory : category;

        return (
            <div className="space-y-4">
                <Card className="border-primary/20">
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            {/* Title */}
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Titel
                                </Label>
                                <p className="text-lg font-semibold text-foreground">{title}</p>
                            </div>

                            {/* Metadata */}
                            <div className="flex flex-wrap gap-2">
                                <Badge className="bg-primary/10 text-primary">
                                    {effectiveCategory}
                                </Badge>
                                <Badge className="bg-secondary/10 text-secondary">
                                    {countryCode === "DE" ? "🇩🇪 Deutschland" : "🇮🇹 Italien"}
                                </Badge>
                                <Badge
                                    className={cn(
                                        isActive
                                            ? "bg-green-100 text-green-700"
                                            : "bg-gray-100 text-gray-500"
                                    )}
                                >
                                    {isActive ? "Aktiv" : "Inaktiv"}
                                </Badge>
                            </div>

                            {/* Content Preview */}
                            <div>
                                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                                    Vorschau
                                </Label>
                                <div className="mt-2 p-4 bg-background rounded-lg">
                                    <div
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: content }}
                                    />
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div>
                                    <Label className="font-medium">Status</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Inaktive Klauseln sind nicht in Dokumenttypen verfügbar
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsActive(!isActive)}
                                    className={cn(
                                        "relative w-12 h-6 rounded-full transition-colors",
                                        isActive ? "bg-secondary" : "bg-border"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow",
                                            isActive ? "translate-x-7" : "translate-x-1"
                                        )}
                                    />
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {saveError && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="py-3 px-4">
                            <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {saveError.message || "Fehler beim Speichern"}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        );
    };

    return (
        <>
            <Dialog open={open} onOpenChange={handleCloseAttempt}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {isEditMode ? (
                                <>
                                    <FileText className="w-5 h-5 text-primary" />
                                    Textbaustein bearbeiten
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    Neuen Textbaustein erstellen
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? "Bearbeiten Sie den Textbaustein und seinen Inhalt"
                                : "Erstellen Sie einen neuen wiederverwendbaren Textbaustein für Ihre Dokumente"}
                        </DialogDescription>
                    </DialogHeader>

                {!isEditMode && renderStepIndicator()}

                <div className="py-2">
                    {currentStep === "basics" && renderBasicsStep()}
                    {currentStep === "content" && renderContentStep()}
                    {currentStep === "preview" && renderPreviewStep()}
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
                    {/* Cancel */}
                    <Button
                        variant="ghost"
                        onClick={() => handleCloseAttempt(false)}
                        disabled={isSaving}
                        className="sm:mr-auto"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Abbrechen
                    </Button>

                    {/* Back */}
                    {(currentStep !== "basics" || isEditMode) && (
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={isSaving || (currentStep === "basics" && !isEditMode)}
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Zurück
                        </Button>
                    )}

                    {/* Next / Save */}
                    {currentStep === "preview" || isEditMode ? (
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {isEditMode ? "Änderungen speichern" : "Klausel erstellen"}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleNext}
                            disabled={
                                (currentStep === "basics" && !canProceedToContent) ||
                                (currentStep === "content" && !canProceedToPreview)
                            }
                            className="bg-primary hover:bg-primary/90"
                        >
                            Weiter
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>

            {/* Discard Changes Confirmation Dialog */}
            <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Ungespeicherte Änderungen
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Sie haben Änderungen vorgenommen, die noch nicht gespeichert wurden.
                            Wenn Sie fortfahren, gehen diese Änderungen verloren.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Zurück zur Bearbeitung</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDiscard}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Änderungen verwerfen
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
