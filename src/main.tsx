import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { warn, debug, info, error } from '@tauri-apps/plugin-log'
import './index.css'
import App from './App'

// Forward console methods to tauri log plugin
// https://v2.tauri.app/plugin/logging/#logging
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

forwardConsole('log', info) // TODO: Is this the right mapping?
forwardConsole('debug', debug)
forwardConsole('info', info)
forwardConsole('warn', warn)
forwardConsole('error', error)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)