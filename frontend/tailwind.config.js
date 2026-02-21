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
                    DEFAULT: "#2B3990", // Prototype nw-blue
                    foreground: "hsl(0 0% 100%)",
                    50: "#EEF0F9",
                    100: "#D8DCF2",
                    200: "#B3BAE7",
                    300: "#8390D8",
                    400: "#5A6BC7",
                    500: "#3D4DAA",
                    600: "#2B3990", // Brand base
                    700: "#1E2A6E",
                    800: "#162055",
                    900: "#0E1438",
                },
                secondary: {
                    DEFAULT: "#4CAF6A", // Prototype nw-green
                    foreground: "hsl(0 0% 100%)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                warm: {
                    DEFAULT: "hsl(220 9% 81%)",
                    foreground: "hsl(220 10% 20%)",
                    50:  "hsl(var(--warm-50))",
                    100: "hsl(var(--warm-100))",
                    200: "hsl(var(--warm-200))",
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
                // Prototype accent colors (for direct use)
                "nw-blue": "#2B3990",
                "nw-green": "#4CAF6A",
                "nw-amber": "#E8A838",
                "nw-red": "#E53935",
                "nw-purple": "#7C4DFF",
            },
            borderRadius: {
                '2xl': "var(--radius-xl)",   // 20px — modals, dialogs
                xl: "var(--radius-lg)",      // 16px
                lg: "var(--radius-md)",      // 12px
                md: "var(--radius-sm)",      // 8px
                sm: "6px",
            },
            fontFamily: {
                sans: [
                    "'Plus Jakarta Sans'",
                    "-apple-system",
                    "BlinkMacSystemFont",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif",
                ],
                mono: [
                    "'JetBrains Mono'",
                    "monospace",
                ],
            },
            fontSize: {
                '2xs': ['10px', { lineHeight: '14px' }],
            },
            boxShadow: {
                'sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                'md': '0 4px 12px rgba(0,0,0,0.07)',
                'lg': '0 8px 28px rgba(0,0,0,0.09)',
                'xl': '0 20px 60px rgba(0,0,0,0.1)',
                // Soft system (preserved for backward compat)
                'soft-xs': '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                'soft-sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                'soft-md': '0 4px 12px rgba(0,0,0,0.07)',
                'soft-lg': '0 8px 28px rgba(0,0,0,0.09)',
                'soft-xl': '0 20px 60px rgba(0,0,0,0.1)',
                // Specialty shadows
                'float': '0 8px 30px rgba(0, 0, 0, 0.06)',
                'paper': '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0,0,0,0.04)',
                'glow': '0 0 15px rgba(43, 57, 144, 0.15)',
                'soft-warm': '0 4px 12px -2px rgba(180, 160, 140, 0.08), 0 2px 4px -2px rgba(180, 160, 140, 0.06)',
                'hero': '0 10px 32px rgba(43, 57, 144, 0.06)',
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
                "pageIn": {
                    from: { opacity: 0, transform: 'translateY(10px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.4s ease-out forwards",
                "scale-in": "scale-in 0.2s ease-out forwards",
                "page-in": "pageIn 0.35s ease forwards",
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
