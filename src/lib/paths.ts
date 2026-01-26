import { appDataDir, resolve } from '@tauri-apps/api/path'
import { exists, mkdir } from '@tauri-apps/plugin-fs'

let dataDir: string | null = null

/**
 * Get the application data directory, creating it if necessary.
 * Caches the result for subsequent calls.
 */


export async function getDataDir(): Promise<string> {
  if (dataDir) return dataDir
  const base = await appDataDir()
  dataDir = await resolve(base, 'pucoti')

  if (!(await exists(dataDir))) {
    await mkdir(dataDir, { recursive: true })
  }
  return dataDir
}
