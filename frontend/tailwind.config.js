/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class", '[data-theme="dark"]'],
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                // PFLICHT: Überschreibt Tailwind-Defaults mit Niederwieser-Fonts (§60.8)
                sans: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
            },
            colors: {
                // ── Niederwieser Brand Colors (§60.8) ──
                // THESE VALUES MUST MATCH §5 CSS VARIABLES
                'nw-blue': {
                    25:  '#f7f8fc',
                    50:  '#eef0f9',
                    100: '#dcdff3',
                    200: '#b3bae7',
                    300: '#8390d8',
                    400: '#5a6bc7',
                    500: '#3a4db3',
                    600: '#2d3d9e',
                    700: '#243186',   // CI Primary — §60.1 definitive value
                    800: '#1e2a74',
                    900: '#1a2463',
                },
                'nw-green': {
                    50:  '#f2faf4',
                    100: '#e4f4e8',
                    200: '#c8e8cf',
                    400: '#8bcb9a',
                    500: '#6EBD84',   // CI Secondary — §60.1 definitive value
                    600: '#5daa72',
                    700: '#4e9963',
                },
                'nw-amber': {
                    50:  '#fef7e8',
                    100: '#fcf0d8',
                    200: '#f8e2b3',
                    400: '#efc06a',
                    500: '#E8A838',   // CI Accent (Entwürfe, Fristen)
                    600: '#d49520',
                    700: '#b87d1a',
                },
                'nw-red': {
                    50:  '#fef0ef',
                    100: '#fad7d6',
                    200: '#f5aeac',
                    400: '#eb6562',
                    500: '#E53935',   // CI Signal (Überfällig, Kritisch)
                    600: '#d9322f',
                    700: '#c22a27',
                },
                'nw-warm': {
                    25:  '#fdfcfb',
                    50:  '#faf9f7',
                    100: '#f5f2ef',
                    200: '#eee9e4',
                    300: '#e3ddd6',
                    400: '#D7CFC5',
                    500: '#b8ad9f',
                    600: '#998f84',
                },
                // ── shadcn/ui Semantic Tokens ──
                primary: {
                    DEFAULT: "#243186",
                    foreground: "hsl(0 0% 100%)",
                    50: "#eef0f9",
                    100: "#dcdff3",
                    200: "#b3bae7",
                    300: "#8390d8",
                    400: "#5a6bc7",
                    500: "#3a4db3",
                    600: "#2d3d9e",
                    700: "#243186",
                    800: "#1e2a74",
                    900: "#1a2463",
                },
                secondary: {
                    DEFAULT: "#6EBD84",
                    foreground: "hsl(0 0% 100%)",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                warm: {
                    DEFAULT: "hsl(var(--warm))",
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
            },
            borderRadius: {
                '2xl': '24px',     // Glass containers, modals
                '3xl': '32px',     // Extra-large panels
                xl: "var(--radius-xl)",
                lg: "var(--radius-lg)",
                md: "var(--radius-md)",
                sm: "var(--radius-sm)",
            },
            fontSize: {
                '2xs': ['10px', { lineHeight: '14px' }],
            },
            boxShadow: {
                'sm': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                'md': '0 4px 12px rgba(0,0,0,0.07)',
                'lg': '0 8px 28px rgba(0,0,0,0.09)',
                'xl': '0 20px 60px rgba(0,0,0,0.1)',
                'glass': '0 8px 32px rgba(0, 0, 0, 0.06)',
                'blue-sm': '0 2px 8px rgba(36, 49, 134, 0.20)',
                'blue-md': '0 4px 16px rgba(36, 49, 134, 0.25)',
                'inset-input': 'inset 0 1px 3px rgba(0, 0, 0, 0.06)',
                'float': '0 8px 30px rgba(0, 0, 0, 0.06)',
                'paper': '0 4px 24px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0,0,0,0.04)',
                'glow': '0 0 15px rgba(36, 49, 134, 0.15)',
                'hero': '0 10px 32px rgba(36, 49, 134, 0.06)',
                'elevated': '0 0 0 0.5px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.02)',
                'elevated-hover': '0 0 0 0.5px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.04)',
                'widget': '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03), 0 12px 28px rgba(0,0,0,0.02)',
                'widget-hover': '0 2px 4px rgba(0,0,0,0.05), 0 8px 16px rgba(0,0,0,0.04), 0 16px 32px rgba(0,0,0,0.03)',
                'canvas-paper': 'var(--shadow-canvas-paper)',
            },
            backdropBlur: {
                'glass': '16px',
                'glass-heavy': '24px',
                xs: '2px',
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
        },
    },
    plugins: [],
}
