import { useWizardContext } from "./WizardContext";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "setup", label: "Entwurf" },
  { id: "edit", label: "Bearbeitung" },
  { id: "review", label: "Prüfung" },
  { id: "export", label: "Export" },
];

export function WorkflowDots() {
  const { state } = useWizardContext();

  // Determine current step from wizard state
  const currentStep = state.hasExported ? 3 :
    state.editorContent ? 1 :
    state.documentTypeId ? 0 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i < currentStep && "bg-[var(--nw-green)]",
              i === currentStep && "bg-[var(--nw-blue)] w-3 h-3",
              i > currentStep && "bg-[var(--border)]"
            )}
            title={step.label}
          />
        ))}
      </div>
      <span className="text-sm text-[var(--text-muted)]">
        {STEPS[currentStep]?.label}
      </span>
    </div>
  );
}
