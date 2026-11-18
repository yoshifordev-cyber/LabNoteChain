import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { computeEntryHash, GENESIS_HASH, sha256Hex } from './hash'
import type { Notebook, VerifyIssue, VerifyResult } from './types'

export function verifyNotebook(notebook: Notebook, attachmentsDir: string): VerifyResult {
  const issues: VerifyIssue[] = []
  const entries = notebook.entries

  if (entries.length === 0 && notebook.sealed) {
    issues.push({
      code: 'EMPTY',
      message: '封印済みですがエントリがありません。'
    })
  }

  let expectedPrev = GENESIS_HASH

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]

    if (entry.prevHash !== expectedPrev) {
      issues.push({
        entryId: entry.id,
        index: i,
        code: 'CHAIN_BREAK',
        message: `エントリ #${i + 1} の prevHash が連鎖と一致しません。`
      })
    }

    const { hash: _ignored, signature: _sig, ...withoutHash } = entry
    void _sig
    const expectedHash = computeEntryHash(withoutHash)
    if (entry.hash !== expectedHash) {
      issues.push({
        entryId: entry.id,
        index: i,
        code: 'HASH_MISMATCH',
        message: `エントリ #${i + 1}「${entry.title}」の内容ハッシュが一致しません。`
      })
    }

    for (const att of entry.attachments) {
      const filePath = join(attachmentsDir, att.storedName)
      if (!existsSync(filePath)) {
        issues.push({
          entryId: entry.id,
          index: i,
          code: 'ATTACHMENT_MISSING',
          message: `添付「${att.originalName}」が見つかりません。`
        })
        continue
      }
      const buf = readFileSync(filePath)
      const digest = sha256Hex(buf)
      if (digest !== att.sha256) {
        issues.push({
          entryId: entry.id,
          index: i,
          code: 'ATTACHMENT_HASH_MISMATCH',
          message: `添付「${att.originalName}」のファイル内容が改変されています。`
        })
      }
    }

    expectedPrev = entry.hash
  }

  if (notebook.sealed) {
    if (!notebook.sealHash) {
      issues.push({
        code: 'SEAL_MISMATCH',
        message: '封印フラグがありますが sealHash がありません。'
      })
    } else if (notebook.sealHash !== expectedPrev) {
      issues.push({
        code: 'SEAL_MISMATCH',
        message: '封印ハッシュが最新エントリと一致しません。'
      })
    }
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    notebookId: notebook.id,
    entryCount: entries.length,
    issues
  }
}
