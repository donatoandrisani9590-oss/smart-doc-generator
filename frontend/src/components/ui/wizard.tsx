/**
 * Wizard Component
 *
 * Mehrstufige Formular-Navigation für komplexe Workflows.
 * Zeigt Fortschritt, ermöglicht Navigation zwischen Schritten
 * und validiert jeden Schritt vor dem Weiterschalten.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WizardStep {
    /** Eindeutige ID */
    id: string;
    /** Anzeige-Label */
    label: string;
    /** Optionales Icon */
    icon?: LucideIcon;
    /** Optionale Beschreibung */
    description?: string;
    /** Ist dieser Schritt optional? */
    optional?: boolean;
    /** Validierungsfunktion - gibt true zurück wenn valide */
    validate?: () => boolean | Promise<boolean>;
}

export interface WizardProps {
    /** Liste der Schritte */
    steps: WizardStep[];
    /** Aktueller Schritt-Index (controlled) */
    currentStep?: number;
    /** Callback bei Schrittwechsel */
    onStepChange?: (step: number) => void;
    /** Callback beim Abschluss */
    onComplete?: () => void;
    /** Callback beim Abbrechen */
    onCancel?: () => void;
    /** Inhalt für jeden Schritt */
    children: React.ReactNode;
    /** Zeige Step-Navigation (Punkte/Schritte) */
    showStepIndicator?: boolean;
    /** Erlaube direktes Klicken auf Schritte */
    allowStepClick?: boolean;
    /** Label für den Abschluss-Button */
    completeLabel?: string;
    /** Label für den Weiter-Button */
    nextLabel?: string;
    /** Label für den Zurück-Button */
    backLabel?: string;
    /** Label für den Abbrechen-Button */
    cancelLabel?: string;
    /** Zusätzliche CSS-Klassen */
    className?: string;
}

const stepVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 50 : -50,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 50 : -50,
        opacity: 0,
    }),
};

const stepTransition = {
    x: { type: "spring", stiffness: 300, damping: 30 },
    opacity: { duration: 0.2 },
};

/**
 * Step Indicator (Fortschrittsanzeige)
 */
const StepIndicator = ({
    steps,
    currentStep,
    allowClick,
    onStepClick,
}: {
    steps: WizardStep[];
    currentStep: number;
    allowClick: boolean;
    onStepClick: (index: number) => void;
}) => {
    return (
        <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;
                const Icon = step.icon;

                return (
                    <React.Fragment key={step.id}>
                        {/* Step Circle */}
                        <button
                            type="button"
                            onClick={() => allowClick && onStepClick(index)}
                            disabled={!allowClick || index > currentStep}
                            className={cn(
                                "flex items-center gap-2 transition-all",
                                allowClick && index <= currentStep
                                    ? "cursor-pointer"
                                    : "cursor-default"
                            )}
                            aria-label={`Schritt ${index + 1}: ${step.label}`}
                            aria-current={isActive ? "step" : undefined}
                        >
                            <motion.div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                                    isCompleted
                                        ? "bg-secondary text-secondary-foreground"
                                        : isActive
                                          ? "bg-primary text-primary-foreground shadow-md"
                                          : "bg-muted text-muted-foreground"
                                )}
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.1 : 1,
                                }}
                                transition={{ type: "spring", stiffness: 500 }}
                            >
                                {isCompleted ? (
                                    <Check className="w-5 h-5" aria-hidden="true" />
                                ) : Icon ? (
                                    <Icon className="w-5 h-5" aria-hidden="true" />
                                ) : (
                                    index + 1
                                )}
                            </motion.div>

                            {/* Step Label (nur auf Desktop) */}
                            <div className="hidden md:block text-left">
                                <p
                                    className={cn(
                                        "text-sm font-medium",
                                        isActive ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </p>
                                {step.optional && (
                                    <p className="text-xs text-muted-foreground">Optional</p>
                                )}
                            </div>
                        </button>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <div
                                className={cn(
                                    "h-0.5 w-8 md:w-16 transition-colors",
                                    index < currentStep ? "bg-secondary" : "bg-muted"
                                )}
                                aria-hidden="true"
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

/**
 * Progress Bar (Alternative zu Step Indicator)
 */
export const WizardProgressBar = ({
    steps,
    currentStep,
}: {
    steps: WizardStep[];
    currentStep: number;
}) => {
    const progress = ((currentStep + 1) / steps.length) * 100;

    return (
        <div className="mb-6">
            <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                    {steps[currentStep]?.label}
                </span>
                <span className="text-sm text-muted-foreground">
                    Schritt {currentStep + 1} von {steps.length}
                </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
        </div>
    );
};

/**
 * Wizard Component
 */
export const Wizard = ({
    steps,
    currentStep: controlledStep,
    onStepChange,
    onComplete,
    onCancel,
    children,
    showStepIndicator = true,
    allowStepClick = false,
    completeLabel = "Abschließen",
    nextLabel = "Weiter",
    backLabel = "Zurück",
    cancelLabel = "Abbrechen",
    className,
}: WizardProps) => {
    const [internalStep, setInternalStep] = React.useState(0);
    const [direction, setDirection] = React.useState(0);
    const [isValidating, setIsValidating] = React.useState(false);

    // Controlled or uncontrolled
    const currentStep = controlledStep !== undefined ? controlledStep : internalStep;
    const setCurrentStep = onStepChange || setInternalStep;

    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    // Get children as array
    const childrenArray = React.Children.toArray(children);

    // Navigate to step
    const goToStep = React.useCallback(
        async (newStep: number) => {
            if (newStep < 0 || newStep >= steps.length) return;

            // Validate current step before moving forward
            if (newStep > currentStep) {
                const currentStepConfig = steps[currentStep];
                if (currentStepConfig.validate) {
                    setIsValidating(true);
                    try {
                        const isValid = await currentStepConfig.validate();
                        if (!isValid) {
                            setIsValidating(false);
                            return;
                        }
                    } catch {
                        setIsValidating(false);
                        return;
                    }
                    setIsValidating(false);
                }
            }

            setDirection(newStep > currentStep ? 1 : -1);
            setCurrentStep(newStep);
        },
        [currentStep, steps, setCurrentStep]
    );

    // Navigation handlers
    const handleNext = async () => {
        if (isLastStep) {
            // Validate last step before completing
            const lastStepConfig = steps[currentStep];
            if (lastStepConfig.validate) {
                setIsValidating(true);
                try {
                    const isValid = await lastStepConfig.validate();
                    if (!isValid) {
                        setIsValidating(false);
                        return;
                    }
                } catch {
                    setIsValidating(false);
                    return;
                }
                setIsValidating(false);
            }
            onComplete?.();
        } else {
            goToStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        goToStep(currentStep - 1);
    };

    const handleStepClick = (index: number) => {
        if (index <= currentStep) {
            goToStep(index);
        }
    };

    return (
        <div className={cn("w-full", className)}>
            {/* Step Indicator */}
            {showStepIndicator && (
                <StepIndicator
                    steps={steps}
                    currentStep={currentStep}
                    allowClick={allowStepClick}
                    onStepClick={handleStepClick}
                />
            )}

            {/* Step Content */}
            <div className="relative overflow-hidden min-h-[200px]">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={stepTransition}
                    >
                        {childrenArray[currentStep]}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <div>
                    {onCancel && isFirstStep && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onCancel}
                            disabled={isValidating}
                        >
                            {cancelLabel}
                        </Button>
                    )}
                    {!isFirstStep && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleBack}
                            disabled={isValidating}
                            className="gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                            {backLabel}
                        </Button>
                    )}
                </div>

                <Button
                    type="button"
                    onClick={handleNext}
                    disabled={isValidating}
                    className="gap-2"
                >
                    {isValidating ? (
                        "Prüfe..."
                    ) : isLastStep ? (
                        completeLabel
                    ) : (
                        <>
                            {nextLabel}
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

/**
 * WizardStep Content Wrapper
 * Optional wrapper for step content with consistent styling
 */
export const WizardStepContent = ({
    title,
    description,
    children,
    className,
}: {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) => {
    return (
        <div className={cn("space-y-6", className)}>
            {(title || description) && (
                <div className="space-y-2">
                    {title && (
                        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    )}
                    {description && (
                        <p className="text-sm text-muted-foreground">{description}</p>
                    )}
                </div>
            )}
            {children}
        </div>
    );
};

export default Wizard;
