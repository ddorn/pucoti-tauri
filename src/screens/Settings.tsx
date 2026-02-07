import { useState, useEffect } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useApp } from '../context/AppContext'
import { Button } from '../components/catalyst/button'
import { Input } from '../components/catalyst/input'
import { Text } from '../components/catalyst/text'
import { Heading } from '../components/catalyst/heading'
import { Checkbox, CheckboxField } from '../components/catalyst/checkbox';
import { Label, Description } from '../components/catalyst/fieldset';
import { ValidatedNumericInput } from '../components/ValidatedNumericInput';
import { executeCustomNotification, executeCompletionHook, executePrefillHook } from '../lib/settings'
import { getExtensionStatus, enableExtension, disableExtension, type ExtensionStatus } from '../lib/gnome-extension';
import { sendNotification } from '@tauri-apps/plugin-notification'
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { playBell } from '../lib/sound'
import { ColorPicker } from '../components/ColorPicker'
import { RadioGroup } from '../components/RadioGroup';
import packageJson from '../../package.json'
import { getRandomAccentColor } from '../lib/colors';
import { IconChevronDown } from '@tabler/icons-react'
import { Kbd } from '../components/Kbd'

export function Settings() {
  const { settings, loading, updateSettings, resetSettings } = useSettings()
  const { updateInfo, checkForUpdatesNow } = useApp()
  const [testingNotification, setTestingNotification] = useState(false)
  const [testingBell, setTestingBell] = useState(false)
  const [testingCompletionHook, setTestingCompletionHook] = useState(false)
  const [testingPrefillHook, setTestingPrefillHook] = useState(false)
  const [prefillTestResult, setPrefillTestResult] = useState<string | null>(null)
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null)
  const [enablingExtension, setEnablingExtension] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [checkingForUpdates, setCheckingForUpdates] = useState(false)
  const [updateCheckResult, setUpdateCheckResult] = useState<'success' | 'no-updates' | 'error' | null>(null)

  // Check extension status on mount
  useEffect(() => {
    getExtensionStatus().then(setExtensionStatus)
  }, [])

  // Clear update check result when updateInfo changes (from auto-check)
  useEffect(() => {
    if (updateInfo) {
      setUpdateCheckResult(null)
    }
  }, [updateInfo])

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
      const selected = await openDialog({
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

  const timerStartOptions = [
    { id: 'nothing', name: 'Do nothing', description: 'Keep the window in its current state' },
    { id: 'corner', name: 'Switch to corner mode', description: 'Automatically switch to small corner window when starting a timer' },
    {
      id: 'minimize',
      name: 'Minimize window',
      description: extensionStatus && extensionStatus !== 'not-gnome'
        ? 'Minimize the window on timer start. Useful with the GNOME panel extension.'
        : 'Minimize the window on timer start'
    },
  ]

  const sectionClasses = 'space-y-12';
  const subsectionClasses = 'space-y-3';
  const subsectionLabelClasses = 'block text-base font-semibold text-white mb-3';
  const descriptionClasses = 'text-base text-zinc-400';
  const smallNumberInputAndUnitClasses = 'flex items-center gap-3 max-w-40'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Heading level={1} className="mb-16">Settings</Heading>

      {/* Update available banner */}
      {updateInfo && (
        <div className="mb-12 p-6 rounded-lg bg-accent/10 border-2 border-accent/30 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Heading level={3} className="text-accent mb-2">
                Update Available: {updateInfo.version}
              </Heading>
              <Text className="text-zinc-300 mb-4">
                A new version of Pucoti is ready to download.
              </Text>
              <Button
                color={settings.accentColor}
                onClick={() => openUrl(updateInfo.url)}
              >
                View Release on GitHub
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-24">
        {/* Timer */}
        <section className={sectionClasses}>
          <Heading level={2}>
            Timer
          </Heading>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Timer start percentage
            </div>
            <div className={smallNumberInputAndUnitClasses}>
              <ValidatedNumericInput
                value={settings.timerStartPercentage}
                onChange={(val) => updateSettings({ timerStartPercentage: val })}
                min={0}
                max={100}
              />
              <span className="text-base text-zinc-400">%</span>
            </div>
            <Text className={descriptionClasses}>
              Start the timer at a percentage of your prediction. Set to 80 to get a reminder 20% before your predicted time. Only applies to predict mode.
            </Text>
          </div>
        </section>

        {/* Window & Display */}
        <section className={sectionClasses}>
          <Heading level={2} className="mb-6">
            Window & Display
          </Heading>

          <div className="space-y-6">
            <div>
              <div className={subsectionLabelClasses}>
                Timer start behavior
              </div>
              <RadioGroup
                name="timer-start"
                options={timerStartOptions}
                value={settings.onTimerStart}
                onChange={(value) => updateSettings({ onTimerStart: value as 'nothing' | 'corner' | 'minimize' })}
              />
            </div>

          </div>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Window sizes
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Normal width</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.normalWindowWidth}
                    onChange={(val) => updateSettings({ normalWindowWidth: val })}
                    min={300}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Normal height</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.normalWindowHeight}
                    onChange={(val) => updateSettings({ normalWindowHeight: val })}
                    min={200}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Small width</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.smallWindowWidth}
                    onChange={(val) => updateSettings({ smallWindowWidth: val })}
                    min={200}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Small height</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.smallWindowHeight}
                    onChange={(val) => updateSettings({ smallWindowHeight: val })}
                    min={80}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
            </div>
          </div>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Corner margins
            </div>
            <Text className={descriptionClasses}>
              Distance from screen edges when in small corner mode
            </Text>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Top</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.cornerMarginTop}
                    onChange={(val) => updateSettings({ cornerMarginTop: val })}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Right</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.cornerMarginRight}
                    onChange={(val) => updateSettings({ cornerMarginRight: val })}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Bottom</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.cornerMarginBottom}
                    onChange={(val) => updateSettings({ cornerMarginBottom: val })}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <span className="text-base text-zinc-300 w-30">Left</span>
                <span className={smallNumberInputAndUnitClasses}>
                  <ValidatedNumericInput
                    value={settings.cornerMarginLeft}
                    onChange={(val) => updateSettings({ cornerMarginLeft: val })}
                  />
                  <span className="text-base text-zinc-500">px</span>
                </span>
              </div>
            </div>
            <CheckboxField>
              <Checkbox
                checked={settings.smallWindowBorderless}
                onChange={(checked) => updateSettings({ smallWindowBorderless: checked })}
                color={settings.accentColor}
              />
              <Label>Borderless small window</Label>
              <Description>Remove window decorations in small corner mode. May not work on all window managers.</Description>
            </CheckboxField>
          </div>
        </section>

        {/* Sound */}
        <section className={sectionClasses}>
          <Heading level={2} className="mb-6">
            Sound
          </Heading>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Custom bell sound
            </div>
            {settings.customBellPath ? (
              <div className={subsectionClasses}>
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
                  <Button
                    outline
                    onClick={handleTestBell}
                    disabled={testingBell}
                  >
                    {testingBell ? 'Playing...' : 'Test'}
                  </Button>
                </div>
                <Text className={descriptionClasses}>
                  Using custom bell sound
                </Text>
              </div>
            ) : (
                <div className={subsectionClasses}>
                <Button
                  outline
                  onClick={handleSelectBell}
                >
                  Select Custom Bell
                </Button>
                  <Text className={descriptionClasses}>
                  Choose a custom MP3 sound file. Leave empty to use default bell.
                </Text>
              </div>
            )}
          </div>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Bell repeat interval
            </div>
            <div className={smallNumberInputAndUnitClasses}>
              <ValidatedNumericInput
                value={settings.bellRepeatIntervalSeconds}
                onChange={(val) => updateSettings({ bellRepeatIntervalSeconds: val })}
                min={0}
              />
              <span className="text-base text-zinc-400">seconds</span>
            </div>
            <Text className={descriptionClasses}>
              How frequently the bell repeats during overtime. Set to 0 to disable repeat. Default is 20 seconds.
            </Text>
          </div>
        </section>

        {/* Hooks & Automation */}
        <section className={sectionClasses}>
          <Heading level={2} className="mb-6">
            Hooks & Automation
          </Heading>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Overtime notification command
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={settings.notificationCommand}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSettings({ notificationCommand: e.target.value })
                }
                placeholder="notify-send {title} {body}"
                className="flex-1"
              />
              <Button
                outline
                onClick={handleTestNotification}
                disabled={testingNotification}
              >
                {testingNotification ? 'Sending...' : 'Test'}
              </Button>
            </div>
            <Text className={descriptionClasses}>
              Shell command to run when the timer goes into overtime. Leave empty for default OS notifications. Use <code className="px-1 py-0.5 rounded bg-zinc-800">{'{title}'}</code> and <code className="px-1 py-0.5 rounded bg-zinc-800">{'{body}'}</code> as placeholders.
            </Text>
          </div>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Completion hook
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={settings.completionCommand}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSettings({ completionCommand: e.target.value })
                }
                placeholder="notify-send 'Done' '{focus}: {actual}s / {predicted}s'"
                className="flex-1"
              />
              <Button
                outline
                onClick={async () => {
                  setTestingCompletionHook(true)
                  try {
                    await executeCompletionHook('Sample task', 300, 420, settings.completionCommand)
                  } catch (err) {
                    console.error('Completion hook test failed:', err)
                  } finally {
                    setTestingCompletionHook(false)
                  }
                }}
                disabled={testingCompletionHook || !settings.completionCommand.trim()}
              >
                {testingCompletionHook ? 'Running...' : 'Test'}
              </Button>
            </div>
            <Text className={descriptionClasses}>
              Shell command to run when a timer is completed. Available placeholders: <code className="px-1 py-0.5 rounded bg-zinc-800">{'{focus}'}</code> (focus text), <code className="px-1 py-0.5 rounded bg-zinc-800">{'{predicted}'}</code> (predicted seconds), <code className="px-1 py-0.5 rounded bg-zinc-800">{'{actual}'}</code> (actual seconds).
            </Text>
          </div>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Prefill hook
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={settings.prefillCommand}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateSettings({ prefillCommand: e.target.value })
                }
                placeholder="echo 'Work on project 25m'"
                className="flex-1"
              />
              <Button
                outline
                onClick={async () => {
                  setTestingPrefillHook(true)
                  setPrefillTestResult(null)
                  try {
                    const result = await executePrefillHook(settings.prefillCommand)
                    setPrefillTestResult(result ?? '(empty or failed)')
                  } catch (err) {
                    console.error('Prefill hook test failed:', err)
                    setPrefillTestResult('(error)')
                  } finally {
                    setTestingPrefillHook(false)
                  }
                }}
                disabled={testingPrefillHook || !settings.prefillCommand.trim()}
              >
                {testingPrefillHook ? 'Running...' : 'Test'}
              </Button>
            </div>
            {prefillTestResult !== null && (
              <Text className={descriptionClasses}>
                Output: <code className="px-1 py-0.5 rounded bg-zinc-800">{prefillTestResult}</code>
              </Text>
            )}
            <Text className={descriptionClasses}>
              Shell command whose stdout will prefill the intent input field. Use <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> to trigger. Leave empty to disable.
            </Text>
          </div>

          {/* GNOME Panel Indicator - Linux only */}
          {extensionStatus && extensionStatus !== 'not-gnome' && (
            <div className="pt-4 border-t border-white/10">
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
                    } else if (!checked && extensionStatus === 'enabled') {
                      setEnablingExtension(true);
                      await disableExtension();
                      setEnablingExtension(false);
                      setExtensionStatus('disabled')
                    }
                  }}
                  color={settings.accentColor}
                />
                <Label>GNOME panel indicator</Label>
                <Description>
                  {extensionStatus === 'not-installed' && (
                    <span className="text-amber-400">Extension not found. Install pucoti via deb/rpm package or run ./gnome-extension/install.sh from the source directory</span>
                  )}
                  {extensionStatus === 'not-loaded' && (
                    <span className="text-amber-400">Extension installed but not loaded. Log out and back in to activate it.</span>
                  )}
                  {extensionStatus === 'disabled' && (
                    <span>{enablingExtension ? 'Enabling extension...' : 'Extension is setup but disabled.'}</span>
                  )}
                  {extensionStatus === 'enabled' && (
                    <span>{enablingExtension ? 'Disabling extension...' : 'Extension active. Timer will be visible in top panel when running.'}</span>
                  )}
                </Description>
              </CheckboxField>
            </div>
          )}
        </section>

        {/* Appearance */}
        <section className={sectionClasses}>
          <Heading level={2} className="mb-6">
            Appearance
          </Heading>

          <div className={subsectionClasses}>
            <div className={subsectionLabelClasses}>
              Accent color
            </div>
            <ColorPicker
              value={settings.accentColor}
              onChange={(color) => updateSettings({ accentColor: color, randomColorOnCompletion: false })}
              randomEnabled={settings.randomColorOnCompletion}
              onRandomSelect={() => updateSettings({ randomColorOnCompletion: true, accentColor: getRandomAccentColor() })}
            />
            <Text className={descriptionClasses}>
              Choose the accent color used throughout the app.
              {settings.randomColorOnCompletion && (
                <span className="text-accent"> Random mode enabled - color will change after each completed timer.</span>
              )}
            </Text>
          </div>
        </section>

        {/* Updates */}
        <section className={sectionClasses}>
          <Heading level={2}>
            Updates
          </Heading>

          <div className={subsectionClasses}>
            <CheckboxField>
              <Checkbox
                checked={settings.checkForUpdatesAutomatically}
                onChange={(checked) => updateSettings({ checkForUpdatesAutomatically: checked })}
                color={settings.accentColor}
              />
              <Label>Check for updates automatically</Label>
              <Description>
                Check for new versions when the app starts
              </Description>
            </CheckboxField>
          </div>

          <div className={subsectionClasses}>
            <Button
              onClick={async () => {
                setCheckingForUpdates(true)
                setUpdateCheckResult(null)
                try {
                  const result = await checkForUpdatesNow()
                  setUpdateCheckResult(result)
                } finally {
                  setCheckingForUpdates(false)
                }
              }}
              disabled={checkingForUpdates}
            >
              {checkingForUpdates ? 'Checking...' : 'Check for Updates Now'}
            </Button>

            {/* Status messages */}
            {updateCheckResult === 'no-updates' && (
              <Text className={descriptionClasses}>
                You're up to date! Running version {packageJson.version}
              </Text>
            )}
            {updateCheckResult === 'error' && (
              <Text className="text-base text-red-400">
                Failed to check for updates. Please check your internet connection and try again.
              </Text>
            )}
            {updateInfo && (
              <Text className={descriptionClasses}>
                Version {updateInfo.version} is available.{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    openUrl(updateInfo.url)
                  }}
                  className="text-accent hover:underline"
                >
                  View release
                </a>
              </Text>
            )}
          </div>
        </section>

        {/* Advanced */}
        <section className="pt-6 border-t border-white/10">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-base font-semibold text-zinc-200 hover:text-zinc-50 transition-colors"
          >
            <IconChevronDown className={`size-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Advanced
          </button>

          {showAdvanced && (
            <div className="mt-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Heading level={3}>
                    AI Productivity Experiment
                  </Heading>
                  <span className="text-base text-accent font-medium px-2 py-0.5 rounded-full bg-accent/10 ring-1 ring-accent/30">
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
              </div>

              <div className="pt-4 border-t border-white/10">
                <Button
                  plain
                  onClick={resetSettings}
                >
                  Reset to Defaults
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Version */}
        <section className="pt-6 text-center">
          <Text className="text-base text-zinc-500">
            Pucoti v{packageJson.version}
          </Text>
        </section>
      </div>
    </div>
  )
}
