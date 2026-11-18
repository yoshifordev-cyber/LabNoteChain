export type AppLanguage = 'ja' | 'en'
export type AppTheme = 'light' | 'dark' | 'system'
export type AppFontSize = 'sm' | 'md' | 'lg'
export type AppFontFamily = 'system' | 'arial' | 'yu-gothic' | 'meiryo' | 'sans' | 'serif'

/**
 * 研究室共有：HTTP API 固定ではなく、共有フォルダ（NAS / 共有PC / 同期フォルダ）を使う。
 * Wi-Fi・有線・VPN 経由の UNC パスや、同一PC上の共有ディレクトリなど運用に合わせて選べる。
 */
export type LabServerSettings = {
  enabled: boolean
  /** 共有ルート。例: \\\\lab-pc\\notebooks や Z:\\LabShare */
  sharePath: string
  /** ページ保存・確定時に自動でタイムスタンプを共有へ書く */
  autoAnchor: boolean
}

/** UNC / 通常パスを Windows 向けに正規化 */
export function normalizeSharePath(raw: string): string {
  let p = raw.trim().replace(/\//g, '\\')
  if (p.startsWith('\\\\')) {
    const rest = p.slice(2).replace(/\\+/g, '\\')
    p = `\\\\${rest}`
  } else {
    p = p.replace(/\\+/g, '\\')
  }
  if (p.length > 3 && p.endsWith('\\')) {
    p = p.replace(/\\+$/, '')
  }
  return p
}

export type CloudSettings = {
  enabled: boolean
  /** 将来の課金クラウド用。未接続時は空 */
  endpoint: string
}

export type AppSettings = {
  version: 1
  language: AppLanguage
  /** null = アプリ既定フォルダ（userData/notebooks） */
  dataDir: string | null
  theme: AppTheme
  fontSize: AppFontSize
  fontFamily: AppFontFamily
  labServer: LabServerSettings
  cloud: CloudSettings
}

export type AppSettingsPublic = AppSettings & {
  /** 実際に使っている保存先（既定解決後） */
  resolvedDataDir: string
  defaultDataDir: string
}

export type LabShareProbe = {
  enabled: boolean
  configured: boolean
  reachable: boolean
  checkedAt: string
  sharePath: string
  latencyMs: number | null
  message: string
}

export type BackupExportResult = {
  path: string
  notebookCount: number
  attachmentCount: number
  unverifiedNotebooks: number
}

export type BackupImportResult = {
  restored: number
  skipped: number
  failed: number
  foldersMerged: number
  messages: string[]
}

/** PC上で確認できた同期フォルダ（OneDrive / Google Drive for Desktop / MEGA など） */
export type SyncFolderCandidate = {
  label: string
  /** 同期ルート。共有先は下にサブフォルダ LabNoteChain を作る */
  path: string
}

export type LabTimestampRecord = {
  format: 'integrity-lab-share-timestamp/v1'
  id: string
  notebookId: string
  notebookTitle: string
  entryId: string
  entryHash: string
  entryKind: string
  authorName: string
  userKey: string
  signerName: string | null
  recordedAt: string
  anchoredAt: string
  machineName: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  language: 'en',
  dataDir: null,
  theme: 'light',
  fontSize: 'md',
  fontFamily: 'system',
  labServer: {
    enabled: false,
    sharePath: '',
    autoAnchor: true
  },
  cloud: {
    enabled: false,
    endpoint: ''
  }
}

export type SettingsPatch = Partial<
  Omit<AppSettings, 'version' | 'labServer' | 'cloud'>
> & {
  labServer?: Partial<LabServerSettings>
  cloud?: Partial<CloudSettings>
}
