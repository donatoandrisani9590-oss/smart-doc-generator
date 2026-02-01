/**
 * useFeatureSettings - Hook for feature toggle management
 *
 * Provides:
 * - Feature settings state
 * - Toggle functions
 * - Feature checks for conditional rendering
 *
 * All features default to enabled (opt-out model).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";

// Types
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

// Feature keys for type safety
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
  | "show_quick_templates"
  | "compact_sidebar";

// Default settings (all enabled)
const DEFAULT_SETTINGS: Record<FeatureKey, boolean> = {
  show_documents_overview: true,
  show_deadlines_widget: true,
  show_activity_feed: true,
  enable_document_upload: true,
  enable_ai_extraction: true,
  enable_approval_workflow: true,
  enable_smart_mode: true,
  enable_compliance_scanner: true,
  enable_chat_assistant: true,
  show_quick_templates: true,
  compact_sidebar: false,
};

interface UseFeatureSettingsResult {
  /** All settings categorized */
  categories: FeatureCategory[];
  /** Raw settings map */
  settings: Record<string, boolean>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Check if a feature is enabled */
  isEnabled: (feature: FeatureKey) => boolean;
  /** Toggle a single feature */
  toggleFeature: (feature: FeatureKey, enabled: boolean) => Promise<void>;
  /** Update multiple features at once */
  updateSettings: (updates: Partial<Record<FeatureKey, boolean>>) => Promise<void>;
  /** Reset all settings to defaults */
  resetToDefaults: () => Promise<void>;
  /** Refetch settings from server */
  refresh: () => Promise<void>;
}

export function useFeatureSettings(): UseFeatureSettingsResult {
  const [categories, setCategories] = useState<FeatureCategory[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings from server
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<FeatureSettingsResponse>("/api/v1/feature-settings");
      setCategories(response.data.categories);
      setSettings(response.data.raw_settings);
    } catch (err) {
      console.error("Failed to load feature settings:", err);
      setError("Einstellungen konnten nicht geladen werden");
      // Use defaults on error
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      // Optimistic update
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
        // Rollback on error
        setSettings(previousSettings);
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
      throw err;
    }
  }, []);

  return useMemo(
    () => ({
      categories,
      settings,
      isLoading,
      error,
      isEnabled,
      toggleFeature,
      updateSettings,
      resetToDefaults,
      refresh: fetchSettings,
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
      fetchSettings,
    ]
  );
}

/**
 * Simple hook for checking a single feature
 */
export function useFeatureEnabled(feature: FeatureKey): boolean {
  const { isEnabled, isLoading } = useFeatureSettings();

  // Return true while loading (show feature by default)
  if (isLoading) return DEFAULT_SETTINGS[feature] ?? true;

  return isEnabled(feature);
}

export default useFeatureSettings;
