import type { AppFontFamily, AppFontSize, AppTheme } from '../../shared/settings'

const FONT_MAP: Record<AppFontFamily, string> = {
  system: '"Segoe UI", "Yu Gothic UI", "Meiryo UI", "Hiragino Sans", sans-serif',
  arial: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
  'yu-gothic': '"Yu Gothic UI", "Yu Gothic", "Hiragino Sans", sans-serif',
  meiryo: 'Meiryo, "Meiryo UI", sans-serif',
  sans: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
  serif: '"Yu Mincho", "Hiragino Mincho ProN", "Times New Roman", serif'
}

function resolvedTheme(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyAppearance(input: {
  theme: AppTheme
  fontSize: AppFontSize
  fontFamily: AppFontFamily
}): void {
  const root = document.documentElement
  root.dataset.theme = resolvedTheme(input.theme)
  root.dataset.fontSize = input.fontSize
  root.style.setProperty('--font', FONT_MAP[input.fontFamily])
}

export function watchSystemTheme(
  theme: AppTheme,
  onChange: () => void
): () => void {
  if (theme !== 'system') return () => undefined
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
