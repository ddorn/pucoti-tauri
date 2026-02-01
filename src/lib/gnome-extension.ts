import { Command } from '@tauri-apps/plugin-shell'
import { exists } from '@tauri-apps/plugin-fs'
import { homeDir } from '@tauri-apps/api/path'

const EXTENSION_UUID = 'pucoti@pucoti.dev'

export type ExtensionStatus =
  | 'enabled'           // Extension is installed and enabled
  | 'disabled'          // Extension is installed but disabled
  | 'not-loaded'        // Files exist but GNOME hasn't loaded it (needs re-login)
  | 'not-installed'     // Extension files not found
  | 'not-gnome'         // Not running GNOME

/**
 * Detect if currently running under GNOME (not just if GNOME is installed)
 * Checks $XDG_CURRENT_DESKTOP which is set by the desktop environment
 */
export async function detectGnome(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', 'echo $XDG_CURRENT_DESKTOP']);
    const result = await cmd.execute();
    const desktop = result.stdout.trim().toLowerCase();
    console.log('[gnome] XDG_CURRENT_DESKTOP:', desktop);

    // Handle various GNOME variants: "GNOME", "ubuntu:GNOME", "pop:GNOME", etc.
    const isGnome = desktop.includes('gnome');
    console.log('[gnome] Running under GNOME:', isGnome);
    return isGnome;
  } catch (err) {
    console.error('[gnome] GNOME detection failed:', err);
    return false;
  }
}

/**
 * Check the status of the GNOME extension.
 */
export async function getExtensionStatus(): Promise<ExtensionStatus> {
  // First check if we're actually running GNOME
  if (!await detectGnome()) {
    return 'not-gnome';
  }

  try {
    // Try to get extension info via gnome-extensions command
    const cmd = Command.create('run-sh', ['-c', `gnome-extensions info ${EXTENSION_UUID}`])
    const result = await cmd.execute()

    if (result.code === 0) {
      // Extension is known to GNOME - check if enabled
      const output = result.stdout
      if (output.includes('State: ENABLED') || output.includes('State: ACTIVE')) {
        return 'enabled'
      }
      return 'disabled'
    }

    // Extension not found by GNOME - check if files exist (needs re-login)
    const filesExist = await extensionFilesExist()
    if (filesExist) {
      return 'not-loaded'
    }

    return 'not-installed'
  } catch {
    // gnome-extensions command not available
    return 'not-installed'
  }
}

/**
 * Check if extension files exist on disk (system-wide or user directory).
 */
async function extensionFilesExist(): Promise<boolean> {
  try {
    // Check system-wide location (deb/rpm install)
    const systemPath = `/usr/share/gnome-shell/extensions/${EXTENSION_UUID}/metadata.json`
    if (await exists(systemPath)) {
      return true
    }

    // Check user location (manual install)
    const home = await homeDir()
    const userPath = `${home}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}/metadata.json`
    if (await exists(userPath)) {
      return true
    }

    return false
  } catch (error) {
    console.error('Failed to check if GNOME extension files exist', error)
    return false
  }
}

/**
 * Try to enable the GNOME extension. Returns true if successful.
 */
export async function enableExtension(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', `gnome-extensions enable ${EXTENSION_UUID}`])
    const result = await cmd.execute()
    return result.code === 0
  } catch (error) {
    console.error('Failed to enable GNOME extension', error);
    return false;
  }
}

/**
 * Try to disable the GNOME extension. Returns true if successful.
 */
export async function disableExtension(): Promise<boolean> {
  try {
    const cmd = Command.create('run-sh', ['-c', `gnome-extensions disable ${EXTENSION_UUID}`]);
    const result = await cmd.execute();
    return result.code === 0;
  } catch (error) {
    console.error('Failed to disable GNOME extension', error)
    return false
  }
}
