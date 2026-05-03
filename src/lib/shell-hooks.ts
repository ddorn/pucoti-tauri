/**
 * User-configurable shell-command recipes (notifications, completion hook,
 * prefill hook, generic templates). Built on top of `platform.runShell`,
 * which is a no-op on web.
 */
import { platform } from './platform'

function substitute(command: string, placeholders: Record<string, string | number>): string {
  let s = command
  for (const [key, value] of Object.entries(placeholders)) {
    const replacement = typeof value === 'string'
      ? `'${value.replace(/'/g, "'\\''")}'`
      : String(value)
    s = s.replaceAll(`{${key}}`, replacement)
  }
  return s
}

export async function executeShellTemplate(
  command: string,
  placeholders: Record<string, string | number>,
  label: string,
): Promise<boolean> {
  if (!command.trim()) return false

  const substituted = substitute(command, placeholders).trim()
  const result = await platform.runShell(substituted)
  if (result === null) return false

  console.log(`[${label}] executed command: ${substituted}`)
  if (result.stdout) console.info(`[${label}] stdout: ${result.stdout}`)
  if (result.stderr) console.error(`[${label}] stderr: ${result.stderr}`)
  if (result.code !== 0) console.error(`[${label}] exited with code ${result.code}`)
  return true
}

export async function executeCustomNotification(title: string, body: string, command: string): Promise<boolean> {
  return executeShellTemplate(command, { title, body }, 'notification')
}

export async function executeCompletionHook(focus: string, predicted: number, actual: number, command: string): Promise<boolean> {
  return executeShellTemplate(command, { focus, predicted, actual }, 'completion-hook')
}

export async function executePrefillHook(command: string): Promise<string | null> {
  if (!command.trim()) return null
  const result = await platform.runShell(command.trim())
  if (result === null) return null
  if (result.code !== 0) {
    console.error(`[prefill-hook] exited with code ${result.code}`)
    if (result.stdout) console.error(`[prefill-hook] stdout: ${result.stdout}`)
    if (result.stderr) console.error(`[prefill-hook] stderr: ${result.stderr}`)
    return null
  }
  return result.stdout.trim() || null
}
