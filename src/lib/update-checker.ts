export interface ReleaseAsset {
  name: string
  url: string
  browser_download_url: string
  size: number
}

export interface UpdateInfo {
  version: string
  url: string
  publishedAt: string
  body: string
  assets: ReleaseAsset[]
}

/**
 * Check if a version string is newer than the current version.
 * Assumes semver format (v1.2.3, pucoti-v1.2.3, or 1.2.3)
 */
function isNewerVersion(latest: string, current: string): boolean {
  const parseVersion = (v: string) => {
    // Strip common prefixes: "v", "pucoti-v", "pucoti-"
    const cleaned = v.replace(/^(pucoti-)?v?/, '')
    return cleaned.split('.').map(n => parseInt(n, 10))
  }

  const latestParts = parseVersion(latest)
  const currentParts = parseVersion(current)

  for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
    const l = latestParts[i] || 0
    const c = currentParts[i] || 0

    if (l > c) return true
    if (l < c) return false
  }

  return false
}

/**
 * Check GitHub releases for updates.
 * Returns UpdateInfo if a newer version is available, null if up to date.
 * Throws an error if the check fails.
 */
export async function checkForUpdates(
  currentVersion: string,
  owner: string = 'ddorn',
  repo: string = 'pucoti-tauri'
): Promise<UpdateInfo | null> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`)
  }

  const release = await response.json()
  const latestVersion = release.tag_name
  console.log('[Update Checker] Latest release:', latestVersion, 'Current:', currentVersion)

  if (isNewerVersion(latestVersion, currentVersion)) {
    console.log('[Update Checker] Newer version available:', latestVersion)
    return {
      version: latestVersion,
      url: release.html_url,
      publishedAt: release.published_at,
      body: release.body || '',
      assets: release.assets || []
    }
  }

  console.log('[Update Checker] Current version is up to date')
  return null
}

