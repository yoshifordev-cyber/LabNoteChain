export type EntryKind = 'note' | 'correction' | 'seal'

export interface AttachmentMeta {
  id: string
  originalName: string
  storedName: string
  mimeType: string
  size: number
  sha256: string
}

/** ページハッシュに対する Ed25519 署名（ハッシュ計算対象外） */
export interface EntrySignature {
  alg: 'Ed25519'
  /** raw public key (32 bytes) hex */
  publicKey: string
  /** signature over entry.hash (64 bytes) hex */
  signature: string
  signerName: string
  signedAt: string
  /** 署名時の端末本人確認（Windows Hello / Touch ID） */
  userVerification: 'windows-hello' | 'touch-id'
  /** @deprecated 旧 WebAuthn 実装の名残。検証では無視 */
  credentialId?: string
}

export interface NotebookEntry {
  id: string
  kind: EntryKind
  createdAt: string
  title: string
  body: string
  tags: string[]
  attachments: AttachmentMeta[]
  /** 訂正対象のエントリID（kind === 'correction'） */
  correctsEntryId?: string
  correctionReason?: string
  prevHash: string
  hash: string
  signature?: EntrySignature
}

export interface SignerIdentityPublic {
  signerName: string
  publicKey: string
  createdAt: string
}

export interface Notebook {
  id: string
  title: string
  authorName: string
  createdAt: string
  updatedAt: string
  sealed: boolean
  sealedAt?: string
  sealHash?: string
  entries: NotebookEntry[]
}

export interface NotebookSummary {
  id: string
  title: string
  authorName: string
  createdAt: string
  updatedAt: string
  sealed: boolean
  entryCount: number
  lastHash: string
}

/** Library 上の分類用フォルダ（ノート本体・ハッシュ連鎖の外） */
export interface LibraryFolder {
  id: string
  name: string
  createdAt: string
  /** このフォルダに属するノート ID（順序は表示順） */
  notebookIds: string[]
}

export interface LibraryIndex {
  version: 1
  folders: LibraryFolder[]
}

export interface VerifyIssue {
  entryId?: string
  index?: number
  code:
    | 'EMPTY'
    | 'HASH_MISMATCH'
    | 'CHAIN_BREAK'
    | 'ATTACHMENT_MISSING'
    | 'ATTACHMENT_HASH_MISMATCH'
    | 'SEAL_MISMATCH'
    | 'SIGNATURE_INVALID'
    | 'SIGNATURE_MISSING_KEY'
  message: string
}

export interface VerifyResult {
  ok: boolean
  checkedAt: string
  notebookId: string
  entryCount: number
  issues: VerifyIssue[]
}

export interface EvidencePackage {
  format: 'integrity-lab-notebook-evidence/v1'
  exportedAt: string
  notebook: Notebook
  verify: VerifyResult
}

export interface CreateNotebookInput {
  title: string
  authorName: string
}

export interface AddEntryInput {
  notebookId: string
  title: string
  body: string
  tags: string[]
  attachmentPaths?: string[]
  correctsEntryId?: string
  correctionReason?: string
}

export type SearchHitField =
  | 'notebook_title'
  | 'notebook_author'
  | 'page_title'
  | 'page_body'
  | 'page_tag'
  | 'correction_reason'
  | 'attachment_name'
  | 'attachment_text'

export interface SearchHit {
  notebookId: string
  notebookTitle: string
  entryId: string | null
  entryTitle: string | null
  field: SearchHitField
  snippet: string
  createdAt: string | null
}

export interface ApiResult<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
}

export type ApiResponse<T> = ApiResult<T> | ApiError
