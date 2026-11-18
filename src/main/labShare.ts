import {
  accessSync,
  appendFileSync,
  constants,
  existsSync,
  mkdirSync,
  writeFileSync
} from 'fs'
import { hostname } from 'os'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import {
  normalizeSharePath,
  type LabShareProbe,
  type LabTimestampRecord
} from '../shared/settings'
import type { Notebook, NotebookEntry } from '../shared/types'
import { getIdentityPublic } from './identity'
import { loadSettings } from './settingsStore'

export { normalizeSharePath }

/** 共有ルート識別（アプリがこの場所を LabNoteChain 共有とみなす） */
const SHARE_MARKER = '.integrity-lab-share.json'
/** 直近の接続テスト結果（保守用に人間可読な名前） */
const CONNECTIVITY = 'connectivity-check.json'
/** 共有レイアウト説明（デバッグ・運用向け） */
const README = 'README.txt'
/** ノート内の追記型タイムスタンプログ */
const INDEX = 'timestamps.jsonl'

const README_BODY = `LabNoteChain — lab share layout / 研究室共有フォルダの構成
============================================================

This folder is the shared timestamp root. Do not rename role files below
while the app is in use. / このフォルダはタイムスタンプ共有のルートです。
運用中は下記の役割ファイル名を変更しないでください。

Root / ルート
-------------
  README.txt
    This file. Explains folder and file roles for ops and debugging.
    本ファイル。フォルダ・ファイルの役割説明（運用・デバッグ用）。

  .integrity-lab-share.json
    Share-root marker. App reads this to confirm the folder is initialized.
    共有ルート識別子。アプリが初期化済み共有か確認するために読みます。

  connectivity-check.json
    Last successful connection probe (host, time). Overwritten on each test.
    直近の接続確認結果（ホスト名と時刻）。接続テストのたびに上書きされます。

Per-user / ユーザー単位
-----------------------
  {署名者名}/
    Folder named after the registered signer (sanitized).
    登録した署名者名（ファイル名に使える文字へ正規化）ごとのフォルダ。

Per-notebook / ノート単位（ノート名対応）
----------------------------------------
  {署名者名}/{ノート名}__{ノートID先頭8桁}/
    Folder name mirrors the notebook title for ops, with a short id suffix
    so renames / duplicates stay unique.
    フォルダ名はノート題名に対応。末尾に短い ID を付け、改名・同名衝突に備えます。

    notebook-meta.json
      Ops snapshot: title, author, sealed, entry count, last hash, path keys.
      運用確認用のノート要約（題名・パス名含む）。監査ログ本体ではありません。

    timestamps.jsonl
      Append-only audit log. One JSON line = one page timestamp.
      追記専用監査ログ。1行 = ページ1件のタイムスタンプ。

    {ページ名}__{ページID先頭8桁}.json
      Timestamp for one page. File name mirrors the page title.
      ページ1件分のタイムスタンプ。ファイル名はページ題名に対応。

Notes / 注意
------------
  - Local notebooks remain on each PC. This share only stores timestamps.
    ノート本文は各 PC 側。ここにはタイムスタンプのみ書き込みます。
  - JSON 内の notebookId / entryId が正式な対応キーです。フォルダ名は保守用の表示名です。
  - UNC example: \\\\LAB-PC\\\\LabShare\\\\LabNoteChain
  - Mapped drive example: Z:\\\\LabNoteChain
`

function sanitizeKey(raw: string): string {
  const s = raw
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80)
  return s || 'untitled'
}

/** 人間可読名 + 短い ID（一意性・改名耐性） */
function namedKey(label: string, id: string): string {
  const name = sanitizeKey(label || 'untitled')
  const short = id.replace(/-/g, '').slice(0, 8) || '00000000'
  return `${name}__${short}`
}

function userKeyFor(notebook: Notebook): string {
  const identity = getIdentityPublic()
  if (identity?.signerName) return sanitizeKey(identity.signerName)
  if (identity?.publicKey) return sanitizeKey(identity.publicKey.slice(0, 16))
  return sanitizeKey(notebook.authorName || 'user')
}

function ensureShareLayout(sharePath: string): void {
  if (!existsSync(sharePath)) {
    mkdirSync(sharePath, { recursive: true })
  }

  // 運用ドキュメントは常に最新版へ更新
  writeFileSync(join(sharePath, README), README_BODY, 'utf8')

  const markerPath = join(sharePath, SHARE_MARKER)
  if (!existsSync(markerPath)) {
    writeFileSync(
      markerPath,
      JSON.stringify(
        {
          format: 'integrity-lab-share/v2',
          app: 'LabNoteChain',
          createdAt: new Date().toISOString(),
          layout: {
            readme: README,
            connectivity: CONNECTIVITY,
            userFolder: '{signerName}',
            notebookFolder: '{signerName}/{notebookTitle}__{notebookId8}',
            pageFile: '{pageTitle}__{entryId8}.json',
            files: {
              'notebook-meta.json': 'Notebook ops snapshot',
              'timestamps.jsonl': 'Append-only timestamp audit log',
              '{pageTitle}__{entryId8}.json': 'Per-page timestamp record'
            }
          },
          note: 'Folder/file names mirror notebook and page titles. Stable ids remain inside JSON. See README.txt.'
        },
        null,
        2
      ),
      'utf8'
    )
  }
}

/**
 * writeCheck=false: 定期ポーリング用。共有へは一切書かず、到達性（読み書き権限）だけ見る。
 * writeCheck=true : 「接続を確認」ボタン用。共有ルートを初期化し connectivity-check.json を書く。
 */
export async function probeLabShare(
  timeoutMs = 5000,
  writeCheck = false
): Promise<LabShareProbe> {
  const settings = loadSettings()
  const checkedAt = new Date().toISOString()
  const sharePath = normalizeSharePath(settings.labServer.sharePath)

  if (!settings.labServer.enabled) {
    return {
      enabled: false,
      configured: Boolean(sharePath),
      reachable: false,
      checkedAt,
      sharePath,
      latencyMs: null,
      message: 'オフ'
    }
  }

  if (!sharePath) {
    return {
      enabled: true,
      configured: false,
      reachable: false,
      checkedAt,
      sharePath: '',
      latencyMs: null,
      message: '共有フォルダ未設定（UNC またはフォルダを指定）'
    }
  }

  const started = Date.now()
  try {
    await Promise.race([
      (async () => {
        accessSync(sharePath, constants.R_OK | constants.W_OK)
        if (!writeCheck) return
        ensureShareLayout(sharePath)
        writeFileSync(
          join(sharePath, CONNECTIVITY),
          JSON.stringify(
            {
              format: 'labnotechain-connectivity/v1',
              role: 'Last connection probe result for ops/debug',
              checkedAt,
              host: hostname(),
              sharePath,
              ok: true
            },
            null,
            2
          ),
          'utf8'
        )
      })(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      })
    ])
    return {
      enabled: true,
      configured: true,
      reachable: true,
      checkedAt,
      sharePath,
      latencyMs: Date.now() - started,
      message: `接続中 — ${sharePath}`
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isDriveLetterPath = /^[A-Za-z]:[\\/]/.test(sharePath)
    const hint =
      msg === 'timeout'
        ? '応答なし（タイムアウト）。共有PCの電源・ネットワーク・共有権限を確認してください。'
        : /ENOENT/.test(msg) && isDriveLetterPath
          ? `ドライブ ${sharePath.slice(0, 2)} が見つかりません。Google Drive for Desktop / OneDrive / MEGA などの同期アプリが起動しているか、同期フォルダが存在するか確認してください。Google Drive は Web 版だけでは直接書けません。`
          : `未到達: ${msg}。UNC 例: \\\\共有PC名\\共有名\\LabNoteChain`
    return {
      enabled: true,
      configured: true,
      reachable: false,
      checkedAt,
      sharePath,
      latencyMs: null,
      message: hint
    }
  }
}

export function anchorEntryToLabShare(
  notebook: Notebook,
  entry: NotebookEntry
): LabTimestampRecord {
  const settings = loadSettings()
  if (!settings.labServer.enabled) {
    throw new Error('研究室共有が無効です。')
  }
  const sharePath = normalizeSharePath(settings.labServer.sharePath)
  if (!sharePath) {
    throw new Error('共有フォルダが設定されていません。')
  }

  accessSync(sharePath, constants.R_OK | constants.W_OK)
  ensureShareLayout(sharePath)

  const identity = getIdentityPublic()
  const userKey = userKeyFor(notebook)
  const notebookFolder = namedKey(notebook.title, notebook.id)
  const pageFileStem = namedKey(entry.title || 'untitled', entry.id)
  const dir = join(sharePath, userKey, notebookFolder)
  mkdirSync(dir, { recursive: true })

  const record: LabTimestampRecord = {
    format: 'integrity-lab-share-timestamp/v1',
    id: uuidv4(),
    notebookId: notebook.id,
    notebookTitle: notebook.title,
    entryId: entry.id,
    entryHash: entry.hash,
    entryKind: entry.kind,
    authorName: notebook.authorName,
    userKey,
    signerName: identity?.signerName ?? entry.signature?.signerName ?? null,
    recordedAt: entry.createdAt,
    anchoredAt: new Date().toISOString(),
    machineName: hostname()
  }

  writeFileSync(join(dir, `${pageFileStem}.json`), JSON.stringify(record, null, 2), 'utf8')
  appendFileSync(join(dir, INDEX), `${JSON.stringify(record)}\n`, 'utf8')

  writeFileSync(
    join(dir, 'notebook-meta.json'),
    JSON.stringify(
      {
        role: 'Notebook ops snapshot (not the audit log). See README.txt at share root.',
        notebookId: notebook.id,
        title: notebook.title,
        notebookFolder,
        authorName: notebook.authorName,
        sealed: notebook.sealed,
        entryCount: notebook.entries.length,
        lastHash: entry.hash,
        lastPageFile: `${pageFileStem}.json`,
        lastPageTitle: entry.title || 'untitled',
        lastEntryId: entry.id,
        updatedAt: record.anchoredAt
      },
      null,
      2
    ),
    'utf8'
  )

  return record
}

/** 有効かつ autoAnchor のときだけ書く。失敗は例外を投げず null */
export function tryAutoAnchor(
  notebook: Notebook,
  entryId: string
): LabTimestampRecord | null {
  const settings = loadSettings()
  if (!settings.labServer.enabled || !settings.labServer.autoAnchor) return null
  if (!normalizeSharePath(settings.labServer.sharePath)) return null
  const entry = notebook.entries.find((e) => e.id === entryId)
  if (!entry) return null
  try {
    return anchorEntryToLabShare(notebook, entry)
  } catch {
    return null
  }
}
