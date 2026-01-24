import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Neutralino from "@neutralinojs/lib"
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

Neutralino.init();
Neutralino.events.on('windowClose', () => {
  // The orphaned session handling happens on next launch
  Neutralino.app.exit()
})