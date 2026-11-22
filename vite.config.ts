/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Tauri's CLI sets TAURI_ENV_PLATFORM for the commands it runs before building or serving
// the frontend, so a desktop build is recognised however it is started (npm scripts, CI's
// tauri-action, a bare `tauri build`). The app reads the result as import.meta.env.VITE_PLATFORM.
const isTauriEnv = !!process.env.TAURI_ENV_PLATFORM || process.env.VITE_PLATFORM === 'tauri'

// Tauri loads the build over file://, so its paths are relative. On the web the app
// lives under /app/ of pucoti.com, next to the landing page in site/.
const base = isTauriEnv ? './' : '/app/'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // PWA only for web builds
    ...(!isTauriEnv ? [
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Pucoti',
          short_name: 'Pucoti',
          description: 'Time estimation trainer',
          theme_color: '#f59e0b',
          background_color: '#18181b',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'icon-128.png',
              sizes: '128x128',
              type: 'image/png',
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,mp3}'],
          // The landing page's link preview, which shares public/ but not the app
          globIgnores: ['og.png'],
        },
      }),
    ] : []),
  ],
  base,
  test: {
    // Agent worktrees under .claude/ hold their own copies of the test files
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  build: {
    outDir: 'dist',
  },
  define: {
    // Polyfill for libraries expecting Node.js global variable
    global: 'globalThis',
    'import.meta.env.VITE_PLATFORM': JSON.stringify(isTauriEnv ? 'tauri' : 'web'),
  },
})
