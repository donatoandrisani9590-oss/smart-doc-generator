/**
 * Form Types for Document Generator
 * PROJ-001: Pflichtfeld-Kennzeichnung
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'email'
  | 'select'
  | 'checkbox'
  | 'textarea';

export interface FormField {
  id: number;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  is_required: boolean;
  default_value?: string;
  options?: string; // JSON for select
  help_text?: string;
  placeholder_text?: string;
  suffix?: string;
  prefix?: string;
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  pattern?: string;
  pattern_error_message?: string;
  display_order?: number;
  display_group?: string;
  show_condition?: string; // JSON
}

export interface FieldError {
  field_name: string;
  message: string;
}

export interface ValidationState {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isFormValid: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
