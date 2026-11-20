import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TimerDemo } from './TimerDemo'
import './site.css'

// The page is static HTML. React only runs the demo, which replaces the screenshot
// that stands in for it without JavaScript.
createRoot(document.getElementById('demo')!).render(
  <StrictMode>
    <TimerDemo />
  </StrictMode>
)

type OS = 'linux' | 'windows' | 'macos'

function detectOS(): OS | null {
  const ua = navigator.userAgent
  // Phones get no download button: the web app is the only Pucoti they can run
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac/i.test(ua)) return 'macos'
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux'
  return null
}

const OS_NAMES: Record<OS, string> = { linux: 'Linux', windows: 'Windows', macos: 'macOS' }

const os = detectOS()
const heroDownload = document.getElementById('hero-download')
if (os && heroDownload) {
  heroDownload.textContent = `Download for ${OS_NAMES[os]}`
  heroDownload.setAttribute('href', `#download-${os}`)
  // Put the visitor's platform first in the download grid
  const card = document.getElementById(`download-${os}`)
  card?.parentElement?.prepend(card)
  card?.classList.add('border-accent/60')
} else {
  heroDownload?.classList.add('hidden')
}
