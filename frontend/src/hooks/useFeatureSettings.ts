/**
 * useFeatureSettings - Hook for feature toggle management
 *
 * REFACTORED: Now uses FeatureSettingsContext to prevent API flooding.
 * Settings are loaded ONCE and shared across all components.
 *
 * Usage:
 * - useFeatureSettings() - Full access to settings and actions
 * - useFeatureEnabled(key) - Simple boolean check for a feature
 */

// Re-export everything from context
export {
  useFeatureSettings,
  useFeatureEnabled,
  FeatureSettingsProvider,
  DEFAULT_SETTINGS,
} from "@/contexts/FeatureSettingsContext";

export type {
  FeatureKey,
  FeatureCategory,
  FeatureDefinition,
  FeatureSettingsResponse,
  FeatureSettingsContextValue,
} from "@/contexts/FeatureSettingsContext";
