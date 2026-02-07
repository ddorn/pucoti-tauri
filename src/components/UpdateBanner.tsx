import { IconX, IconExternalLink } from '@tabler/icons-react'
import { useApp } from '../context/AppContext'
import { useSettings } from '../context/SettingsContext'
import { open as openUrl } from '@tauri-apps/plugin-shell'

export function UpdateBanner() {
  const { updateInfo, dismissUpdate } = useApp()
  const { settings } = useSettings()

  if (!updateInfo) return null
  if (updateInfo.version === settings.dismissedUpdateVersion) return null

  const handleViewRelease = async () => {
    await openUrl(updateInfo.url)
  }

  const handleDismiss = () => {
    dismissUpdate()
  }

  return (
    <div className="bg-accent text-white px-4 py-2.5 flex items-center justify-between gap-4 border-b border-white/10">
      <div className="flex items-center gap-3 flex-1">
        <span className="font-medium text-sm">New version {updateInfo.version} available</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleViewRelease}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded transition-colors text-sm"
        >
          <IconExternalLink className="size-4" />
          View Release
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          aria-label="Dismiss update notification"
        >
          <IconX className="size-4" />
        </button>
      </div>
    </div>
  )
}
