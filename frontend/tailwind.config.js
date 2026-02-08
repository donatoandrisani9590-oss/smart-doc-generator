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
                    DEFAULT: "hsl(0 84.2% 60.2%)",
                    foreground: "hsl(0 0% 98%)",
                },
                warm: {
                    DEFAULT: "hsl(33 15% 81%)",      // RGB(215,207,197) - Niederwieser Beige
                    foreground: "hsl(25 10% 20%)",
                    50:  "hsl(33 20% 97%)",
                    100: "hsl(33 18% 94%)",
                    200: "hsl(33 15% 88%)",
                    300: "hsl(33 15% 81%)",           // Brand beige
                    400: "hsl(33 12% 72%)",
                    500: "hsl(33 10% 60%)",
                    600: "hsl(30 8% 45%)",
                },
                muted: {
                    DEFAULT: "hsl(33 12% 94%)",
                    foreground: "hsl(25 8% 46%)",
                },
                accent: {
                    DEFAULT: "hsl(33 12% 94%)",
                    foreground: "hsl(228 58% 33%)",
                },
                popover: {
                    DEFAULT: "hsl(0 0% 100%)",
                    foreground: "hsl(224 71.4% 4.1%)",
                },
                card: {
                    DEFAULT: "hsl(0 0% 100%)",
                    foreground: "hsl(224 71.4% 4.1%)",
                },
                background: "hsl(33 20% 97%)", // Warm cream tint (Niederwieser Beige inspired)
                foreground: "hsl(224 71.4% 4.1%)",
                border: "hsl(33 10% 89%)",
                input: "hsl(33 10% 89%)",
                ring: "hsl(228 58% 33%)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
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
