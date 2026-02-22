import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // TinyMCE stubs — replaced by Tiptap in Phase 6
      "@tinymce/tinymce-react": path.resolve(__dirname, "./src/stubs/tinymce-react.tsx"),
      "tinymce/tinymce": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/lists": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/table": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/image": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/link": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/autoresize": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/searchreplace": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/fullscreen": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/code": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/charmap": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/pagebreak": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/anchor": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/insertdatetime": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/plugins/wordcount": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/themes/silver": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/icons/default": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce/models/dom": path.resolve(__dirname, "./src/stubs/tinymce-noop.ts"),
      "tinymce": path.resolve(__dirname, "./src/stubs/tinymce-core.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI framework (Radix primitives)
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-accordion',
            '@radix-ui/react-scroll-area',
          ],
          // Animation & scroll
          'vendor-motion': ['lenis', 'framer-motion'],
          // Utilities
          'vendor-utils': ['date-fns', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
