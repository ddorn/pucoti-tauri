import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TimerDemo } from './TimerDemo'
import './site.css'

// The page is static HTML. React only runs the demo, which replaces the screenshot
// that stands in for it without JavaScript, and the ending it fills in.
document.getElementById('ending')?.replaceChildren()
createRoot(document.getElementById('demo')!).render(
  <StrictMode>
    <TimerDemo />
  </StrictMode>
)

// ── Download for the visitor's platform ──

type OS = 'linux' | 'windows' | 'macos'
type MacArch = 'aarch64' | 'x64'

const OS_NAMES: Record<OS, string> = { linux: 'Linux', windows: 'Windows', macos: 'macOS' }

function detectOS(): OS | null {
  const ua = navigator.userAgent
  // Phones get no download button: the web app is the only Pucoti they can run
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return null
  if (/Windows/i.test(ua)) return 'windows'
  if (/Mac/i.test(ua)) return 'macos'
  if (/Linux|X11|CrOS/i.test(ua)) return 'linux'
  return null
}

/**
 * Browsers report Intel Macs and Apple Silicon ones alike, but the GPU usually gives it
 * away. Safari hides it ("Apple GPU"), so the default is Apple Silicon, which is what
 * every Mac sold since 2021 has.
 */
function detectMacArch(): MacArch {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const renderer = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    if (/Intel|AMD|Radeon/i.test(renderer)) return 'x64'
  } catch {
    // No WebGL: keep the default
  }
  return 'aarch64'
}

const os = detectOS()
const heroDownload = document.getElementById('hero-download')
if (os && heroDownload) {
  const card = document.getElementById(`download-${os}`)
  const icon = card?.querySelector('svg')?.cloneNode(true) as SVGElement | undefined
  if (icon) {
    icon.setAttribute('class', 'size-5 shrink-0')
    heroDownload.prepend(icon)
  }
  heroDownload.querySelector('span')!.textContent = `Download for ${OS_NAMES[os]}`
  heroDownload.setAttribute('href', `#download-${os}`)
  // Put the visitor's platform first in the download grid
  card?.parentElement?.prepend(card)
  card?.classList.replace('border-line', 'border-accent')
} else {
  heroDownload?.classList.add('hidden')
}

// ── Pickers: the Linux distribution and the Mac's chip ──

/** Shows the `data-panel="group:value"` elements of the value picked, hides the group's others */
function pick(group: string, value: string) {
  document.querySelectorAll<HTMLElement>(`[data-panel^="${group}:"]`).forEach(el => {
    el.classList.toggle('hidden', el.dataset.panel !== `${group}:${value}`)
  })
  document.querySelectorAll<HTMLElement>(`[data-pick^="${group}:"]`).forEach(button => {
    const active = button.dataset.pick === `${group}:${value}`
    button.setAttribute('aria-pressed', String(active))
    button.className = 'rounded-md px-3 py-1 ' + (active
      ? 'bg-ink text-paper'
      : 'hover:text-ink')
  })
}

document.querySelectorAll<HTMLElement>('[data-pick]').forEach(button => {
  const [group, value] = button.dataset.pick!.split(':')
  button.addEventListener('click', () => pick(group, value))
})
// Some browsers name the distribution in their user agent
pick('linux', /Fedora|Red Hat/i.test(navigator.userAgent) ? 'rpm' : 'deb')
pick('mac', os === 'macos' ? detectMacArch() : 'aarch64')

// ── Copy buttons: copy the command shown next to them ──

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const pre = button.parentElement?.querySelector('pre:not(.hidden)')
    if (!pre?.textContent) return
    try {
      await navigator.clipboard.writeText(pre.textContent)
      button.textContent = 'Copied'
    } catch {
      // No clipboard access: select the command so Ctrl+C works
      getSelection()?.selectAllChildren(pre)
      return
    }
    setTimeout(() => (button.textContent = 'Copy'), 1500)
  })
})
