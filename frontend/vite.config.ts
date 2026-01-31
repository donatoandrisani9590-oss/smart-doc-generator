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
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
