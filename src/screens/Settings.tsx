import { useState } from 'react'
import { useSettings } from '../context/SettingsContext'
import { Button } from '../components/catalyst/button'
import { Input } from '../components/catalyst/input'
import { Text } from '../components/catalyst/text'
import { Heading } from '../components/catalyst/heading'
import { executeCustomNotification } from '../lib/settings'
import { sendNotification } from '@tauri-apps/plugin-notification'

export function Settings() {
  const { settings, loading, updateSettings, resetSettings } = useSettings()
  const [testingNotification, setTestingNotification] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Text>Loading settings...</Text>
      </div>
    )
  }

  const handleTestNotification = async () => {
    setTestingNotification(true)
    try {
      const title = 'Test Notification'
      const body = 'This is a test notification from Pucoti'

      if (settings.notificationCommand) {
        const success = await executeCustomNotification(title, body, settings.notificationCommand)
        if (!success) {
          // Fallback to default
          await sendNotification({ title, body })
        }
      } else {
        await sendNotification({ title, body })
      }
    } catch (err) {
      console.error('Notification test failed:', err)
    } finally {
      setTestingNotification(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <Heading level={1}>Settings</Heading>
        <Text className="mt-1">Configure Pucoti behavior</Text>
      </div>

      {/* Notification Settings */}
      <section className="space-y-4">
        <Heading level={2}>Notifications</Heading>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Custom notification command
          </label>
          <Input
            type="text"
            value={settings.notificationCommand}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateSettings({ notificationCommand: e.target.value })
            }
            placeholder="notify-send {title} {body}"
          />
          <Text className="text-xs">
            Leave empty for default OS notifications. Use <code className="px-1 py-0.5 rounded bg-zinc-800">{'{title}'}</code> and <code className="px-1 py-0.5 rounded bg-zinc-800">{'{body}'}</code> as placeholders.
          </Text>
        </div>

        <Button
          outline
          onClick={handleTestNotification}
          disabled={testingNotification}
        >
          {testingNotification ? 'Sending...' : 'Test Notification'}
        </Button>
      </section>

      {/* Window Size Settings */}
      <section className="space-y-4">
        <Heading level={2}>Window Sizes</Heading>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Normal width
            </label>
            <Input
              type="number"
              value={settings.normalWindowWidth}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ normalWindowWidth: parseInt(e.target.value) || 600 })
              }
              min={300}
              max={2000}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Normal height
            </label>
            <Input
              type="number"
              value={settings.normalWindowHeight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ normalWindowHeight: parseInt(e.target.value) || 500 })
              }
              min={200}
              max={2000}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Small mode width
            </label>
            <Input
              type="number"
              value={settings.smallWindowWidth}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ smallWindowWidth: parseInt(e.target.value) || 320 })
              }
              min={200}
              max={800}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Small mode height
            </label>
            <Input
              type="number"
              value={settings.smallWindowHeight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ smallWindowHeight: parseInt(e.target.value) || 120 })
              }
              min={80}
              max={400}
            />
          </div>
        </div>
      </section>

      {/* Small Window Behavior */}
      <section className="space-y-4">
        <Heading level={2}>Small Window</Heading>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoSmallOnStart}
            onChange={(e) => updateSettings({ autoSmallOnStart: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
          />
          <span className="text-sm text-zinc-300">Automatically switch to small mode when starting timer</span>
        </label>
        <Text className="text-xs">
          When enabled, the window will automatically switch to small corner mode when you start a new focus session.
        </Text>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.smallWindowBorderless}
            onChange={(e) => updateSettings({ smallWindowBorderless: e.target.checked })}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
          />
          <span className="text-sm text-zinc-300">Borderless small window</span>
        </label>
        <Text className="text-xs">
          Remove window decorations in small corner mode. May not work on all window managers.
        </Text>
      </section>

      {/* Corner Margins */}
      <section className="space-y-4">
        <Heading level={2}>Corner Margins</Heading>
        <Text className="text-sm text-zinc-400">
          Distance from screen edges when in small corner mode (in pixels)
        </Text>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Top margin
            </label>
            <Input
              type="number"
              value={settings.cornerMarginTop}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ cornerMarginTop: parseInt(e.target.value) || 0 })
              }
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Right margin
            </label>
            <Input
              type="number"
              value={settings.cornerMarginRight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ cornerMarginRight: parseInt(e.target.value) || 0 })
              }
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Bottom margin
            </label>
            <Input
              type="number"
              value={settings.cornerMarginBottom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ cornerMarginBottom: parseInt(e.target.value) || 0 })
              }
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Left margin
            </label>
            <Input
              type="number"
              value={settings.cornerMarginLeft}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                updateSettings({ cornerMarginLeft: parseInt(e.target.value) || 0 })
              }
              min={0}
              max={500}
            />
          </div>
        </div>
      </section>

      {/* Reset */}
      <section className="pt-4 border-t border-zinc-800">
        <Button
          outline
          onClick={resetSettings}
        >
          Reset to Defaults
        </Button>
      </section>
    </div>
  )
}
