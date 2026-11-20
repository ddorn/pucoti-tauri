import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The pucoti.com landing page, in site/. The web app is a separate build (vite.config.ts)
 * that `npm run build:pages` copies under app/ of this one.
 */
export default defineConfig({
  root: 'site',
  // Shares the app's public/ for the icons and the bell
  publicDir: '../public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist-site',
    emptyOutDir: true,
  },
  server: { port: 5174 },
  preview: { port: 4174 },
})
