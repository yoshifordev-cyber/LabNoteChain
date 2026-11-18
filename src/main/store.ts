import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'fs'
import { basename, extname, join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { computeEntryHash, lastEntryHash, sha256Hex } from '../shared/hash'
import { verifyNotebook } from '../shared/verify'
import type {
  AddEntryInput,
  AttachmentMeta,
  CreateNotebookInput,
  EvidencePackage,
  Notebook,
  NotebookEntry,
  NotebookSummary,
  EntrySignature,
  SearchHit,
  SearchHitField,
  VerifyResult
} from '../shared/types'
import { verifyEntrySignature } from './identity'
import { resolveDataDir } from './settingsStore'

function rootDir(): string {
  return resolveDataDir()
}

function notebookDir(id: string): string {
  return join(rootDir(), id)
}

function notebookJsonPath(id: string): string {
  return join(notebookDir(id), 'notebook.json')
}

function attachmentsDir(id: string): string {
  const dir = join(notebookDir(id), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function readNotebook(id: string): Notebook {
  const path = notebookJsonPath(id)
  if (!existsSync(path)) {
    throw new Error('ノートが見つかりません。')
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Notebook
}

function writeNotebook(notebook: Notebook): void {
  const dir = notebookDir(notebook.id)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(notebookJsonPath(notebook.id), JSON.stringify(notebook, null, 2), 'utf8')
}

function toSummary(notebook: Notebook): NotebookSummary {
  return {
    id: notebook.id,
    title: notebook.title,
    authorName: notebook.authorName,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
    sealed: notebook.sealed,
    entryCount: notebook.entries.length,
    lastHash: lastEntryHash(notebook.entries)
  }
}

function ingestAttachments(notebookId: string, paths: string[]): AttachmentMeta[] {
  const dir = attachmentsDir(notebookId)
  return paths.map((filePath) => {
    const buf = readFileSync(filePath)
    const id = uuidv4()
    const originalName = basename(filePath)
    const storedName = `${id}${extname(originalName)}`
    // ハッシュを取ったバイト列そのものを書き込む（読み取りとコピーの間に元ファイルが変わっても不整合にならない）
    writeFileSync(join(dir, storedName), buf)
    return {
      id,
      originalName,
      storedName,
      mimeType: guessMime(originalName),
      size: buf.length,
      sha256: sha256Hex(buf)
    }
  })
}

function guessMime(name: string): string {
  const ext = extname(name).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json'
  }
  return map[ext] ?? 'application/octet-stream'
}

export function listNotebooks(): NotebookSummary[] {
  const root = rootDir()
  const ids = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  return ids
    .map((id) => {
      try {
        return toSummary(readNotebook(id))
      } catch {
        return null
      }
    })
    .filter((x): x is NotebookSummary => x !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function createNotebook(input: CreateNotebookInput): Notebook {
  const now = new Date().toISOString()
  const notebook: Notebook = {
    id: uuidv4(),
    title: input.title.trim() || '無題のノート',
    authorName: input.authorName.trim() || '未設定',
    createdAt: now,
    updatedAt: now,
    sealed: false,
    entries: []
  }
  writeNotebook(notebook)
  attachmentsDir(notebook.id)
  return notebook
}

export function getNotebook(id: string): Notebook {
  return readNotebook(id)
}

/**
 * ノート名の変更。ノート名はハッシュ連鎖（各ページのハッシュ）に含まれないため、
 * 確定済みノートでも連鎖・署名の検証結果には影響しない。updatedAt も変えない（内容更新ではないため）。
 */
export function renameNotebook(id: string, title: string): Notebook {
  const next = title.trim()
  if (!next) throw new Error('ノート名を入力してください。')
  if (next.length > 200) throw new Error('ノート名は200文字以内にしてください。')
  const notebook = readNotebook(id)
  notebook.title = next
  writeNotebook(notebook)
  return notebook
}

export function addEntry(input: AddEntryInput): Notebook {
  const notebook = readNotebook(input.notebookId)
  if (notebook.sealed) {
    throw new Error('確定済みのノートには通常の追記はできません。訂正として残してください。')
  }

  if (input.correctsEntryId) {
    throw new Error('まだ確定していないノートでは、通常の追記を使ってください。')
  }

  const attachments = ingestAttachments(input.notebookId, input.attachmentPaths ?? [])
  const now = new Date().toISOString()
  const draft: Omit<NotebookEntry, 'hash'> = {
    id: uuidv4(),
    kind: 'note',
    createdAt: now,
    title: input.title.trim() || '無題の記録',
    body: input.body,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    attachments,
    prevHash: lastEntryHash(notebook.entries)
  }
  const entry: NotebookEntry = {
    ...draft,
    hash: computeEntryHash(draft)
  }

  notebook.entries.push(entry)
  notebook.updatedAt = now
  writeNotebook(notebook)
  return notebook
}

export function addCorrection(input: AddEntryInput): Notebook {
  const notebook = readNotebook(input.notebookId)
  if (!input.correctsEntryId) {
    throw new Error('どの記録を訂正するか選んでください。')
  }
  if (!input.correctionReason?.trim()) {
    throw new Error('訂正の理由を書いてください。')
  }
  const target = notebook.entries.find((e) => e.id === input.correctsEntryId)
  if (!target) {
    throw new Error('訂正したい記録が見つかりません。')
  }

  const attachments = ingestAttachments(input.notebookId, input.attachmentPaths ?? [])
  const now = new Date().toISOString()
  const draft: Omit<NotebookEntry, 'hash'> = {
    id: uuidv4(),
    kind: 'correction',
    createdAt: now,
    title: input.title.trim() || `訂正: ${target.title}`,
    body: input.body,
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    attachments,
    correctsEntryId: input.correctsEntryId,
    correctionReason: input.correctionReason.trim(),
    prevHash: lastEntryHash(notebook.entries)
  }
  const entry: NotebookEntry = {
    ...draft,
    hash: computeEntryHash(draft)
  }

  notebook.entries.push(entry)
  notebook.updatedAt = now
  if (notebook.sealed) {
    notebook.sealHash = entry.hash
    notebook.sealedAt = now
  }
  writeNotebook(notebook)
  return notebook
}

export function sealNotebook(id: string): Notebook {
  const notebook = readNotebook(id)
  if (notebook.sealed) {
    throw new Error('すでに確定済みです。')
  }
  if (notebook.entries.length === 0) {
    throw new Error('記録がないノートは確定できません。')
  }

  const now = new Date().toISOString()
  const draft: Omit<NotebookEntry, 'hash'> = {
    id: uuidv4(),
    kind: 'seal',
    createdAt: now,
    title: 'ノートの確定',
    body: `${notebook.authorName} がこのノートを確定しました。以降の内容変更は訂正としてのみ残せます。`,
    tags: ['確定'],
    attachments: [],
    prevHash: lastEntryHash(notebook.entries)
  }
  const entry: NotebookEntry = {
    ...draft,
    hash: computeEntryHash(draft)
  }

  notebook.entries.push(entry)
  notebook.sealed = true
  notebook.sealedAt = now
  notebook.sealHash = entry.hash
  notebook.updatedAt = now
  writeNotebook(notebook)
  return notebook
}

export function verify(id: string): VerifyResult {
  const notebook = readNotebook(id)
  const result = verifyNotebook(notebook, attachmentsDir(id))
  for (let i = 0; i < notebook.entries.length; i++) {
    const entry = notebook.entries[i]
    if (!entry.signature) continue
    if (!verifyEntrySignature(entry.hash, entry.signature)) {
      result.issues.push({
        entryId: entry.id,
        index: i,
        code: 'SIGNATURE_INVALID',
        message: `ページ #${i + 1}「${entry.title}」の電子署名が不正です。`
      })
    }
  }
  result.ok = result.issues.length === 0
  return result
}

export function attachSignature(
  notebookId: string,
  entryId: string,
  signature: EntrySignature
): Notebook {
  const notebook = readNotebook(notebookId)
  const entry = notebook.entries.find((e) => e.id === entryId)
  if (!entry) throw new Error('ページが見つかりません。')
  if (!verifyEntrySignature(entry.hash, signature)) {
    throw new Error('署名の検証に失敗しました。')
  }
  entry.signature = signature
  notebook.updatedAt = new Date().toISOString()
  writeNotebook(notebook)
  return notebook
}

export function exportEvidence(id: string, destPath: string): EvidencePackage {
  const notebook = readNotebook(id)
  const verify = verifyNotebook(notebook, attachmentsDir(id))
  const pkg: EvidencePackage = {
    format: 'integrity-lab-notebook-evidence/v1',
    exportedAt: new Date().toISOString(),
    notebook,
    verify
  }
  writeFileSync(destPath, JSON.stringify(pkg, null, 2), 'utf8')
  return pkg
}

export function getAttachmentPath(notebookId: string, storedName: string): string {
  const path = join(attachmentsDir(notebookId), storedName)
  if (!existsSync(path)) {
    throw new Error('添付ファイルが見つかりません。')
  }
  // path traversal guard
  if (basename(storedName) !== storedName || storedName.includes('..')) {
    throw new Error('不正なファイル名です。')
  }
  return path
}

export function notebookDataRoot(): string {
  return rootDir()
}

function normalizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s\u3000]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function matchesAll(haystack: string, tokens: string[]): boolean {
  const h = haystack.toLowerCase()
  return tokens.every((t) => h.includes(t))
}

function makeSnippet(text: string, tokens: string[], maxLen = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const lower = flat.toLowerCase()
  let idx = -1
  for (const t of tokens) {
    const i = lower.indexOf(t)
    if (i >= 0 && (idx < 0 || i < idx)) idx = i
  }
  if (idx < 0) {
    return flat.length > maxLen ? `${flat.slice(0, maxLen)}…` : flat
  }
  const start = Math.max(0, idx - 24)
  const end = Math.min(flat.length, start + maxLen)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < flat.length ? '…' : ''
  return `${prefix}${flat.slice(start, end)}${suffix}`
}

function pushHit(
  hits: SearchHit[],
  partial: Omit<SearchHit, 'snippet'> & { text: string },
  tokens: string[]
): void {
  if (!matchesAll(partial.text, tokens)) return
  hits.push({
    notebookId: partial.notebookId,
    notebookTitle: partial.notebookTitle,
    entryId: partial.entryId,
    entryTitle: partial.entryTitle,
    field: partial.field,
    createdAt: partial.createdAt,
    snippet: makeSnippet(partial.text, tokens)
  })
}

function isTextAttachment(name: string): boolean {
  return /\.(txt|md|csv|json|log|tsv)$/i.test(name)
}

/** ライブラリ全体の全文検索（ノート名・著者・ページ・タグ・添付名・テキスト添付本文） */
export function searchAll(query: string, limit = 100): SearchHit[] {
  const tokens = normalizeQuery(query)
  if (tokens.length === 0) return []

  const hits: SearchHit[] = []
  const root = rootDir()
  const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())

  for (const dir of dirs) {
    if (hits.length >= limit) break
    let notebook: Notebook
    try {
      notebook = readNotebook(dir.name)
    } catch {
      continue
    }

    pushHit(
      hits,
      {
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        entryId: null,
        entryTitle: null,
        field: 'notebook_title',
        createdAt: notebook.updatedAt,
        text: notebook.title
      },
      tokens
    )
    pushHit(
      hits,
      {
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        entryId: null,
        entryTitle: null,
        field: 'notebook_author',
        createdAt: notebook.updatedAt,
        text: notebook.authorName
      },
      tokens
    )

    for (const entry of notebook.entries) {
      if (hits.length >= limit) break
      const base = {
        notebookId: notebook.id,
        notebookTitle: notebook.title,
        entryId: entry.id,
        entryTitle: entry.title || null,
        createdAt: entry.createdAt
      }

      pushHit(hits, { ...base, field: 'page_title' as SearchHitField, text: entry.title }, tokens)
      pushHit(hits, { ...base, field: 'page_body' as SearchHitField, text: entry.body }, tokens)
      pushHit(
        hits,
        { ...base, field: 'page_tag' as SearchHitField, text: entry.tags.join(' ') },
        tokens
      )
      if (entry.correctionReason) {
        pushHit(
          hits,
          {
            ...base,
            field: 'correction_reason' as SearchHitField,
            text: entry.correctionReason
          },
          tokens
        )
      }

      for (const att of entry.attachments) {
        if (hits.length >= limit) break
        pushHit(
          hits,
          {
            ...base,
            field: 'attachment_name' as SearchHitField,
            text: att.originalName
          },
          tokens
        )
        if (isTextAttachment(att.originalName) || isTextAttachment(att.storedName)) {
          try {
            const path = join(attachmentsDir(notebook.id), att.storedName)
            if (!existsSync(path)) continue
            const buf = readFileSync(path)
            if (buf.length > 512_000) continue
            pushHit(
              hits,
              {
                ...base,
                field: 'attachment_text' as SearchHitField,
                text: buf.toString('utf8')
              },
              tokens
            )
          } catch {
            /* binary or unreadable */
          }
        }
      }
    }
  }

  return hits.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, limit)
}

/** data URL (image/png 等) を一時ファイルにして、追記時の attachmentPaths に渡せるようにする */
export function saveDataUrlToTemp(dataUrl: string, fileName: string): string {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!match) {
    throw new Error('手書きデータの形式が不正です。')
  }
  const mime = match[1]
  const buf = Buffer.from(match[2], 'base64')
  const ext =
    mime === 'image/jpeg' ? '.jpg' : mime === 'image/webp' ? '.webp' : '.png'
  const safeBase = fileName.replace(/[^\w\-一-龥ぁ-んァ-ン]/g, '_') || 'sketch'
  const dir = join(app.getPath('temp'), 'integrity-lab-notebook')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const out = join(dir, `${safeBase}-${uuidv4()}${ext}`)
  writeFileSync(out, buf)
  return out
}

export function readAttachmentDataUrl(notebookId: string, storedName: string): string {
  const path = getAttachmentPath(notebookId, storedName)
  const buf = readFileSync(path)
  const ext = extname(storedName).toLowerCase()
  const mime =
    ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : ext === '.gif'
        ? 'image/gif'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.png'
            ? 'image/png'
            : 'application/octet-stream'
  return `data:${mime};base64,${buf.toString('base64')}`
}
