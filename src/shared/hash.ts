import { createHash } from 'crypto'
import type { AttachmentMeta, NotebookEntry } from './types'

export const GENESIS_HASH = '0'.repeat(64)

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

type HashableEntry = Omit<NotebookEntry, 'hash' | 'signature'>

export function canonicalEntryPayload(entry: HashableEntry): string {
  const attachments = entry.attachments.map((a: AttachmentMeta) => ({
    id: a.id,
    originalName: a.originalName,
    storedName: a.storedName,
    mimeType: a.mimeType,
    size: a.size,
    sha256: a.sha256
  }))

  return JSON.stringify({
    id: entry.id,
    kind: entry.kind,
    createdAt: entry.createdAt,
    title: entry.title,
    body: entry.body,
    tags: entry.tags,
    attachments,
    correctsEntryId: entry.correctsEntryId ?? null,
    correctionReason: entry.correctionReason ?? null,
    prevHash: entry.prevHash
  })
}

export function computeEntryHash(entry: HashableEntry | Omit<NotebookEntry, 'hash'>): string {
  const { signature: _sig, ...rest } = entry as NotebookEntry & { signature?: unknown }
  void _sig
  return sha256Hex(canonicalEntryPayload(rest))
}

export function lastEntryHash(entries: NotebookEntry[]): string {
  if (entries.length === 0) return GENESIS_HASH
  return entries[entries.length - 1].hash
}
