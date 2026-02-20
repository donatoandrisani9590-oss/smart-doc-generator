/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "hsl(228 58% 33%)", // #243186
                    foreground: "hsl(0 0% 100%)",
                    50: "hsl(228 58% 97%)",
                    100: "hsl(228 58% 94%)",
                    200: "hsl(228 58% 86%)",
                    300: "hsl(228 58% 74%)",
                    400: "hsl(228 58% 60%)",
                    500: "hsl(228 58% 45%)",
                    600: "hsl(228 58% 33%)", // Brand base
                    700: "hsl(228 58% 27%)",
                    800: "hsl(228 58% 20%)",
                    900: "hsl(228 58% 12%)",
                },
                secondary: {
                    DEFAULT: "hsl(137 40% 58%)", // #6EBD84
                    foreground: "hsl(0 0% 100%)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                warm: {
                    DEFAULT: "hsl(220 9% 81%)",
                    foreground: "hsl(220 10% 20%)",
                    50:  "hsl(var(--warm-50))",    // CSS var → dark mode aware
                    100: "hsl(var(--warm-100))",   // CSS var → dark mode aware
                    200: "hsl(var(--warm-200))",   // CSS var → dark mode aware
                    300: "hsl(220 12% 81%)",
                    400: "hsl(220 9% 72%)",
                    500: "hsl(220 8% 60%)",
                    600: "hsl(218 7% 45%)",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
            },
            borderRadius: {
                xl: "calc(var(--radius) + 8px)",   // 20px — modals, dialogs
                lg: "var(--radius)",                // 12px base (from CSS var)
                md: "calc(var(--radius) - 2px)",    // 10px — nav pills
                sm: "calc(var(--radius) - 4px)",    // 8px → now maps to 8px
            },
            fontFamily: {
                sans: [
                    "Inter",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif",
                ],
            },
            boxShadow: {
                // "Soft & Simple" system
                'soft-xs': '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                'soft-sm': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
                'soft-md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
                'soft-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.025)',
                'soft-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.025)',
                // Specialty shadows
                'float': '0 8px 30px rgba(0, 0, 0, 0.06)',
                'paper': '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0,0,0,0.04)',
                'glow': '0 0 15px rgba(36, 49, 134, 0.15)',
                'soft-warm': '0 4px 12px -2px rgba(180, 160, 140, 0.08), 0 2px 4px -2px rgba(180, 160, 140, 0.06)',
                'hero': '0 8px 30px rgba(36, 49, 134, 0.12), 0 2px 8px rgba(36, 49, 134, 0.06)',
                // Ive elevation system
                'elevated': '0 0 0 0.5px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.02)',
                'elevated-hover': '0 0 0 0.5px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.04)',
                'widget': '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 28px rgba(0,0,0,0.02)',
                'widget-hover': '0 2px 4px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.03)',
                'canvas-paper': 'var(--shadow-canvas-paper)',
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    from: { opacity: 0, transform: 'translateY(5px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
                "scale-in": {
                    from: { opacity: 0, transform: 'scale(0.95)' },
                    to: { opacity: 1, transform: 'scale(1)' },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.4s ease-out forwards",
                "scale-in": "scale-in 0.2s ease-out forwards",
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
