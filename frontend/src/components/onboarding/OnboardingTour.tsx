/**
 * OnboardingTour - Interaktive Einführung für neue Benutzer
 *
 * v4.2 Feature (Kapitel 15.5.9):
 * - Schritt-für-Schritt Tour durch die wichtigsten Funktionen
 * - Tooltips mit Hervorhebung
 * - Fortschrittsanzeige
 * - Überspringen/Beenden möglich
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    X,
    ChevronLeft,
    ChevronRight,
    FileText,
    Settings,
    Search,
    Bell,
    Layout,
    Sparkles,
} from "lucide-react";

export interface TourStep {
    id: string;
    title: string;
    description: string;
    target?: string; // CSS selector for element to highlight
    icon: typeof FileText;
    position?: "top" | "bottom" | "left" | "right";
}

const DEFAULT_TOUR_STEPS: TourStep[] = [
    {
        id: "welcome",
        title: "Willkommen beim Document Generator!",
        description:
            "Diese kurze Tour zeigt dir die wichtigsten Funktionen. Du kannst jederzeit überspringen.",
        icon: Sparkles,
    },
    {
        id: "sidebar",
        title: "Navigation",
        description:
            "In der Seitenleiste findest du alle Bereiche: Dashboard, Dokumenterstellung, Suche und Verwaltung.",
        target: "[data-tour='sidebar']",
        icon: Layout,
        position: "right",
    },
    {
        id: "generate",
        title: "Dokument erstellen",
        description:
            "Hier erstellst du neue Dokumente. Wähle einen Typ, fülle das Formular aus und sieh dir die Live-Vorschau an.",
        target: "[data-tour='generate']",
        icon: FileText,
        position: "right",
    },
    {
        id: "search",
        title: "Globale Suche",
        description:
            "Mit Cmd/Ctrl+K öffnest du die Schnellsuche. Finde Dokumente, Textbausteine und mehr in Sekundenschnelle.",
        target: "[data-tour='search']",
        icon: Search,
        position: "bottom",
    },
    {
        id: "notifications",
        title: "Benachrichtigungen",
        description:
            "Hier siehst du wichtige Updates: Fristen, Genehmigungen und Systemhinweise.",
        target: "[data-tour='notifications']",
        icon: Bell,
        position: "bottom",
    },
    {
        id: "admin",
        title: "Administration",
        description:
            "Im Admin-Bereich verwaltest du Textbausteine, Dokumenttypen, Benutzer und Systemeinstellungen.",
        target: "[data-tour='admin']",
        icon: Settings,
        position: "right",
    },
];

interface OnboardingTourProps {
    steps?: TourStep[];
    onComplete?: () => void;
    onSkip?: () => void;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function OnboardingTour({
    steps = DEFAULT_TOUR_STEPS,
    onComplete,
    onSkip,
    isOpen: controlledIsOpen,
    onOpenChange,
}: OnboardingTourProps) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

    const isOpen = controlledIsOpen ?? internalIsOpen;
    const setIsOpen = onOpenChange ?? setInternalIsOpen;

    const step = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;
    const Icon = step?.icon || Sparkles;

    // Check if this is first visit
    useEffect(() => {
        const hasSeenTour = localStorage.getItem("onboarding_completed");
        if (!hasSeenTour && controlledIsOpen === undefined) {
            setInternalIsOpen(true);
        }
    }, [controlledIsOpen]);

    // Update highlight position when step changes
    useEffect(() => {
        if (!isOpen || !step?.target) {
            setHighlightRect(null);
            return;
        }

        const updatePosition = () => {
            const element = document.querySelector(step.target!);
            if (element) {
                setHighlightRect(element.getBoundingClientRect());
            } else {
                setHighlightRect(null);
            }
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition);

        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition);
        };
    }, [isOpen, step?.target, currentStep]);

    const handleNext = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleComplete is defined below but called lazily on user interaction
    }, [currentStep, steps.length]);

    const handlePrevious = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    }, [currentStep]);

    const handleComplete = useCallback(() => {
        localStorage.setItem("onboarding_completed", "true");
        setIsOpen(false);
        setCurrentStep(0);
        onComplete?.();
    }, [setIsOpen, onComplete]);

    const handleSkip = useCallback(() => {
        localStorage.setItem("onboarding_completed", "true");
        setIsOpen(false);
        setCurrentStep(0);
        onSkip?.();
    }, [setIsOpen, onSkip]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleSkip();
            } else if (e.key === "ArrowRight" || e.key === "Enter") {
                handleNext();
            } else if (e.key === "ArrowLeft") {
                handlePrevious();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleNext, handlePrevious, handleSkip]);

    if (!isOpen) return null;

    // Calculate tooltip position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!highlightRect) {
            return {
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            };
        }

        const padding = 16;
        const tooltipWidth = 400;
        const tooltipHeight = 250;

        switch (step?.position) {
            case "right":
                return {
                    position: "fixed",
                    top: Math.max(padding, Math.min(highlightRect.top, window.innerHeight - tooltipHeight - padding)),
                    left: highlightRect.right + padding,
                };
            case "left":
                return {
                    position: "fixed",
                    top: Math.max(padding, Math.min(highlightRect.top, window.innerHeight - tooltipHeight - padding)),
                    left: highlightRect.left - tooltipWidth - padding,
                };
            case "bottom":
                return {
                    position: "fixed",
                    top: highlightRect.bottom + padding,
                    left: Math.max(padding, Math.min(highlightRect.left, window.innerWidth - tooltipWidth - padding)),
                };
            case "top":
            default:
                return {
                    position: "fixed",
                    top: highlightRect.top - tooltipHeight - padding,
                    left: Math.max(padding, Math.min(highlightRect.left, window.innerWidth - tooltipWidth - padding)),
                };
        }
    };

    return createPortal(
        <>
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={handleSkip} />

            {/* Highlight box */}
            {highlightRect && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{
                        top: highlightRect.top - 8,
                        left: highlightRect.left - 8,
                        width: highlightRect.width + 16,
                        height: highlightRect.height + 16,
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                        borderRadius: "8px",
                        border: "2px solid #3b82f6",
                    }}
                />
            )}

            {/* Tooltip Card */}
            <Card
                className="z-[10000] w-[400px] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
                style={getTooltipStyle()}
            >
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <CardTitle className="text-lg">{step?.title}</CardTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleSkip}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="pb-4">
                    <p className="text-muted-foreground">{step?.description}</p>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                    {/* Progress */}
                    <div className="w-full flex items-center gap-3">
                        <Progress value={progress} className="flex-1 h-2" />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {currentStep + 1} / {steps.length}
                        </span>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between w-full">
                        <Button variant="ghost" onClick={handleSkip}>
                            Tour beenden
                        </Button>
                        <div className="flex gap-2">
                            {currentStep > 0 && (
                                <Button variant="outline" onClick={handlePrevious}>
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Zurück
                                </Button>
                            )}
                            <Button onClick={handleNext}>
                                {currentStep < steps.length - 1 ? (
                                    <>
                                        Weiter
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </>
                                ) : (
                                    "Fertig"
                                )}
                            </Button>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </>,
        document.body
    );
}

/**
 * Hook zum Starten der Tour programmatisch
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useOnboardingTour() {
    const [isOpen, setIsOpen] = useState(false);

    const startTour = useCallback(() => {
        setIsOpen(true);
    }, []);

    const resetTour = useCallback(() => {
        localStorage.removeItem("onboarding_completed");
    }, []);

    return { isOpen, setIsOpen, startTour, resetTour };
}
