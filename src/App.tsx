import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext'
import { SettingsProvider, useSettings } from './context/SettingsContext'
import { Timer } from './screens/Timer'
import { Stats } from './screens/Stats'
import { Settings } from './screens/Settings'
import { Completion } from './screens/Completion'
import { Navbar } from './components/Navbar'
import { initializeWindowForPlatform } from './lib/window';
import { applyAccentColor } from './lib/colors';
import clsx from 'clsx'

function AppContent() {
  const { screen, displayMode } = useApp()

  // Show navbar padding in normal display mode
  const showNavbar = displayMode === 'normal'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />

      <main className={clsx('flex-1 min-h-0 flex flex-col', showNavbar && 'pt-[61px]')}>
        {screen === 'timer' && <Timer />}
        {screen === 'stats' && <Stats />}
        {screen === 'settings' && <Settings />}
        {screen === 'completion' && <Completion />}
      </main>
    </div>
  )
}

/**
 * Bridge component that connects SettingsContext to AppProvider
 */
function AppWithSettings({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings()

  // Initialize window decorations for platform (e.g., disable on Sway)
  useEffect(() => {
    initializeWindowForPlatform();
  }, [])

  // Apply accent color when settings change
  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor])

  return (
    <AppProvider>
      {children}
    </AppProvider>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AppWithSettings>
        <AppContent />
      </AppWithSettings>
    </SettingsProvider>
  )
}
