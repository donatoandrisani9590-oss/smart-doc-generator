/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // ═══════════════════════════════════════════════════════════════
            // NIEDERWIESER CORPORATE COLORS
            // ═══════════════════════════════════════════════════════════════
            colors: {
                // Primary: Niederwieser Blau #243186
                primary: {
                    DEFAULT: "var(--color-primary)",
                    foreground: "var(--color-primary-foreground)",
                    50: "var(--color-primary-50)",
                    100: "var(--color-primary-100)",
                    200: "var(--color-primary-200)",
                    300: "var(--color-primary-300)",
                    400: "var(--color-primary-400)",
                    500: "var(--color-primary-500)",
                    600: "var(--color-primary-600)",
                    700: "var(--color-primary-700)",
                    800: "var(--color-primary-800)",
                    900: "var(--color-primary-900)",
                },
                // Secondary: Niederwieser Grün #6EBD84 (Success/Checkbox)
                secondary: {
                    DEFAULT: "var(--color-secondary)",
                    foreground: "var(--color-secondary-foreground)",
                    50: "var(--color-secondary-50)",
                    100: "var(--color-secondary-100)",
                    200: "var(--color-secondary-200)",
                    300: "var(--color-secondary-300)",
                    400: "var(--color-secondary-400)",
                    500: "var(--color-secondary-500)",
                    600: "var(--color-secondary-600)",
                    700: "var(--color-secondary-700)",
                    800: "var(--color-secondary-800)",
                    900: "var(--color-secondary-900)",
                },
                // Success: Alias für Secondary
                success: {
                    DEFAULT: "var(--color-success)",
                    foreground: "var(--color-success-foreground)",
                },
                // Warning
                warning: {
                    DEFAULT: "var(--color-warning)",
                    foreground: "var(--color-warning-foreground)",
                },
                // Neutral: Niederwieser Grau/Beige #D7CFC5 (Borders, Muted)
                border: "var(--color-border)",
                input: "var(--color-input)",
                ring: "var(--color-ring)",
                // Backgrounds (Apple-Style)
                background: "var(--color-background)",
                foreground: "var(--color-foreground)",
                surface: "var(--color-surface)",
                // Muted
                muted: {
                    DEFAULT: "var(--color-muted)",
                    foreground: "var(--color-muted-foreground)",
                },
                // Accent
                accent: {
                    DEFAULT: "var(--color-accent)",
                    foreground: "var(--color-accent-foreground)",
                },
                // Destructive
                destructive: {
                    DEFAULT: "var(--color-destructive)",
                    foreground: "var(--color-destructive-foreground)",
                },
                // Card/Popover (Surface-based)
                popover: {
                    DEFAULT: "var(--color-popover)",
                    foreground: "var(--color-popover-foreground)",
                },
                card: {
                    DEFAULT: "var(--color-card)",
                    foreground: "var(--color-card-foreground)",
                },
            },
            // ═══════════════════════════════════════════════════════════════
            // TYPOGRAPHY: Inter (or SF Pro as fallback)
            // ═══════════════════════════════════════════════════════════════
            fontFamily: {
                sans: [
                    "Inter",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "SF Pro Display",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif",
                ],
            },
            // ═══════════════════════════════════════════════════════════════
            // BORDER RADIUS: Apple-style rounded corners
            // ═══════════════════════════════════════════════════════════════
            borderRadius: {
                lg: "var(--radius-lg)",
                md: "var(--radius-md)",
                sm: "var(--radius-sm)",
                xl: "var(--radius-xl)",
                "2xl": "var(--radius-2xl)",
            },
            // ═══════════════════════════════════════════════════════════════
            // SHADOWS: Soft, layered (Apple-inspired)
            // ═══════════════════════════════════════════════════════════════
            boxShadow: {
                // Subtle elevation
                "soft-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
                // Card/Container shadow
                "soft-md": "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
                // Elevated elements (Modals, Dropdowns)
                "soft-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)",
                // DIN A4 Preview "floating paper" effect
                "paper": "0 8px 30px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)",
            },
            // ═══════════════════════════════════════════════════════════════
            // BACKDROP BLUR: macOS-style frosted glass
            // ═══════════════════════════════════════════════════════════════
            backdropBlur: {
                xs: "2px",
                sm: "4px",
                md: "8px",
                lg: "12px",
                xl: "16px",
            },
            // ═══════════════════════════════════════════════════════════════
            // ANIMATIONS
            // ═══════════════════════════════════════════════════════════════
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
        },
    },
    plugins: [],
}
