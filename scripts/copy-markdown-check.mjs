/**
 * Markdown UI チェック原稿を標準出力／クリップボードへ出す。
 * 使い方:
 *   node scripts/copy-markdown-check.mjs
 *   node scripts/copy-markdown-check.mjs --clipboard   (Windows)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mdPath = join(root, 'fixtures', 'markdown-ui-check.md')
const text = readFileSync(mdPath, 'utf8')

const toClipboard = process.argv.includes('--clipboard')

if (toClipboard) {
  if (process.platform === 'win32') {
    const ps = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', 'Set-Clipboard -Value $input'],
      { input: text, encoding: 'utf8' }
    )
    if (ps.status !== 0) {
      console.error(ps.stderr || 'clipboard failed')
      process.exit(1)
    }
    console.error('Copied fixtures/markdown-ui-check.md to clipboard.')
  } else {
    console.error('--clipboard is implemented for Windows only. Printing instead.')
    process.stdout.write(text)
  }
} else {
  process.stdout.write(text)
}
