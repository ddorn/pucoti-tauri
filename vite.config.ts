import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const isTauriEnv = process.env.VITE_PLATFORM === 'tauri'

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
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-128.png',
              sizes: '128x128',
              type: 'image/png',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,mp3}'],
        },
      }),
    ] : []),
  ],
  // Use relative paths for Tauri (file:// protocol), absolute for web
  base: isTauriEnv ? './' : '/',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: isTauriEnv
      ? {}
      : {
          // Stub out Tauri-only modules so @tauri-apps/* code never enters the web bundle.
          [path.resolve(__dirname, 'src/lib/platform/tauri.ts')]:
            path.resolve(__dirname, 'src/lib/platform/stubs/tauri-stub.ts'),
          [path.resolve(__dirname, 'src/hooks/useDbusSubscriber.ts')]:
            path.resolve(__dirname, 'src/lib/platform/stubs/dbus-stub.ts'),
        },
  },
  define: {
    // Polyfill for libraries expecting Node.js global variable
    global: 'globalThis',
  },
})
