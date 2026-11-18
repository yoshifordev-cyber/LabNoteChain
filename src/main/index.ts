import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { join } from 'path'
import {
  addCorrection,
  addEntry,
  attachSignature,
  createNotebook,
  exportEvidence,
  getAttachmentPath,
  getNotebook,
  listNotebooks,
  readAttachmentDataUrl,
  renameNotebook,
  saveDataUrlToTemp,
  sealNotebook,
  searchAll,
  verify
} from './store'
import {
  clearIdentity,
  enrollIdentity,
  getIdentityPublic,
  signEntryHash
} from './identity'
import { getDeviceAuthMethod } from './deviceAuth'
import { getSettingsPublic, updateSettings } from './settingsStore'
import {
  anchorEntryToLabShare,
  normalizeSharePath,
  probeLabShare,
  tryAutoAnchor
} from './labShare'
import { detectSyncFolders } from './syncFolders'
import { exportBackup, importBackup } from './backup'
import {
  createFolder,
  deleteFolder,
  listFolders,
  moveNotebookToFolder,
  renameFolder
} from './library'
import type { AddEntryInput, CreateNotebookInput, Notebook } from '../shared/types'
import type { SettingsPatch } from '../shared/settings'

function withLabAnchor(notebook: Notebook): Notebook {
  const last = notebook.entries.at(-1)
  if (last) tryAutoAnchor(notebook, last.id)
  return notebook
}

function resolveAppIcon(): string {
  const candidates = [
    join(process.resourcesPath, 'icon.ico'),
    join(__dirname, '../../build/icon.ico'),
    join(__dirname, '../../resources/icon.ico'),
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../resources/icon.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return join(__dirname, '../../build/icon.ico')
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: 'LabNoteChain',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  await win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function wrap<T>(fn: () => T): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function wrapAsync<T>(
  fn: () => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

ipcMain.handle('notebooks:list', () => wrap(() => listNotebooks()))
ipcMain.handle('notebooks:search', (_e, query: string) => wrap(() => searchAll(query)))
ipcMain.handle('notebooks:get', (_e, id: string) => wrap(() => getNotebook(id)))
ipcMain.handle('notebooks:rename', (_e, id: string, title: string) =>
  wrap(() => renameNotebook(id, title))
)
ipcMain.handle('notebooks:create', (_e, input: CreateNotebookInput) =>
  wrap(() => createNotebook(input))
)

ipcMain.handle('library:listFolders', () => wrap(() => listFolders()))
ipcMain.handle('library:createFolder', (_e, name: string) => wrap(() => createFolder(name)))
ipcMain.handle('library:renameFolder', (_e, folderId: string, name: string) =>
  wrap(() => renameFolder(folderId, name))
)
ipcMain.handle('library:deleteFolder', (_e, folderId: string) =>
  wrap(() => deleteFolder(folderId))
)
ipcMain.handle(
  'library:moveNotebook',
  (_e, input: { notebookId: string; folderId: string | null }) =>
    wrap(() => moveNotebookToFolder(input.notebookId, input.folderId))
)
ipcMain.handle('notebooks:addEntry', (_e, input: AddEntryInput) =>
  wrap(() => withLabAnchor(addEntry(input)))
)
ipcMain.handle('notebooks:addCorrection', (_e, input: AddEntryInput) =>
  wrap(() => withLabAnchor(addCorrection(input)))
)
ipcMain.handle('notebooks:seal', (_e, id: string) => wrap(() => withLabAnchor(sealNotebook(id))))
ipcMain.handle('notebooks:verify', (_e, id: string) => wrap(() => verify(id)))

ipcMain.handle('notebooks:exportEvidence', async (_e, id: string) => {
  try {
    const notebook = getNotebook(id)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '証跡パッケージを保存',
      defaultPath: `${notebook.title}-evidence.json`,
      filters: [{ name: 'Evidence JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) {
      return { ok: false, error: 'Cancelled.' }
    }
    const pkg = exportEvidence(id, filePath)
    return { ok: true, data: { path: filePath, verify: pkg.verify } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('dialog:pickFiles', async () => {
  const result = await dialog.showOpenDialog({
    title: '添付ファイルを選択',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: '研究データ',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'csv', 'txt', 'md', 'json']
      },
      { name: 'すべて', extensions: ['*'] }
    ]
  })
  if (result.canceled) return { ok: true, data: [] as string[] }
  return { ok: true, data: result.filePaths }
})

ipcMain.handle('attachments:open', (_e, notebookId: string, storedName: string) =>
  wrap(() => {
    const path = getAttachmentPath(notebookId, storedName)
    void shell.openPath(path)
    return true
  })
)

ipcMain.handle('attachments:saveDataUrl', (_e, dataUrl: string, fileName: string) =>
  wrap(() => saveDataUrlToTemp(dataUrl, fileName))
)

ipcMain.handle('attachments:readDataUrl', (_e, notebookId: string, storedName: string) =>
  wrap(() => readAttachmentDataUrl(notebookId, storedName))
)

ipcMain.handle('settings:get', () => wrap(() => getSettingsPublic()))
ipcMain.handle('settings:update', (_e, patch: SettingsPatch) =>
  wrap(() => {
    updateSettings(patch)
    return getSettingsPublic()
  })
)
ipcMain.handle('backup:export', async () => {
  try {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const result = await dialog.showSaveDialog({
      title: 'バックアップの書き出し',
      defaultPath: `LabNoteChain-backup-${stamp}.json`,
      filters: [{ name: 'LabNoteChain backup', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) {
      return { ok: false, error: 'Cancelled.' }
    }
    return { ok: true, data: exportBackup(result.filePath) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('backup:import', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'バックアップから復元',
      properties: ['openFile'],
      filters: [{ name: 'LabNoteChain backup', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Cancelled.' }
    }
    return { ok: true, data: importBackup(result.filePaths[0]) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('settings:pickDataDir', async () => {
  try {
    const current = getSettingsPublic()
    const result = await dialog.showOpenDialog({
      title: '記録の保存先フォルダ',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: current.resolvedDataDir
    })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Cancelled.' }
    }
    updateSettings({ dataDir: result.filePaths[0] })
    return { ok: true, data: getSettingsPublic() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})

ipcMain.handle('lab:probe', (_e, opts?: { write?: boolean }) =>
  wrapAsync(() => probeLabShare(5000, Boolean(opts?.write)))
)
ipcMain.handle('lab:detectSyncFolders', () => wrapAsync(() => detectSyncFolders()))
ipcMain.handle('lab:setSharePath', (_e, rawPath: string) =>
  wrap(() => {
    const sharePath = normalizeSharePath(String(rawPath ?? ''))
    if (!sharePath) throw new Error('共有パスが空です。')
    updateSettings({ labServer: { enabled: true, sharePath } })
    return getSettingsPublic()
  })
)
ipcMain.handle('lab:pickShareDir', async () => {
  try {
    const current = getSettingsPublic()
    const result = await dialog.showOpenDialog({
      title: '研究室の共有フォルダ（割り当てドライブ / 既に開いている共有）',
      message:
        'ネットワーク上の共有PCは、先にエクスプローラーで \\\\共有PC名 を開くか、下のパス欄に UNC を直接入力してください。',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: current.labServer.sharePath || undefined
    })
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, error: 'Cancelled.' }
    }
    updateSettings({
      labServer: { enabled: true, sharePath: normalizeSharePath(result.filePaths[0]) }
    })
    return { ok: true, data: getSettingsPublic() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
})
ipcMain.handle('lab:openNetwork', async () => {
  try {
    if (process.platform === 'win32') {
      await new Promise<void>((resolve, reject) => {
        execFile('explorer.exe', ['\\\\'], (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      return { ok: true as const, data: true }
    }
    await shell.openPath('/')
    return { ok: true as const, data: true }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
})
ipcMain.handle(
  'lab:anchorEntry',
  (_e, input: { notebookId: string; entryId: string }) =>
    wrap(() => {
      const notebook = getNotebook(input.notebookId)
      const entry = notebook.entries.find((e) => e.id === input.entryId)
      if (!entry) throw new Error('ページが見つかりません。')
      return anchorEntryToLabShare(notebook, entry)
    })
)

ipcMain.handle('identity:get', () => wrap(() => getIdentityPublic()))
ipcMain.handle('identity:deviceAuthAvailable', () =>
  wrapAsync(async () => {
    const method = await getDeviceAuthMethod()
    return method !== 'unavailable'
  })
)
ipcMain.handle('identity:enroll', (_e, input: { signerName: string }) =>
  wrapAsync(() => enrollIdentity(input))
)
ipcMain.handle('identity:clear', () =>
  wrap(() => {
    clearIdentity()
    return true
  })
)
ipcMain.handle(
  'identity:signEntry',
  (_e, input: { notebookId: string; entryId: string }) =>
    wrapAsync(async () => {
      const notebook = getNotebook(input.notebookId)
      const entry = notebook.entries.find((e) => e.id === input.entryId)
      if (!entry) throw new Error('ページが見つかりません。')
      const signature = await signEntryHash(entry.hash)
      const signed = attachSignature(input.notebookId, input.entryId, signature)
      return withLabAnchor(signed)
    })
)
