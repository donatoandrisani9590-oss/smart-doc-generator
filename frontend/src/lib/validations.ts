/**
 * Form Validations - Zod Schemas
 *
 * Zentrale Validierungsregeln für alle Formulare.
 * Bietet typsichere Validierung mit aussagekräftigen Fehlermeldungen.
 */

import { z } from "zod";

// ============================================================================
// Common Validators
// ============================================================================

/** Non-empty string */
export const requiredString = z
    .string()
    .min(1, "Dieses Feld ist erforderlich")
    .transform((val) => val.trim());

/** Optional string that can be empty */
export const optionalString = z
    .string()
    .transform((val) => val.trim())
    .optional()
    .or(z.literal(""));

/** Email address */
export const email = z
    .string()
    .min(1, "E-Mail ist erforderlich")
    .email("Ungültige E-Mail-Adresse");

/** Password with requirements */
export const password = z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten");

/** Simple password (less strict) */
export const simplePassword = z
    .string()
    .min(6, "Passwort muss mindestens 6 Zeichen lang sein");

/** Date string (YYYY-MM-DD) */
export const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datumsformat (JJJJ-MM-TT)")
    .refine((val) => !isNaN(Date.parse(val)), "Ungültiges Datum");

/** Positive number */
export const positiveNumber = z
    .number()
    .positive("Muss eine positive Zahl sein");

/** Non-negative number */
export const nonNegativeNumber = z
    .number()
    .nonnegative("Muss 0 oder größer sein");

/** Integer */
export const integer = z
    .number()
    .int("Muss eine ganze Zahl sein");

/** Positive integer */
export const positiveInteger = z
    .number()
    .int("Muss eine ganze Zahl sein")
    .positive("Muss größer als 0 sein");

/** Phone number (flexible) */
export const phoneNumber = z
    .string()
    .regex(
        /^[\d\s\-+()]+$/,
        "Ungültige Telefonnummer"
    )
    .min(6, "Telefonnummer zu kurz")
    .max(20, "Telefonnummer zu lang")
    .optional()
    .or(z.literal(""));

/** URL */
export const url = z
    .string()
    .url("Ungültige URL")
    .optional()
    .or(z.literal(""));

// ============================================================================
// User & Auth Schemas
// ============================================================================

export const loginSchema = z.object({
    email: email,
    password: z.string().min(1, "Passwort ist erforderlich"),
});

export const registerSchema = z.object({
    email: email,
    password: password,
    confirmPassword: z.string(),
    firstName: requiredString,
    lastName: requiredString,
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
});

export const resetPasswordSchema = z.object({
    email: email,
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    newPassword: password,
    confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
});

export const userProfileSchema = z.object({
    firstName: requiredString,
    lastName: requiredString,
    email: email,
    phone: phoneNumber,
});

// ============================================================================
// Team Schemas
// ============================================================================

export const createTeamSchema = z.object({
    name: requiredString.pipe(
        z.string().min(2, "Name muss mindestens 2 Zeichen lang sein").max(100, "Name zu lang")
    ),
    description: optionalString,
});

export const addTeamMemberSchema = z.object({
    userId: requiredString,
    role: z.enum(["admin", "member", "viewer"] as const, {
        message: "Ungültige Rolle",
    }),
});

// ============================================================================
// Document Schemas
// ============================================================================

export const documentGenerationSchema = z.object({
    documentTypeId: positiveInteger,
    employeeName: requiredString,
    employeeId: optionalString,
    formData: z.record(z.string(), z.unknown()).optional(),
});

export const draftSchema = z.object({
    name: optionalString,
    documentTypeId: positiveInteger,
    formData: z.record(z.string(), z.unknown()),
});

// ============================================================================
// Clause Schemas
// ============================================================================

export const clauseSchema = z.object({
    title: requiredString.pipe(
        z.string().max(200, "Titel zu lang")
    ),
    contentHtml: z.string().min(1, "Inhalt ist erforderlich"),
    category: optionalString,
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().default(true),
});

export const clauseVariantSchema = z.object({
    name: requiredString,
    contentHtml: z.string().min(1, "Inhalt ist erforderlich"),
    conditions: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Deadline Schemas
// ============================================================================

export const deadlineSchema = z.object({
    deadlineType: z.enum([
        "probezeit_ende",
        "befristung_ende",
        "kuendigung_frist",
        "vertragsverlaengerung",
        "sonstiges",
    ]),
    deadlineDate: dateString,
    employeeName: requiredString,
    employeeId: optionalString,
    notes: optionalString,
});

// ============================================================================
// Settings Schemas
// ============================================================================

export const companySettingsSchema = z.object({
    companyName: requiredString,
    companyAddress: optionalString,
    companyCity: optionalString,
    companyZip: optionalString,
    companyCountry: optionalString,
    companyPhone: phoneNumber,
    companyEmail: email.optional().or(z.literal("")),
    companyWebsite: url,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate data against a schema and return typed result
 */
export function validateForm<T extends z.ZodSchema>(
    schema: T,
    data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Transform Zod errors to a simple object
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (!errors[path]) {
            errors[path] = issue.message;
        }
    }

    return { success: false, errors };
}

/**
 * Get first error message from Zod error
 */
export function getFirstError(error: z.ZodError): string {
    return error.issues[0]?.message || "Validierungsfehler";
}

/**
 * Create form field error getter
 */
export function createErrorGetter(errors: Record<string, string>) {
    return (field: string): string | undefined => errors[field];
}

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;
export type DocumentGenerationInput = z.infer<typeof documentGenerationSchema>;
export type ClauseInput = z.infer<typeof clauseSchema>;
export type DeadlineInput = z.infer<typeof deadlineSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
