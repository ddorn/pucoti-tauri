import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Forward console methods to Tauri log plugin (desktop only)
if (import.meta.env.VITE_PLATFORM === 'tauri') {
  // Dynamic import so Tauri log plugin is not bundled for web
  import('@tauri-apps/plugin-log').then(({ warn, debug, info, error }) => {
    function forwardConsole(
      fnName: 'log' | 'debug' | 'info' | 'warn' | 'error',
      logger: (message: string) => Promise<void>,
    ) {
      const original = console[fnName]
      console[fnName] = (...args: unknown[]) => {
        original(...args)
        const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
        logger(message).catch(() => {})
      }
    }

    forwardConsole('log', info)
    forwardConsole('debug', debug)
    forwardConsole('info', info)
    forwardConsole('warn', warn)
    forwardConsole('error', error)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
