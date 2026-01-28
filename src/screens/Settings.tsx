import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import { Button } from '../components/catalyst/button'
import { Input } from '../components/catalyst/input'
import { Text } from '../components/catalyst/text'
import { Heading } from '../components/catalyst/heading'
import { Checkbox, CheckboxField } from '../components/catalyst/checkbox';
import { Radio, RadioGroup, RadioField } from '../components/catalyst/radio';
import { Label, Description } from '../components/catalyst/fieldset';
import { ValidatedNumericInput } from '../components/ValidatedNumericInput';
import { executeCustomNotification } from '../lib/settings'
import { getExtensionStatus, enableExtension, type ExtensionStatus } from '../lib/gnome-extension'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { open } from '@tauri-apps/plugin-dialog';
import { playBell } from '../lib/sound'
import { ColorPicker } from '../components/ColorPicker'

export function Settings() {
  const { settings, loading, updateSettings, resetSettings } = useSettings()
  const [testingNotification, setTestingNotification] = useState(false)
  const [testingBell, setTestingBell] = useState(false)
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null)
  const [enablingExtension, setEnablingExtension] = useState(false)

  // Check extension status on mount
  useEffect(() => {
    getExtensionStatus().then(setExtensionStatus)
  }, [])

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

  const handleSelectBell = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Audio',
          extensions: ['mp3']
        }]
      });

      if (selected && typeof selected === 'string') {
        await updateSettings({ customBellPath: selected });
      }
    } catch (err) {
      console.error('File selection failed:', err);
    }
  };

  const handleClearBell = async () => {
    await updateSettings({ customBellPath: '' });
  };

  const handleTestBell = async () => {
    setTestingBell(true);
    try {
      playBell(settings.customBellPath);
      // Wait a bit before re-enabling button
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Bell test failed:', err);
    } finally {
      setTestingBell(false);
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

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Bell repeat interval (seconds)
          </label>
          <ValidatedNumericInput
            value={settings.bellRepeatIntervalSeconds}
            onChange={(val) => updateSettings({ bellRepeatIntervalSeconds: val })}
            min={0}
            max={300}
          />
          <Text className="text-xs">
            How frequently the bell repeats during overtime. Set to 0 to disable repeat. Default is 20 seconds.
          </Text>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Custom bell sound
          </label>
          {settings.customBellPath ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={settings.customBellPath}
                  readOnly
                  className="flex-1"
                />
                <Button
                  outline
                  onClick={handleClearBell}
                >
                  Clear
                </Button>
              </div>
              <Text className="text-xs text-zinc-400">
                Using custom bell sound
              </Text>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                outline
                onClick={handleSelectBell}
              >
                Select Custom Bell
              </Button>
              <Text className="text-xs">
                Choose a custom MP3 sound file. Leave empty to use default bell.
              </Text>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            outline
            onClick={handleTestNotification}
            disabled={testingNotification}
          >
            {testingNotification ? 'Sending...' : 'Test Notification'}
          </Button>
          <Button
            outline
            onClick={handleTestBell}
            disabled={testingBell}
          >
            {testingBell ? 'Playing...' : 'Test Bell'}
          </Button>
        </div>
      </section>

      {/* Timer Behavior */}
      <section className="space-y-4">
        <Heading level={2}>Timer Behavior</Heading>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">
            Timer start percentage (%)
          </label>
          <ValidatedNumericInput
            value={settings.timerStartPercentage}
            onChange={(val) => updateSettings({ timerStartPercentage: val })}
            min={0}
            max={100}
          />
          <Text className="text-xs">
            Start the timer at a percentage of your prediction. Set to 80 to get a reminder 20% before your predicted time.
            Only applies to predict mode. The prediction itself stays unchanged for stats tracking.
          </Text>
        </div>
      </section>

      {/* Window Size Settings */}
      <section className="space-y-4">
        <Heading level={2}>Window Sizes</Heading>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Normal width
            </label>
            <ValidatedNumericInput
              value={settings.normalWindowWidth}
              onChange={(val) => updateSettings({ normalWindowWidth: val })}
              min={300}
              max={2000}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Normal height
            </label>
            <ValidatedNumericInput
              value={settings.normalWindowHeight}
              onChange={(val) => updateSettings({ normalWindowHeight: val })}
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
            <ValidatedNumericInput
              value={settings.smallWindowWidth}
              onChange={(val) => updateSettings({ smallWindowWidth: val })}
              min={200}
              max={800}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Small mode height
            </label>
            <ValidatedNumericInput
              value={settings.smallWindowHeight}
              onChange={(val) => updateSettings({ smallWindowHeight: val })}
              min={80}
              max={400}
            />
          </div>
        </div>
      </section>

      {/* Timer Start Behavior */}
      <section className="space-y-4">
        <Heading level={2}>Timer Start Behavior</Heading>
        <Text className="text-sm text-zinc-400">
          Choose what happens to the window when you start a timer
        </Text>

        <RadioGroup
          value={settings.onTimerStart}
          onChange={(value) => updateSettings({ onTimerStart: value as 'nothing' | 'corner' | 'minimize' })}
        >
          <RadioField>
            <Radio value="nothing" color={settings.accentColor} />
            <Label>Do nothing</Label>
            <Description>Keep the window in its current state</Description>
          </RadioField>

          <RadioField>
            <Radio value="corner" color={settings.accentColor} />
            <Label>Switch to corner mode</Label>
            <Description>Automatically switch to small corner window when starting a timer</Description>
          </RadioField>

          <RadioField>
            <Radio value="minimize" color={settings.accentColor} />
            <Label>Minimize window</Label>
            <Description>
              Minimize the window on timer start. This is primarily useful on GNOME when using the panel extension that displays the timer in the top panel.
            </Description>
          </RadioField>
        </RadioGroup>

        <CheckboxField>
          <Checkbox
            checked={settings.smallWindowBorderless}
            onChange={(checked) => updateSettings({ smallWindowBorderless: checked })}
            color={settings.accentColor}
          />
          <Label>Borderless small window</Label>
          <Description>Remove window decorations in small corner mode. May not work on all window managers.</Description>
        </CheckboxField>
      </section>

      {/* GNOME Panel Indicator - Linux only */}
      {extensionStatus && extensionStatus !== 'not-gnome' && (
        <section className="space-y-4">
          <Heading level={2}>GNOME Panel Indicator</Heading>
          <Text className="text-sm text-zinc-400">
            Show timer status in the GNOME top panel.
          </Text>

          <CheckboxField>
            <Checkbox
              checked={settings.useGnomePanelIndicator}
              onChange={async (checked) => {
                await updateSettings({ useGnomePanelIndicator: checked })
                if (checked && (extensionStatus === 'enabled' || extensionStatus === 'disabled')) {
                  setEnablingExtension(true)
                  await enableExtension()
                  setEnablingExtension(false)
                  setExtensionStatus('enabled')
                }
              }}
              color={settings.accentColor}
            />
            <Label>Use GNOME panel indicator</Label>
            <Description>
              {extensionStatus === 'not-installed' && (
                <span className="text-amber-400">Extension not found. Install pucoti via deb/rpm package or run ./gnome-extension/install.sh from the source directory</span>
              )}
              {extensionStatus === 'not-loaded' && (
                <span className="text-amber-400">Extension installed but not loaded. Log out and back in to activate it.</span>
              )}
              {extensionStatus === 'disabled' && (
                <span>{enablingExtension ? 'Enabling extension...' : 'Extension installed but disabled. Enabling...'}</span>
              )}
              {extensionStatus === 'enabled' && (
                <span className="text-green-400">Extension active. Timer will be visible in top panel when running.</span>
              )}
            </Description>
          </CheckboxField>
        </section>
      )}

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
            <ValidatedNumericInput
              value={settings.cornerMarginTop}
              onChange={(val) => updateSettings({ cornerMarginTop: val })}
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Right margin
            </label>
            <ValidatedNumericInput
              value={settings.cornerMarginRight}
              onChange={(val) => updateSettings({ cornerMarginRight: val })}
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Bottom margin
            </label>
            <ValidatedNumericInput
              value={settings.cornerMarginBottom}
              onChange={(val) => updateSettings({ cornerMarginBottom: val })}
              min={0}
              max={500}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">
              Left margin
            </label>
            <ValidatedNumericInput
              value={settings.cornerMarginLeft}
              onChange={(val) => updateSettings({ cornerMarginLeft: val })}
              min={0}
              max={500}
            />
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="space-y-4">
        <Heading level={2}>Appearance</Heading>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-300">
            Accent Color
          </label>
          <ColorPicker
            value={settings.accentColor}
            onChange={(color) => updateSettings({ accentColor: color })}
          />
          <Text className="text-xs text-zinc-400">
            Choose the accent color used throughout the app
          </Text>
        </div>
      </section>

      {/* AI Productivity Experiment */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Heading level={2}>AI Productivity Experiment</Heading>
          <span className="text-xs text-accent font-medium px-2 py-0.5 rounded-full bg-accent/10 ring-1 ring-accent/30">
            Coming Soon
          </span>
        </div>

        <CheckboxField disabled>
          <Checkbox
            checked={settings.enableAiProductivityExperiment}
            onChange={(checked) => updateSettings({ enableAiProductivityExperiment: checked })}
            color={settings.accentColor}
            disabled
          />
          <Label>Enable AI productivity experiment mode</Label>
          <Description>
            Track your productivity with and without AI assistance. When enabled, you'll be randomly allowed or forbidden
            to use AI tools before starting each task, then compare actual time taken against your predictions.
            Based on the <a
              href="https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent/80 underline"
            >METR AI developer study</a>, but personalized to your own work patterns.
          </Description>
        </CheckboxField>
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
