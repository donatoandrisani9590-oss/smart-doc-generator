import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/tinymce/skins',
          dest: 'tinymce'
        },
        {
          src: 'node_modules/tinymce/themes',
          dest: 'tinymce'
        },
        {
          src: 'node_modules/tinymce/icons',
          dest: 'tinymce'
        },
        {
          src: 'node_modules/tinymce/models',
          dest: 'tinymce'
        },
        {
          src: 'node_modules/tinymce/plugins',
          dest: 'tinymce'
        }
      ]
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
          // Rich text editor (heavy)
          'vendor-editor': ['tinymce'],
          // Animation & scroll (shared across pages)
          'vendor-motion': ['gsap', '@gsap/react', 'lenis', 'framer-motion'],
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
