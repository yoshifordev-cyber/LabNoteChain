import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import type { LibraryFolder, Notebook, VerifyResult } from '../shared/types'
import { verifyNotebook } from '../shared/verify'
import { getNotebook, listNotebooks, notebookDataRoot } from './store'
import { listFolders, mergeLibraryFolders } from './library'

export const BACKUP_FORMAT = 'labnotechain-backup/v1' as const

type BackupAttachment = {
  storedName: string
  sha256: string
  dataBase64: string
}

type BackupNotebook = {
  notebook: Notebook
  /** 書き出し時点の検証結果。改ざん痕跡を消さないため、そのまま残す */
  verifyAtExport: VerifyResult
  attachments: BackupAttachment[]
}

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  exportedAt: string
  library: { version: 1; folders: LibraryFolder[] }
  notebooks: BackupNotebook[]
}

import type { BackupExportResult, BackupImportResult } from '../shared/settings'

function attachmentsDirFor(notebookId: string): string {
  return join(notebookDataRoot(), notebookId, 'attachments')
}

function safeStoredName(name: string): boolean {
  return basename(name) === name && !name.includes('..') && name.length > 0
}

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function exportBackup(destPath: string): BackupExportResult {
  const summaries = listNotebooks()
  const notebooks: BackupNotebook[] = []
  let attachmentCount = 0
  let unverified = 0

  for (const s of summaries) {
    const notebook = getNotebook(s.id)
    const attDir = attachmentsDirFor(notebook.id)
    const verifyAtExport = verifyNotebook(notebook, attDir)
    if (!verifyAtExport.ok) unverified += 1

    const attachments: BackupAttachment[] = []
    const seen = new Set<string>()
    for (const entry of notebook.entries) {
      for (const att of entry.attachments) {
        if (seen.has(att.storedName)) continue
        seen.add(att.storedName)
        if (!safeStoredName(att.storedName)) continue
        const file = join(attDir, att.storedName)
        if (!existsSync(file)) continue
        const buf = readFileSync(file)
        attachments.push({
          storedName: att.storedName,
          sha256: sha256Buffer(buf),
          dataBase64: buf.toString('base64')
        })
        attachmentCount += 1
      }
    }

    notebooks.push({ notebook, verifyAtExport, attachments })
  }

  const file: BackupFile = {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    library: { version: 1, folders: listFolders() },
    notebooks
  }

  writeFileSync(destPath, JSON.stringify(file), 'utf8')

  return {
    path: destPath,
    notebookCount: notebooks.length,
    attachmentCount,
    unverifiedNotebooks: unverified
  }
}

/**
 * 復元: 既存 ID のノートは上書きせずスキップ。
 * 取り込み後に連鎖・署名・添付ハッシュを再検証し、不整合なら取り消す。
 */
export function importBackup(srcPath: string): BackupImportResult {
  const raw = JSON.parse(readFileSync(srcPath, 'utf8')) as Partial<BackupFile>
  if (raw.format !== BACKUP_FORMAT || !Array.isArray(raw.notebooks)) {
    throw new Error('LabNoteChain のバックアップ形式ではありません。')
  }

  const result: BackupImportResult = {
    restored: 0,
    skipped: 0,
    failed: 0,
    foldersMerged: 0,
    messages: []
  }
  const restoredIds = new Set<string>()

  for (const item of raw.notebooks) {
    const nb = item.notebook
    if (!nb || typeof nb.id !== 'string') {
      result.failed += 1
      result.messages.push('ノート情報が壊れているため取り込みませんでした。')
      continue
    }

    const dir = join(notebookDataRoot(), nb.id)
    if (existsSync(join(dir, 'notebook.json'))) {
      result.skipped += 1
      result.messages.push(`既存のため省略: ${nb.title}`)
      continue
    }

    const attDir = attachmentsDirFor(nb.id)
    mkdirSync(attDir, { recursive: true })

    let attachmentsOk = true
    for (const att of item.attachments ?? []) {
      if (!safeStoredName(att.storedName)) {
        attachmentsOk = false
        continue
      }
      const buf = Buffer.from(att.dataBase64, 'base64')
      if (sha256Buffer(buf) !== att.sha256) {
        attachmentsOk = false
        continue
      }
      writeFileSync(join(attDir, att.storedName), buf)
    }

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'notebook.json'), JSON.stringify(nb, null, 2), 'utf8')

    const verifyNow = verifyNotebook(nb, attDir)
    if (!verifyNow.ok || !attachmentsOk) {
      rmSync(dir, { recursive: true, force: true })
      result.failed += 1
      result.messages.push(
        `検証不一致のため取り込み取り消し: ${nb.title}（${verifyNow.issues[0]?.message ?? '添付ハッシュ不一致'}）`
      )
      continue
    }

    result.restored += 1
    restoredIds.add(nb.id)
    if (!item.verifyAtExport?.ok) {
      result.messages.push(`元データで既に不一致だったノート: ${nb.title}（検証状態は保持）`)
    }
  }

  if (raw.library?.folders?.length) {
    const folders = raw.library.folders.map((f) => ({
      ...f,
      notebookIds: f.notebookIds.filter((id) => restoredIds.has(id) || existsSync(join(notebookDataRoot(), id, 'notebook.json')))
    }))
    result.foldersMerged = mergeLibraryFolders(folders)
  }

  return result
}
