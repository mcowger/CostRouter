import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  build: {
    // This is the fix.
    // It tells Vite to build into a 'ui' folder inside the root 'dist' directory.
    outDir: '../dist/ui',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '#schemas': fileURLToPath(new URL('../schemas', import.meta.url))
    },
  },
})
