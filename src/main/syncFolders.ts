import { access, constants as fsConstants } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import type { SyncFolderCandidate } from '../shared/settings'

const CHECK_TIMEOUT_MS = 1500
const DRIVE_LETTERS = 'DEFGHIJKLMNOPQRSTUVWXYZ'

type Probe = { label: string; path: string }

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, guard]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function exists(path: string): Promise<boolean> {
  try {
    await withTimeout(access(path, fsConstants.F_OK), CHECK_TIMEOUT_MS)
    return true
  } catch {
    return false
  }
}

/**
 * 研究室共有の候補になる同期フォルダを列挙する。
 * 仮想ドライブ（Google Drive for Desktop の G: 等）は D〜Z を調べる。
 * ネットワーク共有（UNC）は対象外（手入力）。
 */
export async function detectSyncFolders(): Promise<SyncFolderCandidate[]> {
  const home = homedir()
  const probes: Probe[] = []

  const oneDriveRoot = process.env.OneDrive || process.env.OneDriveConsumer || join(home, 'OneDrive')
  probes.push({ label: 'OneDrive', path: oneDriveRoot })

  probes.push({ label: 'MEGA', path: join(home, 'MEGAsync') })
  probes.push({ label: 'MEGA', path: join(home, 'MEGA') })
  probes.push({ label: 'Dropbox', path: join(home, 'Dropbox') })
  probes.push({ label: 'iCloud Drive', path: join(home, 'iCloudDrive') })
  probes.push({ label: 'Google Drive', path: join(home, 'Google Drive') })
  probes.push({ label: 'Google Drive', path: join(home, 'My Drive') })

  for (const letter of DRIVE_LETTERS) {
    probes.push({ label: 'Google Drive（マイドライブ）', path: `${letter}:\\マイドライブ` })
    probes.push({ label: 'Google Drive（マイドライブ）', path: `${letter}:\\My Drive` })
    probes.push({ label: 'Google Drive（共有ドライブ）', path: `${letter}:\\共有ドライブ` })
  }

  const results = await Promise.all(
    probes.map(async (p) => ({ ...p, ok: await exists(p.path) }))
  )

  const seen = new Set<string>()
  const out: SyncFolderCandidate[] = []
  for (const r of results) {
    if (!r.ok) continue
    const key = r.path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label: r.label, path: r.path })
  }
  return out
}
