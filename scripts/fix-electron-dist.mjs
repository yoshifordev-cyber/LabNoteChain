/**
 * electron の postinstall は、パスに非ASCII文字があると Windows で展開に失敗することがある。
 * キャッシュ済み zip を ASCII 一時ディレクトリへ展開してから node_modules へコピーする。
 */
import { existsSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const electronPkg = require('../node_modules/electron/package.json')
const version = electronPkg.version
const zipName = `electron-v${version}-win32-x64.zip`
const cacheRoot = join(homedir(), 'AppData', 'Local', 'electron', 'Cache')
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(projectRoot, 'node_modules', 'electron', 'dist')
const pathTxt = join(projectRoot, 'node_modules', 'electron', 'path.txt')

function findZip(dir) {
  if (!existsSync(dir)) return null
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) {
      const found = findZip(full)
      if (found) return found
    } else if (name.name === zipName) {
      return full
    }
  }
  return null
}

if (existsSync(join(dest, 'electron.exe')) && existsSync(pathTxt)) {
  console.log('electron dist already present')
  process.exit(0)
}

const zip = findZip(cacheRoot)
if (!zip) {
  console.warn(`Cached ${zipName} not found. Run: npm install electron@${version}`)
  process.exit(0)
}

const tmp = 'C:\\electron-dist-tmp'
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${tmp}' -Force`], {
  stdio: 'inherit'
})

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })

function copyTree(from, to) {
  mkdirSync(to, { recursive: true })
  for (const ent of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, ent.name)
    const out = join(to, ent.name)
    if (ent.isDirectory()) copyTree(src, out)
    else copyFileSync(src, out)
  }
}

copyTree(tmp, dest)
writeFileSync(pathTxt, 'electron.exe')
console.log('electron dist fixed ->', dest)
