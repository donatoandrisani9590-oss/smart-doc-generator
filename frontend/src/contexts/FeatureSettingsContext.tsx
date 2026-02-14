/**
 * FeatureSettingsContext - Centralized feature toggle state
 *
 * FIXES P0 Bug: Prevents API flooding by caching settings in Context.
 * Settings are fetched ONCE on app load and shared across all components.
 *
 * Usage:
 * - Wrap app with <FeatureSettingsProvider>
 * - Use useFeatureSettings() hook in components
 * - Use useFeatureEnabled(key) for simple checks
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  enabled: boolean;
  optional?: boolean;
}

export interface FeatureCategory {
  key: string;
  label: string;
  icon: string;
  features: FeatureDefinition[];
}

export interface FeatureSettingsResponse {
  categories: FeatureCategory[];
  raw_settings: Record<string, boolean>;
}

export type FeatureKey =
  | "show_documents_overview"
  | "show_deadlines_widget"
  | "show_activity_feed"
  | "enable_document_upload"
  | "enable_ai_extraction"
  | "enable_approval_workflow"
  | "enable_smart_mode"
  | "enable_compliance_scanner"
  | "enable_chat_assistant"
  | "enable_ai_streaming"
  | "enable_ghostwriter"
  | "show_quick_templates"
  | "compact_sidebar";

// Default settings (all enabled except compact_sidebar)
export const DEFAULT_SETTINGS: Record<FeatureKey, boolean> = {
  show_documents_overview: true,
  show_deadlines_widget: true,
  show_activity_feed: true,
  enable_document_upload: true,
  enable_ai_extraction: true,
  enable_approval_workflow: true,
  enable_smart_mode: true,
  enable_compliance_scanner: true,
  enable_chat_assistant: true,
  enable_ai_streaming: true,
  enable_ghostwriter: true,
  show_quick_templates: true,
  compact_sidebar: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

export interface FeatureSettingsContextValue {
  categories: FeatureCategory[];
  settings: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
  isEnabled: (feature: FeatureKey) => boolean;
  toggleFeature: (feature: FeatureKey, enabled: boolean) => Promise<void>;
  updateSettings: (updates: Partial<Record<FeatureKey, boolean>>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FeatureSettingsContext = createContext<FeatureSettingsContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface FeatureSettingsProviderProps {
  children: ReactNode;
}

export function FeatureSettingsProvider({ children }: FeatureSettingsProviderProps) {
  const [categories, setCategories] = useState<FeatureCategory[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch settings from server (only once)
  const fetchSettings = useCallback(async () => {
    // Prevent duplicate fetches
    if (hasFetched && !error) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<FeatureSettingsResponse>("/api/v1/feature-settings");
      setCategories(response.data.categories);
      setSettings(response.data.raw_settings);
      setHasFetched(true);
    } catch (err) {
      console.error("Failed to load feature settings:", err);
      setError("Einstellungen konnten nicht geladen werden");
      // Use defaults on error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, [hasFetched, error]);

  // Initial load
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Check if feature is enabled
  const isEnabled = useCallback(
    (feature: FeatureKey): boolean => {
      return settings[feature] ?? DEFAULT_SETTINGS[feature] ?? true;
    },
    [settings]
  );

  // Toggle single feature
  const toggleFeature = useCallback(
    async (feature: FeatureKey, enabled: boolean) => {
      const previousSettings = { ...settings };
      setSettings((prev) => ({ ...prev, [feature]: enabled }));

      try {
        const response = await api.patch<FeatureSettingsResponse>(
          `/api/v1/feature-settings/${feature}`,
          { enabled }
        );
        setCategories(response.data.categories);
        setSettings(response.data.raw_settings);
      } catch (err) {
        console.error("Failed to toggle feature:", err);
        setSettings(previousSettings);
        toast.error("Einstellung konnte nicht geändert werden");
        throw err;
      }
    },
    [settings]
  );

  // Update multiple features
  const updateSettings = useCallback(
    async (updates: Partial<Record<FeatureKey, boolean>>) => {
      const previousSettings = { ...settings };
      setSettings((prev) => ({ ...prev, ...updates }));

      try {
        const response = await api.put<FeatureSettingsResponse>(
          "/api/v1/feature-settings",
          { settings: updates }
        );
        setCategories(response.data.categories);
        setSettings(response.data.raw_settings);
      } catch (err) {
        console.error("Failed to update settings:", err);
        setSettings(previousSettings);
        toast.error("Einstellungen konnten nicht gespeichert werden");
        throw err;
      }
    },
    [settings]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    try {
      const response = await api.post<FeatureSettingsResponse>(
        "/api/v1/feature-settings/reset"
      );
      setCategories(response.data.categories);
      setSettings(response.data.raw_settings);
    } catch (err) {
      console.error("Failed to reset settings:", err);
      toast.error("Zurücksetzen fehlgeschlagen");
      throw err;
    }
  }, []);

  // Force refresh (for manual reload)
  const refresh = useCallback(async () => {
    setHasFetched(false);
    await fetchSettings();
  }, [fetchSettings]);

  const value = useMemo(
    () => ({
      categories,
      settings,
      isLoading,
      error,
      isEnabled,
      toggleFeature,
      updateSettings,
      resetToDefaults,
      refresh,
    }),
    [
      categories,
      settings,
      isLoading,
      error,
      isEnabled,
      toggleFeature,
      updateSettings,
      resetToDefaults,
      refresh,
    ]
  );

  return (
    <FeatureSettingsContext.Provider value={value}>
      {children}
    </FeatureSettingsContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full feature settings hook with all actions
 */
export function useFeatureSettings(): FeatureSettingsContextValue {
  const context = useContext(FeatureSettingsContext);

  if (!context) {
    throw new Error("useFeatureSettings must be used within FeatureSettingsProvider");
  }

  return context;
}

/**
 * Simple hook for checking a single feature
 * Returns default (true) if context not available or loading
 */
export function useFeatureEnabled(feature: FeatureKey): boolean {
  const context = useContext(FeatureSettingsContext);

  // Graceful fallback if used outside provider
  if (!context) {
    console.warn("useFeatureEnabled used outside FeatureSettingsProvider, using defaults");
    return DEFAULT_SETTINGS[feature] ?? true;
  }

  // Return default while loading
  if (context.isLoading) {
    return DEFAULT_SETTINGS[feature] ?? true;
  }

  return context.isEnabled(feature);
}

// Note: DEFAULT_SETTINGS and FeatureSettingsContextValue are exported above
