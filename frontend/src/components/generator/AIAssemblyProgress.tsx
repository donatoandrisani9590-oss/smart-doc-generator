/**
 * AIAssemblyProgress - "Lego-Prinzip" Document Assembly Visualization
 *
 * Shows a transparent, step-by-step assembly process:
 * 1. "Suche passendes Template..."
 * 2. "Lade Klauseln aus Bibliothek..."
 * 3. "Wähle Klausel 'Gehalt (Jahresbasis)'..."
 * 4. "Prüfe auf Konsistenz..."
 * 5. "Dokument zusammengebaut."
 *
 * Each step appears with animation, giving the user the feeling
 * of watching a legal expert assemble a contract from a file cabinet.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Library,
  FileCheck,
  Shield,
  CheckCircle2,
  Loader2,
  BookOpen,
  Blocks,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AssemblyStep {
  id: string;
  label: string;
  detail?: string;
  icon: React.ElementType;
  duration: number; // ms
}

interface AIAssemblyProgressProps {
  /** Clause titles being assembled (from backend response) */
  clauseTitles?: string[];
  /** Whether assembly is in progress */
  isAssembling: boolean;
  /** Called when animation completes */
  onComplete?: () => void;
  /** Total clause count for context */
  totalClauses?: number;
  className?: string;
}

export function AIAssemblyProgress({
  clauseTitles = [],
  isAssembling,
  onComplete,
  totalClauses = 0,
  className,
}: AIAssemblyProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // Build dynamic steps based on actual clause data
  const buildSteps = useCallback((): AssemblyStep[] => {
    const steps: AssemblyStep[] = [
      {
        id: "search-template",
        label: "Suche passendes Template...",
        icon: Search,
        duration: 800,
      },
      {
        id: "load-library",
        label: "Lade Klauseln aus Bibliothek...",
        detail: totalClauses > 0 ? `${totalClauses} Klauseln verfuegbar` : undefined,
        icon: Library,
        duration: 600,
      },
    ];

    // Add individual clause selection steps (max 5 shown)
    const shownClauses = clauseTitles.slice(0, 5);
    shownClauses.forEach((title, i) => {
      steps.push({
        id: `clause-${i}`,
        label: `Waehle Klausel "${title}"...`,
        icon: BookOpen,
        duration: 400,
      });
    });

    if (clauseTitles.length > 5) {
      steps.push({
        id: "clause-remaining",
        label: `...und ${clauseTitles.length - 5} weitere Klauseln`,
        icon: Blocks,
        duration: 300,
      });
    }

    steps.push(
      {
        id: "consistency",
        label: "Pruefe auf Konsistenz...",
        icon: Shield,
        duration: 700,
      },
      {
        id: "complete",
        label: "Dokument zusammengebaut",
        icon: CheckCircle2,
        duration: 0,
      }
    );

    return steps;
  }, [clauseTitles, totalClauses]);

  const steps = buildSteps();
  const progress = steps.length > 0
    ? Math.round(((currentStepIndex + 1) / steps.length) * 100)
    : 0;

  // Animate through steps
  useEffect(() => {
    if (!isAssembling) {
      setCurrentStepIndex(-1);
      setCompletedSteps([]);
      setIsFinished(false);
      return;
    }

    let stepIndex = 0;
    const currentSteps = buildSteps();

    const runStep = () => {
      if (stepIndex >= currentSteps.length) {
        setIsFinished(true);
        onComplete?.();
        return;
      }

      setCurrentStepIndex(stepIndex);
      const step = currentSteps[stepIndex];

      // Mark previous step as completed
      if (stepIndex > 0) {
        setCompletedSteps((prev) => [...prev, currentSteps[stepIndex - 1].id]);
      }

      stepIndex++;
      if (step.duration > 0) {
        setTimeout(runStep, step.duration);
      } else {
        // Last step - mark as completed after a brief pause
        setTimeout(() => {
          setCompletedSteps((prev) => [...prev, step.id]);
          setIsFinished(true);
          onComplete?.();
        }, 500);
      }
    };

    // Start after a small delay
    const timer = setTimeout(runStep, 300);
    return () => clearTimeout(timer);
  }, [isAssembling, buildSteps, onComplete]);

  if (!isAssembling && !isFinished) return null;

  return (
    <div className={cn(
      "rounded-xl border bg-card p-6 space-y-4",
      isFinished && "border-green-200 bg-green-50/50",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Blocks className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">
            {isFinished ? "Dokument zusammengebaut" : "Baue Dokument zusammen..."}
          </span>
        </div>
        <Badge variant={isFinished ? "default" : "outline"} className="text-xs">
          {isFinished ? "Fertig" : `${progress}%`}
        </Badge>
      </div>

      {/* Progress bar */}
      <Progress value={progress} className="h-1.5" />

      {/* Step list */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isDone = completedSteps.includes(step.id);
            const isVisible = index <= currentStepIndex;

            if (!isVisible && !isFinished) return null;

            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={cn(
                  "flex items-center gap-3 py-1.5 px-3 rounded-lg text-sm transition-colors",
                  isActive && "bg-primary/5 text-foreground font-medium",
                  isDone && "text-muted-foreground",
                  !isActive && !isDone && "text-muted-foreground/60"
                )}
              >
                {/* Icon */}
                <div className="flex-shrink-0 w-5 h-5">
                  {isActive && !isDone ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Label */}
                <span className="flex-1">{step.label}</span>

                {/* Detail badge */}
                {step.detail && isDone && (
                  <Badge variant="secondary" className="text-xs">
                    {step.detail}
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
