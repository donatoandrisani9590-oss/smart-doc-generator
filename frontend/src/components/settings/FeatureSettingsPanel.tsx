/**
 * FeatureSettingsPanel - UI for managing feature toggles
 *
 * Features:
 * - Grouped by category
 * - Toggle switches for each feature
 * - Reset to defaults button
 * - Optional features marked clearly
 */

import { useState } from "react";
import {
  FileText,
  Clock,
  Activity,
  Upload,
  Brain,
  CheckSquare,
  Wand2,
  Shield,
  MessageSquare,
  Zap,
  Sidebar,
  LayoutDashboard,
  GitBranch,
  Sparkles,
  Monitor,
  RotateCcw,
  Loader2,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useFeatureSettings, FeatureKey } from "@/hooks/useFeatureSettings";
import { toast } from "sonner";

// Icon mapping
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Clock,
  Activity,
  Upload,
  Brain,
  CheckSquare,
  Wand2,
  Shield,
  MessageSquare,
  Zap,
  Sidebar,
  LayoutDashboard,
  GitBranch,
  Sparkles,
  Monitor,
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  documents: FileText,
  workflow: GitBranch,
  ai: Sparkles,
  ui: Monitor,
};

export function FeatureSettingsPanel() {
  const {
    categories,
    isLoading,
    error,
    toggleFeature,
    resetToDefaults,
  } = useFeatureSettings();

  const [togglingFeatures, setTogglingFeatures] = useState<Set<string>>(new Set());
  const [isResetting, setIsResetting] = useState(false);

  const handleToggle = async (featureKey: string, enabled: boolean) => {
    setTogglingFeatures((prev) => new Set(prev).add(featureKey));

    try {
      await toggleFeature(featureKey as FeatureKey, enabled);
      toast.success(
        enabled ? "Funktion aktiviert" : "Funktion deaktiviert",
        { duration: 2000 }
      );
    } catch {
      toast.error("Fehler beim Ändern der Einstellung");
    } finally {
      setTogglingFeatures((prev) => {
        const next = new Set(prev);
        next.delete(featureKey);
        return next;
      });
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetToDefaults();
      toast.success("Alle Einstellungen wurden zurückgesetzt");
    } catch {
      toast.error("Fehler beim Zurücksetzen");
    } finally {
      setIsResetting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Funktionen</h2>
            <p className="text-sm text-muted-foreground">
              Aktivieren oder deaktivieren Sie Funktionen nach Bedarf
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Zurücksetzen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Einstellungen zurücksetzen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Alle Funktionen werden auf die Standardeinstellungen zurückgesetzt
                  (alle aktiviert). Diese Aktion kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} disabled={isResetting}>
                  {isResetting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Zurücksetzen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Categories */}
        {categories.map((category) => {
          const CategoryIcon = CATEGORY_ICONS[category.key] || LayoutDashboard;

          return (
            <Card key={category.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon className="w-5 h-5 text-muted-foreground" />
                  <CardTitle className="text-base">{category.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.features.map((feature) => {
                  const FeatureIcon = ICONS[feature.icon] || FileText;
                  const isToggling = togglingFeatures.has(feature.key);

                  return (
                    <div
                      key={feature.key}
                      className="flex items-start justify-between gap-4 py-2"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-lg mt-0.5">
                          <FeatureIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {feature.label}
                            </span>
                            {feature.optional && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="secondary" className="text-xs gap-1">
                                    <Info className="w-3 h-3" />
                                    Optional
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Diese Funktion ist freiwillig und nicht verpflichtend
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isToggling && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(checked) =>
                            handleToggle(feature.key, checked)
                          }
                          disabled={isToggling}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}

        {/* Info Box */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Hinweis</p>
                <p>
                  Alle Funktionen sind standardmäßig aktiviert. Sie können nicht
                  benötigte Funktionen jederzeit deaktivieren, um die Benutzeroberfläche
                  zu vereinfachen. Der Genehmigungsworkflow ist optional und wird nur
                  bei Bedarf gestartet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export default FeatureSettingsPanel;
