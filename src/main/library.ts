import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { LibraryFolder, LibraryIndex } from '../shared/types'
import { resolveDataDir } from './settingsStore'

function libraryPath(): string {
  return join(resolveDataDir(), 'library.json')
}

function emptyIndex(): LibraryIndex {
  return { version: 1, folders: [] }
}

function loadIndex(): LibraryIndex {
  const path = libraryPath()
  if (!existsSync(path)) return emptyIndex()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<LibraryIndex>
    const folders = Array.isArray(raw.folders) ? raw.folders : []
    return {
      version: 1,
      folders: folders
        .filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string')
        .map((f) => ({
          id: f.id,
          name: String(f.name).trim() || 'Untitled folder',
          createdAt: f.createdAt || new Date().toISOString(),
          notebookIds: Array.isArray(f.notebookIds)
            ? f.notebookIds.filter((id) => typeof id === 'string')
            : []
        }))
    }
  } catch {
    return emptyIndex()
  }
}

function saveIndex(index: LibraryIndex): LibraryIndex {
  const next: LibraryIndex = {
    version: 1,
    folders: index.folders.map((f) => ({
      ...f,
      name: f.name.trim() || 'Untitled folder',
      notebookIds: Array.from(new Set(f.notebookIds))
    }))
  }
  writeFileSync(libraryPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

/** バックアップ復元用：同じ ID のフォルダは残し、無いものだけ追加する。追加件数を返す */
export function mergeLibraryFolders(incoming: LibraryFolder[]): number {
  const current = loadIndex()
  const ids = new Set(current.folders.map((f) => f.id))
  let added = 0
  for (const f of incoming) {
    if (ids.has(f.id)) continue
    current.folders.push(f)
    ids.add(f.id)
    added += 1
  }
  if (added > 0) saveIndex(current)
  return added
}

export function listFolders(): LibraryFolder[] {
  return loadIndex().folders
}

export function createFolder(name: string): LibraryFolder {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a folder name.')
  const index = loadIndex()
  if (index.folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('A folder with that name already exists.')
  }
  const folder: LibraryFolder = {
    id: uuidv4(),
    name: trimmed,
    createdAt: new Date().toISOString(),
    notebookIds: []
  }
  index.folders.push(folder)
  saveIndex(index)
  return folder
}

export function renameFolder(folderId: string, name: string): LibraryFolder {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a folder name.')
  const index = loadIndex()
  const folder = index.folders.find((f) => f.id === folderId)
  if (!folder) throw new Error('Folder not found.')
  if (
    index.folders.some(
      (f) => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    throw new Error('A folder with that name already exists.')
  }
  folder.name = trimmed
  saveIndex(index)
  return folder
}

/** フォルダ削除。ノート自体は残し、未分類に戻る */
export function deleteFolder(folderId: string): LibraryIndex {
  const index = loadIndex()
  const next = index.folders.filter((f) => f.id !== folderId)
  if (next.length === index.folders.length) throw new Error('Folder not found.')
  return saveIndex({ version: 1, folders: next })
}

/** ノートをフォルダへ移動。folderId が null なら未分類へ */
export function moveNotebookToFolder(
  notebookId: string,
  folderId: string | null
): LibraryIndex {
  const index = loadIndex()
  for (const f of index.folders) {
    f.notebookIds = f.notebookIds.filter((id) => id !== notebookId)
  }
  if (folderId) {
    const folder = index.folders.find((f) => f.id === folderId)
    if (!folder) throw new Error('Folder not found.')
    folder.notebookIds.push(notebookId)
  }
  return saveIndex(index)
}

export function getFolderIdForNotebook(notebookId: string): string | null {
  const index = loadIndex()
  for (const f of index.folders) {
    if (f.notebookIds.includes(notebookId)) return f.id
  }
  return null
}
