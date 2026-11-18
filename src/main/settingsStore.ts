import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import {
  DEFAULT_SETTINGS,
  normalizeSharePath,
  type AppSettings,
  type AppSettingsPublic,
  type SettingsPatch
} from '../shared/settings'

function settingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}

export function defaultDataDir(): string {
  return join(app.getPath('userData'), 'notebooks')
}

function migrateLab(
  lab: Partial<AppSettings['labServer']> & { baseUrl?: string } | undefined
): AppSettings['labServer'] {
  const shareFromNew = String(lab?.sharePath ?? '').trim()
  const legacy = String(lab?.baseUrl ?? '').trim()
  // 旧 HTTP URL 設定は共有パスに転用しない。パスらしいものだけ引き継ぐ。
  const legacyPath =
    legacy && !/^https?:\/\//i.test(legacy) && (/^[a-zA-Z]:[\\/]/.test(legacy) || legacy.startsWith('\\\\'))
      ? legacy
      : ''
  return {
    enabled: Boolean(lab?.enabled),
    sharePath: normalizeSharePath(shareFromNew || legacyPath),
    autoAnchor: lab?.autoAnchor !== false
  }
}

/** OS の表示言語が日本語なら ja、それ以外は en（設定ファイルが無い初回起動時の既定） */
function detectLanguage(): AppSettings['language'] {
  try {
    return app.getLocale().toLowerCase().startsWith('ja') ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}

function defaults(): AppSettings {
  return { ...DEFAULT_SETTINGS, language: detectLanguage() }
}

function normalize(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const base = { ...defaults(), ...(raw ?? {}) }
  return {
    version: 1,
    language: base.language === 'ja' ? 'ja' : 'en',
    dataDir: typeof base.dataDir === 'string' && base.dataDir.trim() ? base.dataDir.trim() : null,
    theme:
      base.theme === 'dark' || base.theme === 'system' || base.theme === 'light'
        ? base.theme
        : 'light',
    fontSize: base.fontSize === 'sm' || base.fontSize === 'lg' ? base.fontSize : 'md',
    fontFamily:
      base.fontFamily === 'arial' ||
      base.fontFamily === 'yu-gothic' ||
      base.fontFamily === 'meiryo' ||
      base.fontFamily === 'sans' ||
      base.fontFamily === 'serif' ||
      base.fontFamily === 'system'
        ? base.fontFamily
        : 'system',
    labServer: migrateLab(base.labServer as AppSettings['labServer'] & { baseUrl?: string }),
    cloud: {
      enabled: Boolean(base.cloud?.enabled),
      endpoint: String(base.cloud?.endpoint ?? '').trim()
    }
  }
}

export function loadSettings(): AppSettings {
  const path = settingsPath()
  if (!existsSync(path)) return defaults()
  try {
    return normalize(JSON.parse(readFileSync(path, 'utf8')) as Partial<AppSettings>)
  } catch {
    return defaults()
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next = normalize(settings)
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function updateSettings(patch: SettingsPatch): AppSettings {
  const cur = loadSettings()
  return saveSettings({
    ...cur,
    ...patch,
    version: 1,
    labServer: { ...cur.labServer, ...(patch.labServer ?? {}) },
    cloud: { ...cur.cloud, ...(patch.cloud ?? {}) }
  })
}

export function resolveDataDir(settings: AppSettings = loadSettings()): string {
  const dir = settings.dataDir?.trim() || defaultDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getSettingsPublic(): AppSettingsPublic {
  const settings = loadSettings()
  return {
    ...settings,
    resolvedDataDir: resolveDataDir(settings),
    defaultDataDir: defaultDataDir()
  }
}
