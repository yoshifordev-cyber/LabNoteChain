import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  Notebook,
  NotebookEntry,
  LibraryFolder,
  NotebookSummary,
  SearchHit,
  SearchHitField,
  SignerIdentityPublic,
  VerifyResult
} from '../../shared/types'
import type {
  AppLanguage,
  AppSettingsPublic,
  LabShareProbe,
  SettingsPatch,
  SyncFolderCandidate
} from '../../shared/settings'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import SketchPad, { type SketchPadHandle } from './SketchPad'
import MarkdownBody from './MarkdownBody'
import { MD_TEMPLATES } from './markdownTemplates'
import SettingsModal from './SettingsModal'
import { applyAppearance, watchSystemTheme } from './applyAppearance'
import { t } from './i18n'
import {
  IconBack,
  IconCancel,
  IconChevron,
  IconCorrection,
  IconEvidence,
  IconFolder,
  IconNotebook,
  IconPlusPage,
  IconLockClosed,
  IconLockOpen,
  IconSeal,
  IconSearch,
  IconSettings,
  IconSigner,
  IconVerify,
  IconView
} from './icons'
import PaneResizer from './PaneResizer'
import { usePaneWidths } from './usePaneWidths'

function fieldLabel(lang: AppLanguage, field: SearchHitField): string {
  switch (field) {
    case 'notebook_title':
      return t(lang, 'fieldNotebookTitle')
    case 'notebook_author':
      return t(lang, 'fieldAuthor')
    case 'page_title':
      return t(lang, 'fieldPageTitle')
    case 'page_body':
      return t(lang, 'fieldPageBody')
    case 'page_tag':
      return t(lang, 'fieldPageTag')
    case 'correction_reason':
      return t(lang, 'fieldCorrectionReason')
    case 'attachment_name':
      return t(lang, 'fieldAttachmentName')
    case 'attachment_text':
      return t(lang, 'fieldAttachmentText')
    default:
      return field
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return iso
  }
}

function todayTitle(): string {
  const d = new Date()
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function shortHash(hash: string): string {
  return hash.slice(0, 8)
}

function kindLabel(lang: AppLanguage, kind: NotebookEntry['kind']): string {
  if (kind === 'seal') return t(lang, 'kindSeal')
  if (kind === 'correction') return t(lang, 'kindCorrection')
  return t(lang, 'kindPage')
}

function isImageName(name: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(name)
}

function isUserCancel(message: string): boolean {
  return (
    message === 'キャンセルされました。' ||
    message === 'Cancelled.' ||
    /cancel/i.test(message)
  )
}

export default function App() {
  const [summaries, setSummaries] = useState<NotebookSummary[]>([])
  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [dropTarget, setDropTarget] = useState<string | 'unfiled' | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [folderModal, setFolderModal] = useState<null | {
    mode: 'create' | 'rename' | 'renameNotebook'
    folderId?: string
    notebookId?: string
    name: string
  }>(null)
  const [notebook, setNotebook] = useState<Notebook | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [composeMode, setComposeMode] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [createAuthor, setCreateAuthor] = useState('')
  const [identity, setIdentity] = useState<SignerIdentityPublic | null>(null)
  const [showEnroll, setShowEnroll] = useState(false)
  const [enrollName, setEnrollName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<AppSettingsPublic>({
    ...DEFAULT_SETTINGS,
    resolvedDataDir: '',
    defaultDataDir: ''
  })
  const [labProbe, setLabProbe] = useState<LabShareProbe | null>(null)
  const [syncCandidates, setSyncCandidates] = useState<SyncFolderCandidate[]>([])
  const [backupMessages, setBackupMessages] = useState<string[] | null>(null)
  const [infoOpen, setInfoOpen] = useState(true)
  const { leftWidth, rightWidth, resizeLeft, resizeRight, resetLeft, resetRight } =
    usePaneWidths()
  const showRightPane = !composeMode && !viewMode
  const [bodyOpen, setBodyOpen] = useState(true)
  const [composeMdTab, setComposeMdTab] = useState<'write' | 'preview'>('write')
  const [attachOpen, setAttachOpen] = useState(true)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [sketchDirty, setSketchDirty] = useState(false)
  const [flipAnim, setFlipAnim] = useState<'next' | 'prev' | null>(null)

  const [entryTitle, setEntryTitle] = useState('')
  const [entryBody, setEntryBody] = useState('')
  const [entryTags, setEntryTags] = useState('')
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([])
  const [correctTargetId, setCorrectTargetId] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')

  const sketchRef = useRef<SketchPadHandle | null>(null)
  const mdEditorRef = useRef<HTMLTextAreaElement | null>(null)
  const swipeRef = useRef<{ x: number; y: number; active: boolean } | null>(null)
  const flipTimerRef = useRef<number | null>(null)

  const refreshList = useCallback(async () => {
    const [nbRes, folderRes] = await Promise.all([
      window.api.listNotebooks(),
      window.api.listFolders()
    ])
    if (!nbRes.ok) {
      setError(nbRes.error)
      return
    }
    setSummaries(nbRes.data)
    if (folderRes.ok) {
      setFolders(folderRes.data)
      setExpandedFolders((prev) => {
        const next = { ...prev }
        for (const f of folderRes.data) {
          if (next[f.id] === undefined) next[f.id] = true
        }
        return next
      })
    }
  }, [])

  const loadNotebook = useCallback(async (id: string) => {
    setBusy(true)
    setError(null)
    setVerifyResult(null)
    setComposeMode(false)
    setViewMode(false)
    setPreviewUrls({})
    try {
      const res = await window.api.getNotebook(id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setNotebook(res.data)
      const last = [...res.data.entries].reverse().find((e) => e.kind !== 'seal')
      setSelectedEntryId(last?.id ?? res.data.entries.at(-1)?.id ?? null)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }, [])

  const refreshIdentity = useCallback(async () => {
    const res = await window.api.getIdentity()
    if (!res.ok) {
      setError(res.error)
      return
    }
    setIdentity(res.data)
  }, [])

  const refreshSettings = useCallback(async () => {
    const res = await window.api.getSettings()
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSettings(res.data)
  }, [])

  const refreshLabProbe = useCallback(async (opts?: { write?: boolean }) => {
    const res = await window.api.probeLabShare(opts)
    if (!res.ok) return
    setLabProbe(res.data)
  }, [])

  const refreshSyncCandidates = useCallback(async () => {
    const res = await window.api.detectSyncFolders()
    if (res.ok) setSyncCandidates(res.data)
  }, [])

  useEffect(() => {
    if (showSettings) void refreshSyncCandidates()
  }, [showSettings, refreshSyncCandidates])

  useEffect(() => {
    void refreshList()
    void refreshIdentity()
    void refreshSettings()
  }, [refreshList, refreshIdentity, refreshSettings])

  useEffect(() => {
    if (!settings.resolvedDataDir && !settings.defaultDataDir) return
    applyAppearance(settings)
    return watchSystemTheme(settings.theme, () => applyAppearance(settings))
  }, [settings])

  useEffect(() => {
    void refreshLabProbe()
    if (!settings.labServer.enabled) return
    const timer = window.setInterval(() => void refreshLabProbe(), 8000)
    return () => window.clearInterval(timer)
  }, [settings.labServer.enabled, settings.labServer.sharePath, refreshLabProbe])

  const lang = settings.language || 'en'

  const labIndicator = useMemo(() => {
    if (!labProbe || !labProbe.enabled) {
      return { className: 'lab-ind off', text: t(lang, 'labOff') }
    }
    if (!labProbe.configured) {
      return { className: 'lab-ind warn', text: t(lang, 'labUnset') }
    }
    if (labProbe.reachable) {
      const ms = labProbe.latencyMs != null ? ` ${labProbe.latencyMs}ms` : ''
      return { className: 'lab-ind ok', text: `${t(lang, 'labConnected')}${ms}` }
    }
    return { className: 'lab-ind bad', text: t(lang, 'labDisconnected') }
  }, [labProbe, lang])

  const filedNotebookIds = useMemo(() => {
    const ids = new Set<string>()
    for (const f of folders) {
      for (const id of f.notebookIds) ids.add(id)
    }
    return ids
  }, [folders])

  const unfiledSummaries = useMemo(
    () => summaries.filter((n) => !filedNotebookIds.has(n.id)),
    [summaries, filedNotebookIds]
  )

  const summaryById = useMemo(() => {
    const map = new Map<string, NotebookSummary>()
    for (const n of summaries) map.set(n.id, n)
    return map
  }, [summaries])

  function openCreateFolderModal() {
    setFolderModal({ mode: 'create', name: '' })
  }

  function openRenameFolderModal(folder: LibraryFolder) {
    setFolderModal({ mode: 'rename', folderId: folder.id, name: folder.name })
  }

  function openRenameNotebookModal(n: NotebookSummary) {
    setFolderModal({ mode: 'renameNotebook', notebookId: n.id, name: n.title })
  }

  async function handleSubmitFolderModal() {
    if (!folderModal) return
    const name = folderModal.name.trim()
    if (!name) {
      setError(
        t(lang, folderModal.mode === 'renameNotebook' ? 'notebookNamePrompt' : 'folderNamePrompt')
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (folderModal.mode === 'renameNotebook' && folderModal.notebookId) {
        const id = folderModal.notebookId
        const res = await window.api.renameNotebook(id, name)
        if (!res.ok) {
          setError(res.error)
          return
        }
        setFolderModal(null)
        // 開いているノートは本文・選択状態を保ったまま、名前だけ差し替える
        setNotebook((prev) => (prev && prev.id === id ? { ...prev, title: res.data.title } : prev))
        await refreshList()
      } else if (folderModal.mode === 'create') {
        const res = await window.api.createFolder(name)
        if (!res.ok) {
          setError(res.error)
          return
        }
        setFolderModal(null)
        await refreshList()
        setExpandedFolders((prev) => ({ ...prev, [res.data.id]: true }))
        setSelectedFolderId(res.data.id)
      } else if (folderModal.folderId) {
        const res = await window.api.renameFolder(folderModal.folderId, name)
        if (!res.ok) {
          setError(res.error)
          return
        }
        setFolderModal(null)
        await refreshList()
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    document.title = 'LabNoteChain'
  }, [])

  async function handleDeleteFolder(folder: LibraryFolder) {
    if (!window.confirm(t(lang, 'deleteFolderConfirm'))) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.deleteFolder(folder.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      await refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function handleMoveNotebook(notebookId: string, folderId: string | null) {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.moveNotebookToFolder({ notebookId, folderId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      await refreshList()
    } finally {
      setBusy(false)
      setDropTarget(null)
    }
  }

  function renderNotebookTreeItem(n: NotebookSummary, depth: number) {
    return (
      <div
        key={n.id}
        className={`tree-notebook-row${notebook?.id === n.id ? ' selected' : ''}`}
      >
      <button
        type="button"
        className={`tree-item${notebook?.id === n.id ? ' selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 14 }}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/notebook-id', n.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        onClick={() => void loadNotebook(n.id)}
        onDoubleClick={() => openRenameNotebookModal(n)}
      >
        <span
          className="lock-wrap"
          role="img"
          title={n.sealed ? t(lang, 'sealed') : t(lang, 'notebookOpen')}
          aria-label={n.sealed ? t(lang, 'sealed') : t(lang, 'notebookOpen')}
        >
          {n.sealed ? (
            <IconLockClosed size={14} className="lock-ic sealed" />
          ) : (
            <IconLockOpen size={14} className="lock-ic open" />
          )}
        </span>
        <span className="label">{n.title || t(lang, 'untitled')}</span>
        <span className="meta">{n.entryCount}</span>
      </button>
      {notebook?.id === n.id && (
        <button
          type="button"
          className="tree-row-menu"
          title={t(lang, 'renameNotebook')}
          aria-label={t(lang, 'renameNotebook')}
          onClick={() => openRenameNotebookModal(n)}
          disabled={busy}
        >
          ✎
        </button>
      )}
      </div>
    )
  }

  async function handleUpdateSettings(patch: SettingsPatch) {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.updateSettings(patch)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSettings(res.data)
      if (patch.dataDir !== undefined) {
        setNotebook(null)
        setSelectedEntryId(null)
        await refreshList()
      }
    } finally {
      setBusy(false)
    }
  }

  async function handlePickDataDir() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.pickDataDir()
      if (!res.ok) {
        if (!isUserCancel(res.error)) setError(res.error)
        return
      }
      setSettings(res.data)
      setNotebook(null)
      setSelectedEntryId(null)
      await refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function handleResetDataDir() {
    await handleUpdateSettings({ dataDir: null })
  }

  async function handlePickLabShare() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.pickLabShareDir()
      if (!res.ok) {
        if (!isUserCancel(res.error)) setError(res.error)
        return
      }
      setSettings(res.data)
      await refreshLabProbe()
    } finally {
      setBusy(false)
    }
  }

  async function handleSetLabSharePath(path: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.setLabSharePath(path)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSettings(res.data)
      await refreshLabProbe()
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenLabNetwork() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.openLabNetwork()
      if (!res.ok) setError(res.error)
    } finally {
      setBusy(false)
    }
  }

  async function handleExportBackup() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.exportBackup()
      if (!res.ok) {
        if (!isUserCancel(res.error)) setError(res.error)
        return
      }
      const msgs = [
        t(lang, 'backupDone')
          .replace('{n}', String(res.data.notebookCount))
          .replace('{a}', String(res.data.attachmentCount)),
        res.data.path
      ]
      if (res.data.unverifiedNotebooks > 0) {
        msgs.push(t(lang, 'backupUnverifiedWarn').replace('{n}', String(res.data.unverifiedNotebooks)))
      }
      setBackupMessages(msgs)
    } finally {
      setBusy(false)
    }
  }

  async function handleImportBackup() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.importBackup()
      if (!res.ok) {
        if (!isUserCancel(res.error)) setError(res.error)
        return
      }
      const d = res.data
      setBackupMessages([
        t(lang, 'backupImportDone')
          .replace('{r}', String(d.restored))
          .replace('{s}', String(d.skipped))
          .replace('{f}', String(d.failed))
          .replace('{m}', String(d.foldersMerged)),
        ...d.messages
      ])
      await refreshList()
    } finally {
      setBusy(false)
    }
  }

  async function handleProbeLab() {
    setBusy(true)
    try {
      await refreshLabProbe({ write: true })
    } finally {
      setBusy(false)
    }
  }

  const isCorrectionMode = Boolean(notebook?.sealed)

  const pages = useMemo(() => {
    if (!notebook) return []
    return [...notebook.entries].reverse()
  }, [notebook])

  const searchActive = query.trim().length > 0 && !composeMode && !viewMode

  useEffect(() => {
    if (composeMode || viewMode) return
    const q = query.trim()
    if (!q) {
      setSearchHits([])
      setSearching(false)
      return
    }
    let cancelled = false
    setSearching(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await window.api.search(q)
        if (cancelled) return
        setSearching(false)
        if (!res.ok) {
          setError(res.error)
          setSearchHits([])
          return
        }
        setSearchHits(res.data)
      })()
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, composeMode, viewMode])

  async function openSearchHit(hit: SearchHit) {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.getNotebook(hit.notebookId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setNotebook(res.data)
      setComposeMode(false)
      if (hit.entryId) {
        setSelectedEntryId(hit.entryId)
        setViewMode(true)
      } else {
        setSelectedEntryId(res.data.entries.at(-1)?.id ?? null)
        setViewMode(false)
      }
      setQuery('')
      setSearchHits([])
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const selectedEntry = useMemo(() => {
    if (!notebook || !selectedEntryId) return null
    return notebook.entries.find((e) => e.id === selectedEntryId) ?? null
  }, [notebook, selectedEntryId])

  /** 閲覧めくり順：古いページ → 新しいページ */
  const viewPageIndex = useMemo(() => {
    if (!notebook || !selectedEntryId) return -1
    return notebook.entries.findIndex((e) => e.id === selectedEntryId)
  }, [notebook, selectedEntryId])

  const canFlipPrev = viewMode && viewPageIndex > 0
  const canFlipNext =
    viewMode && notebook != null && viewPageIndex >= 0 && viewPageIndex < notebook.entries.length - 1

  const goViewPage = useCallback(
    (dir: 'prev' | 'next') => {
      if (!notebook) return
      const i = notebook.entries.findIndex((e) => e.id === selectedEntryId)
      if (i < 0) return
      const next = dir === 'prev' ? i - 1 : i + 1
      if (next < 0 || next >= notebook.entries.length) return
      if (flipTimerRef.current != null) window.clearTimeout(flipTimerRef.current)
      setFlipAnim(dir)
      setSelectedEntryId(notebook.entries[next].id)
      flipTimerRef.current = window.setTimeout(() => {
        setFlipAnim(null)
        flipTimerRef.current = null
      }, 220)
    },
    [notebook, selectedEntryId]
  )

  useEffect(() => {
    if (!notebook || !selectedEntry || composeMode) return
    let cancelled = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const att of selectedEntry.attachments) {
        if (!isImageName(att.originalName) && !/\.png$/i.test(att.storedName)) continue
        const res = await window.api.readAttachmentDataUrl(notebook.id, att.storedName)
        if (res.ok) next[att.id] = res.data
      }
      if (!cancelled) setPreviewUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [notebook, selectedEntry, composeMode, viewMode])

  useEffect(() => {
    if (!viewMode) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goViewPage('prev')
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        goViewPage('next')
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setViewMode(false)
        setStatus('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewMode, goViewPage])

  function openPageView(entryId?: string) {
    const id = entryId ?? selectedEntryId
    if (!notebook || !id) return
    const exists = notebook.entries.some((e) => e.id === id)
    if (!exists) return
    setSelectedEntryId(id)
    setComposeMode(false)
    setViewMode(true)
    setFlipAnim(null)
    setStatus('')
  }

  function closePageView() {
    setViewMode(false)
    setFlipAnim(null)
    setStatus('')
  }

  function onReaderPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    swipeRef.current = { x: e.clientX, y: e.clientY, active: true }
  }

  function onReaderPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const start = swipeRef.current
    swipeRef.current = null
    if (!start?.active) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    // 指／ドラッグを左へ → 次ページ、右へ → 前ページ
    if (dx < 0) goViewPage('next')
    else goViewPage('prev')
  }

  function onReaderPointerCancel() {
    swipeRef.current = null
  }

  const canSubmit = useMemo(() => {
    if (!notebook) return false
    const hasContent = Boolean(entryBody.trim()) || sketchDirty || attachmentPaths.length > 0
    if (!hasContent) return false
    if (isCorrectionMode) return Boolean(correctTargetId && correctionReason.trim())
    return true
  }, [notebook, entryBody, sketchDirty, attachmentPaths, isCorrectionMode, correctTargetId, correctionReason])

  function resetComposeFields(title = todayTitle()) {
    setEntryTitle(title)
    setEntryBody('')
    setComposeMdTab('write')
    setEntryTags('')
    setAttachmentPaths([])
    setCorrectTargetId('')
    setCorrectionReason('')
    setSketchDirty(false)
    sketchRef.current?.clear()
  }

  function insertMdTemplate(body: string) {
    const chunk = body.endsWith('\n') ? body : `${body}\n`
    const el = mdEditorRef.current
    const start = el?.selectionStart ?? entryBody.length
    const end = el?.selectionEnd ?? entryBody.length
    const before = entryBody.slice(0, start)
    const after = entryBody.slice(end)
    const prefix =
      before.length === 0 ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const next = `${before}${prefix}${chunk}${after}`
    const caret = before.length + prefix.length + chunk.length
    setEntryBody(next)
    setComposeMdTab('write')
    requestAnimationFrame(() => {
      const ta = mdEditorRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(caret, caret)
    })
  }

  function startNewPage(target?: Notebook) {
    const nb = target ?? notebook
    if (!nb) return
    const sealed = nb.sealed
    resetComposeFields(sealed ? `${t(lang, 'correctionPrefix')}${todayTitle()}` : todayTitle())
    setSelectedEntryId(null)
    setViewMode(false)
    setComposeMode(true)
  }

  async function handleCreateNotebook() {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.createNotebook({
        title: createTitle,
        authorName: createAuthor
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setShowCreate(false)
      setCreateTitle('')
      setCreateAuthor('')
      await refreshList()
      setNotebook(res.data)
      setVerifyResult(null)
      startNewPage(res.data)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function handlePickFiles() {
    const res = await window.api.pickFiles()
    if (!res.ok) {
      setError(res.error)
      return
    }
    if (res.data.length) {
      setAttachmentPaths((prev) => [...prev, ...res.data])
    }
  }

  async function signLatestEntry(nb: Notebook, entryId: string): Promise<Notebook> {
    if (!identity) return nb
    const signed = await window.api.signEntry({
      notebookId: nb.id,
      entryId
    })
    if (!signed.ok) throw new Error(signed.error)
    return signed.data
  }

  async function handleEnroll() {
    setBusy(true)
    setError(null)
    try {
      const name = enrollName.trim()
      if (!name) {
        setError(t(lang, 'enterSignerName'))
        return
      }
      const avail = await window.api.deviceAuthAvailable()
      if (!avail.ok) {
        setError(avail.error)
        return
      }
      if (!avail.data) {
        setError(t(lang, 'helloUnavailable'))
        return
      }
      const res = await window.api.enrollIdentity({ signerName: name })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setIdentity(res.data)
      setShowEnroll(false)
      setEnrollName('')
      setStatus('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitPage() {
    if (!notebook || !canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const paths = [...attachmentPaths]
      const sketch = sketchRef.current?.exportPngDataUrl()
      if (sketch) {
        const saved = await window.api.saveDataUrl(sketch, 'handwriting')
        if (!saved.ok) {
          setError(saved.error)
          return
        }
        paths.push(saved.data)
      }

      const tags = entryTags
        .split(/[,、\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)

      const input = {
        notebookId: notebook.id,
        title: entryTitle.trim() || todayTitle(),
        body: entryBody,
        tags,
        attachmentPaths: paths,
        correctsEntryId: isCorrectionMode ? correctTargetId : undefined,
        correctionReason: isCorrectionMode ? correctionReason : undefined
      }

      const res = isCorrectionMode
        ? await window.api.addCorrection(input)
        : await window.api.addEntry(input)

      if (!res.ok) {
        setError(res.error)
        return
      }

      let next = res.data
      const created = next.entries[next.entries.length - 1]
      if (identity) {
        try {
          next = await signLatestEntry(next, created.id)
        } catch (e) {
          setNotebook(next)
          setSelectedEntryId(created.id)
          setComposeMode(false)
          setViewMode(false)
          resetComposeFields()
          await refreshList()
          setError(e instanceof Error ? e.message : String(e))
          return
        }
      }

      const signedEntry = next.entries.find((e) => e.id === created.id) ?? created
      setNotebook(next)
      setSelectedEntryId(signedEntry.id)
      setComposeMode(false)
      setViewMode(false)
      resetComposeFields()
      await refreshList()
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function handleSeal() {
    if (!notebook) return
    const ok = window.confirm(t(lang, 'sealConfirm'))
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.sealNotebook(notebook.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setNotebook(res.data)
      setComposeMode(false)
      setSelectedEntryId(res.data.entries.at(-1)?.id ?? null)
      await refreshList()
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    if (!notebook) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.verifyNotebook(notebook.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setVerifyResult(res.data)
      setStatus(
        res.data.ok
          ? t(lang, 'verifyOk')
          : `${t(lang, 'verifyNg')} (${res.data.issues.length})`
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleExport() {
    if (!notebook) return
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.exportEvidence(notebook.id)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setVerifyResult(res.data.verify)
      setStatus(res.data.path)
    } finally {
      setBusy(false)
    }
  }

  const showChromeToolbar = composeMode || viewMode

  return (
    <div
      className={`app${composeMode || viewMode ? ' composing' : ''}${
        showChromeToolbar ? ' has-toolbar' : ''
      }`}
    >
      {showChromeToolbar && (
        <header className="toolbar">
          {viewMode ? (
            <button type="button" className="tb-btn" onClick={closePageView} disabled={busy}>
              <IconBack />
              <span>{t(lang, 'backToList')}</span>
            </button>
          ) : (
            <button
              type="button"
              className="tb-btn"
              onClick={() => {
                setComposeMode(false)
                resetComposeFields()
              }}
              disabled={busy}
            >
              <IconCancel />
              <span>{t(lang, 'cancelCompose')}</span>
            </button>
          )}

          {viewMode && notebook && (
            <>
              <span className="tb-sep" />
              <button type="button" className="tb-btn" onClick={() => void handleVerify()} disabled={busy}>
                <IconVerify />
                <span>{t(lang, 'verify')}</span>
              </button>
              <button type="button" className="tb-btn" onClick={() => void handleExport()} disabled={busy}>
                <IconEvidence />
                <span>{t(lang, 'evidence')}</span>
              </button>
              {!notebook.sealed && notebook.entries.length > 0 && (
                <button type="button" className="tb-btn" onClick={() => void handleSeal()} disabled={busy}>
                  <IconSeal />
                  <span>{t(lang, 'seal')}</span>
                </button>
              )}
            </>
          )}
          <div className="toolbar-spacer" />
        </header>
      )}

      <div
        className={`panes${showRightPane ? '' : ' panes-two'}`}
        style={
          showRightPane
            ? {
                gridTemplateColumns: `${leftWidth}px 5px minmax(200px, 1fr) 5px ${rightWidth}px`
              }
            : {
                gridTemplateColumns: `${leftWidth}px 5px minmax(200px, 1fr)`
              }
        }
      >
        <aside className="pane pane-left">
          <div className="pane-head">
            <span>{t(lang, 'library')}</span>
            <div className="pane-head-actions">
              <button
                type="button"
                className="pane-head-action"
                onClick={() => openCreateFolderModal()}
                disabled={busy}
                title={t(lang, 'newFolder')}
              >
                <IconFolder size={14} />
                <span>+</span>
              </button>
              <button
                type="button"
                className="pane-head-action"
                onClick={() => setShowCreate(true)}
                disabled={busy}
                title={t(lang, 'newNotebook')}
              >
                <IconNotebook size={14} />
                <span>+</span>
              </button>
            </div>
          </div>
          {!composeMode && !viewMode && (
            <div className="library-search">
              <IconSearch size={14} className="library-search-icon" />
              <input
                className="library-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(lang, 'search')}
                aria-label={t(lang, 'search')}
              />
            </div>
          )}
          <div className="pane-body">
            {folders.length > 0 && (
              <>
                <div className="tree-section">{t(lang, 'folders')}</div>
                <div className="tree">
                  {folders.map((folder) => {
                    const open = expandedFolders[folder.id] !== false
                    const kids = folder.notebookIds
                      .map((id) => summaryById.get(id))
                      .filter((x): x is NotebookSummary => Boolean(x))
                    return (
                      <div
                        key={folder.id}
                        className={`tree-folder${dropTarget === folder.id ? ' drop-on' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                          setDropTarget(folder.id)
                        }}
                        onDragLeave={() =>
                          setDropTarget((cur) => (cur === folder.id ? null : cur))
                        }
                        onDrop={(e) => {
                          e.preventDefault()
                          const id = e.dataTransfer.getData('text/notebook-id')
                          if (id) void handleMoveNotebook(id, folder.id)
                        }}
                      >
                        <div className="tree-item tree-folder-row">
                          <button
                            type="button"
                            className="tree-fold-toggle"
                            aria-expanded={open}
                            onClick={() =>
                              setExpandedFolders((prev) => ({
                                ...prev,
                                [folder.id]: !open
                              }))
                            }
                          >
                            <IconChevron size={14} open={open} />
                          </button>
                          <button
                            type="button"
                            className="tree-folder-main"
                            onClick={() => {
                              setSelectedFolderId(folder.id)
                              setExpandedFolders((prev) => ({
                                ...prev,
                                [folder.id]: true
                              }))
                            }}
                            onDoubleClick={() => openRenameFolderModal(folder)}
                          >
                            <IconFolder size={14} />
                            <span className="label">{folder.name}</span>
                            <span className="meta">{kids.length}</span>
                          </button>
                          <button
                            type="button"
                            className="tree-folder-menu"
                            title={t(lang, 'renameFolder')}
                            onClick={() => openRenameFolderModal(folder)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="tree-folder-menu"
                            title={t(lang, 'deleteFolder')}
                            onClick={() => void handleDeleteFolder(folder)}
                          >
                            ×
                          </button>
                        </div>
                        {open && (
                          <div className="tree-folder-children">
                            {kids.length === 0 ? (
                              <div className="tree-empty-hint">{t(lang, 'emptyFolder')}</div>
                            ) : (
                              kids.map((n) => renderNotebookTreeItem(n, 1))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            <div className="tree-section">{t(lang, 'unfiled')}</div>
            <div
              className={`tree${dropTarget === 'unfiled' ? ' drop-on' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDropTarget('unfiled')
              }}
              onDragLeave={() => setDropTarget((cur) => (cur === 'unfiled' ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/notebook-id')
                if (id) void handleMoveNotebook(id, null)
              }}
            >
              {summaries.length === 0 && (
                <div className="empty-pane">{t(lang, 'noNotebooks')}</div>
              )}
              {summaries.length > 0 && unfiledSummaries.length === 0 && (
                <div className="tree-empty-hint">{t(lang, 'dropToMove')}</div>
              )}
              {unfiledSummaries.map((n) => renderNotebookTreeItem(n, 0))}
            </div>
          </div>
          <div className="library-footer">
            <button
              type="button"
              className="library-footer-btn library-footer-signer"
              onClick={() => {
                setEnrollName(identity?.signerName ?? '')
                setShowEnroll(true)
              }}
              disabled={busy}
              title={t(lang, 'signer')}
            >
              <IconSigner size={15} />
              <span className="library-footer-label">
                {identity ? identity.signerName : t(lang, 'signer')}
              </span>
            </button>
            <button
              type="button"
              className="library-footer-btn library-footer-settings"
              onClick={() => setShowSettings(true)}
              disabled={busy}
              title={t(lang, 'settings')}
              aria-label={t(lang, 'settings')}
            >
              <IconSettings size={15} />
            </button>
          </div>
        </aside>

        <PaneResizer
          edge="left"
          label={t(lang, 'leftPaneWidth')}
          onResize={resizeLeft}
          onReset={resetLeft}
        />

        {!composeMode && !viewMode && searchActive && (
          <section className="pane pane-center">
            <div className="pane-head">
              <span>
                {t(lang, 'searchResults')}
                {searching ? '' : ` (${searchHits.length})`}
              </span>
            </div>
            <div className="pane-body">
              {searching ? (
                <div className="empty-pane">{t(lang, 'searching')}</div>
              ) : searchHits.length === 0 ? (
                <div className="empty-pane">{t(lang, 'noResults')}</div>
              ) : (
                <table className="item-table">
                  <thead>
                    <tr>
                      <th className="col-title">{t(lang, 'content')}</th>
                      <th className="col-kind">{t(lang, 'location')}</th>
                      <th className="col-date">{t(lang, 'notebook')}</th>
                      <th className="col-hash">{t(lang, 'dateTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchHits.map((hit, i) => (
                      <tr
                        key={`${hit.notebookId}-${hit.entryId ?? 'nb'}-${hit.field}-${i}`}
                        onClick={() => void openSearchHit(hit)}
                        onDoubleClick={() => void openSearchHit(hit)}
                      >
                        <td className="col-title">
                          <div className="hit-title">{hit.entryTitle || hit.notebookTitle}</div>
                          <div className="hit-snippet">{hit.snippet}</div>
                        </td>
                        <td className="col-kind">{fieldLabel(lang, hit.field)}</td>
                        <td className="col-date">{hit.notebookTitle}</td>
                        <td className="col-hash">
                          {hit.createdAt ? formatDate(hit.createdAt) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {!composeMode && !viewMode && !searchActive && (
          <section className="pane pane-center">
            <div className="pane-head">
              <span className="pane-head-title">
                <span>{notebook ? notebook.title : t(lang, 'pages')}</span>
                {notebook?.sealed && <span className="badge sealed">{t(lang, 'sealed')}</span>}
              </span>
              <div className="pane-head-actions">
                <button
                  type="button"
                  className="pane-head-action"
                  onClick={() => startNewPage()}
                  disabled={busy || !notebook}
                  title={notebook?.sealed ? t(lang, 'addCorrection') : t(lang, 'newPage')}
                >
                  {notebook?.sealed ? <IconCorrection size={14} /> : <IconPlusPage size={14} />}
                  <span>+</span>
                </button>
                <button
                  type="button"
                  className="pane-head-action"
                  onClick={() => openPageView()}
                  disabled={busy || !notebook || !selectedEntryId}
                  title={t(lang, 'view')}
                >
                  <IconView size={14} />
                </button>
              </div>
            </div>
            <div className="pane-body">
              {!notebook ? (
                <div className="empty-pane" />
              ) : pages.length === 0 ? (
                <div className="empty-pane">{t(lang, 'noPages')}</div>
              ) : (
                <table className="item-table">
                  <thead>
                    <tr>
                      <th className="col-title">{t(lang, 'pages')}</th>
                      <th className="col-kind">{t(lang, 'kind')}</th>
                      <th className="col-date">{t(lang, 'dateTime')}</th>
                      <th className="col-hash">{t(lang, 'hash')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((entry) => (
                      <tr
                        key={entry.id}
                        className={selectedEntryId === entry.id ? 'selected' : ''}
                        onClick={() => setSelectedEntryId(entry.id)}
                        onDoubleClick={() => openPageView(entry.id)}
                      >
                        <td className="col-title">{entry.title || t(lang, 'untitledPage')}</td>
                        <td className="col-kind">{kindLabel(lang, entry.kind)}</td>
                        <td className="col-date">{formatDate(entry.createdAt)}</td>
                        <td className="col-hash">{shortHash(entry.hash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {viewMode && notebook && selectedEntry && (
          <section className="pane pane-compose pane-reader">
            <div className="pane-head reader-head">
              <span>{notebook.title}</span>
              <span className="reader-page-pos">
                {viewPageIndex + 1} / {notebook.entries.length}
              </span>
            </div>
            <div className="reader-stage">
              <button
                type="button"
                className="reader-nav reader-nav-prev"
                aria-label={t(lang, 'prevPage')}
                disabled={!canFlipPrev}
                onClick={() => goViewPage('prev')}
              >
                ‹
              </button>
              <div
                className="pane-body compose-scroll reader-swipe"
                onPointerDown={onReaderPointerDown}
                onPointerUp={onReaderPointerUp}
                onPointerCancel={onReaderPointerCancel}
              >
                <article
                  key={selectedEntry.id}
                  className={`compose-page reader-page${flipAnim ? ` flip-${flipAnim}` : ''}`}
                >
                  <header className="reader-header">
                    <p className="reader-kicker">
                      {kindLabel(lang, selectedEntry.kind)} · {formatDate(selectedEntry.createdAt)} ·{' '}
                      {notebook.authorName}
                    </p>
                    <h1>{selectedEntry.title || t(lang, 'untitled')}</h1>
                    {selectedEntry.tags.length > 0 && (
                      <p className="reader-tags">{selectedEntry.tags.join(' · ')}</p>
                    )}
                    {selectedEntry.correctionReason && (
                      <p className="reader-correction">
                        {t(lang, 'correctionReasonPrefix')}
                        {selectedEntry.correctionReason}
                      </p>
                    )}
                  </header>

                  <section className="reader-section">
                    <h2>{t(lang, 'body')}</h2>
                    <MarkdownBody source={selectedEntry.body} className="reader-body" />
                  </section>

                  {selectedEntry.attachments.length > 0 && (
                    <section className="reader-section">
                      <h2>{t(lang, 'attachments')}</h2>
                      <div className="reader-attachments">
                        {selectedEntry.attachments.map((att) => (
                          <figure key={att.id} className="reader-figure">
                            {previewUrls[att.id] ? (
                              <img src={previewUrls[att.id]} alt={att.originalName} />
                            ) : (
                              <div className="reader-file-fallback">{att.originalName}</div>
                            )}
                            <figcaption>
                              <button
                                type="button"
                                className="linkish"
                                onClick={() => void window.api.openAttachment(notebook.id, att.storedName)}
                              >
                                {att.originalName}
                              </button>
                              <span className="hash-mono"> {shortHash(att.sha256)}</span>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="reader-section reader-meta">
                    <h2>{t(lang, 'hash')}</h2>
                    <dl className="kv">
                      <dt>{t(lang, 'hashCurrent')}</dt>
                      <dd className="hash-mono">{selectedEntry.hash}</dd>
                      <dt>{t(lang, 'hashPrev')}</dt>
                      <dd className="hash-mono">{selectedEntry.prevHash}</dd>
                    </dl>
                  </section>

                  {selectedEntry.signature && (
                    <section className="reader-section reader-meta">
                      <h2>{t(lang, 'signature')}</h2>
                      <dl className="kv">
                        <dt>{t(lang, 'signer')}</dt>
                        <dd>{selectedEntry.signature.signerName}</dd>
                        <dt>{t(lang, 'dateTime')}</dt>
                        <dd>{formatDate(selectedEntry.signature.signedAt)}</dd>
                        <dt>{t(lang, 'publicKey')}</dt>
                        <dd className="hash-mono">{shortHash(selectedEntry.signature.publicKey)}</dd>
                      </dl>
                    </section>
                  )}
                </article>
              </div>
              <button
                type="button"
                className="reader-nav reader-nav-next"
                aria-label={t(lang, 'nextPage')}
                disabled={!canFlipNext}
                onClick={() => goViewPage('next')}
              >
                ›
              </button>
            </div>
          </section>
        )}

        {composeMode && notebook && (
          <section className="pane pane-compose">
            <div className="pane-head">
              <span>
                {isCorrectionMode ? t(lang, 'correctionPage') : t(lang, 'newPage')} —{' '}
                {notebook.title}
              </span>
            </div>
            <div className="pane-body compose-scroll">
              <div className="compose-page">
                <label className="field">
                  {t(lang, 'heading')}
                  <input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                  />
                </label>

                <div className="field">
                  <div className="md-field-head">
                    <span>{t(lang, 'body')}</span>
                    <div className="md-tabs" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        className={`md-tab${composeMdTab === 'write' ? ' on' : ''}`}
                        aria-selected={composeMdTab === 'write'}
                        onClick={() => setComposeMdTab('write')}
                      >
                        {t(lang, 'mdWrite')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        className={`md-tab${composeMdTab === 'preview' ? ' on' : ''}`}
                        aria-selected={composeMdTab === 'preview'}
                        onClick={() => setComposeMdTab('preview')}
                      >
                        {t(lang, 'mdPreview')}
                      </button>
                    </div>
                  </div>
                  <p className="md-hint">{t(lang, 'bodyMarkdownHint')}</p>
                  <div className="md-tpl-row" aria-label={t(lang, 'mdTemplates')}>
                    <span className="md-tpl-label">{t(lang, 'mdTemplates')}</span>
                    {MD_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        className="md-tpl-btn"
                        disabled={busy}
                        onClick={() => insertMdTemplate(tpl.body)}
                      >
                        {t(lang, tpl.labelKey)}
                      </button>
                    ))}
                  </div>
                  {composeMdTab === 'write' ? (
                    <textarea
                      ref={mdEditorRef}
                      className="md-editor"
                      value={entryBody}
                      onChange={(e) => setEntryBody(e.target.value)}
                      rows={12}
                      spellCheck={false}
                      placeholder={'## 見出し\n\n- 箇条書き\n- **強調**\n\n`code`'}
                    />
                  ) : (
                    <div className="md-preview-pane">
                      <MarkdownBody source={entryBody} />
                    </div>
                  )}
                </div>

                <div className="field">
                  <span>{t(lang, 'handwriting')}</span>
                  <SketchPad lang={lang} handleRef={sketchRef} onDirtyChange={setSketchDirty} />
                </div>

                <label className="field">
                  {t(lang, 'tags')}
                  <input
                    value={entryTags}
                    onChange={(e) => setEntryTags(e.target.value)}
                  />
                </label>

                {isCorrectionMode && (
                  <div className="correction-box">
                    <label className="field">
                      {t(lang, 'correctionTarget')}
                      <select
                        value={correctTargetId}
                        onChange={(e) => setCorrectTargetId(e.target.value)}
                      >
                        <option value="">{t(lang, 'selectPlaceholder')}</option>
                        {notebook.entries
                          .filter((e) => e.kind !== 'seal')
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {formatDate(e.createdAt)} — {e.title || t(lang, 'untitled')}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      {t(lang, 'correctionReason')}
                      <input
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                      />
                    </label>
                  </div>
                )}

                <div className="field">
                  <span>{t(lang, 'attachments')}</span>
                  <div className="attach-row">
                    <button type="button" className="btn" onClick={() => void handlePickFiles()} disabled={busy}>
                      {t(lang, 'addFiles')}
                    </button>
                    {attachmentPaths.length > 0 && (
                      <ul className="attach-names">
                        {attachmentPaths.map((p) => (
                          <li key={p}>{p.split(/[/\\]/).pop()}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="compose-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setEnrollName(identity?.signerName ?? '')
                      setShowEnroll(true)
                    }}
                    disabled={busy}
                  >
                    {identity
                      ? `${t(lang, 'signer')}: ${identity.signerName}`
                      : t(lang, 'registerSigner')}
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => void handleSubmitPage()}
                    disabled={busy || !canSubmit}
                  >
                    {identity ? t(lang, 'saveSigned') : t(lang, 'save')}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {showRightPane && (
          <PaneResizer
            edge="right"
            label={t(lang, 'rightPaneWidth')}
            onResize={resizeRight}
            onReset={resetRight}
          />
        )}

        {!composeMode && !viewMode && (
          <aside className="pane pane-right">
            <div className="pane-head">{t(lang, 'detail')}</div>
            <div className="detail">
              {!notebook && <div className="empty-pane" />}
              {notebook && !selectedEntry && <div className="empty-pane" />}
              {notebook && selectedEntry && (
                <>
                  <div className="detail-header">
                    <h1>{selectedEntry.title || t(lang, 'untitled')}</h1>
                    <div className="sub">
                      {kindLabel(lang, selectedEntry.kind)} · {formatDate(selectedEntry.createdAt)}
                    </div>
                  </div>
                  <div className="detail-sections">
                    <div className="section">
                      <button type="button" className="section-toggle" onClick={() => setInfoOpen((v) => !v)}>
                        {infoOpen ? '▾' : '▸'} {t(lang, 'info')}
                      </button>
                      {infoOpen && (
                        <div className="section-body">
                          <dl className="kv">
                            <dt>{t(lang, 'author')}</dt>
                            <dd>{notebook.authorName}</dd>
                            <dt>{t(lang, 'notebook')}</dt>
                            <dd>{notebook.title}</dd>
                            <dt>{t(lang, 'kind')}</dt>
                            <dd>{kindLabel(lang, selectedEntry.kind)}</dd>
                            {selectedEntry.correctionReason && (
                              <>
                                <dt>{t(lang, 'correctionReason')}</dt>
                                <dd>{selectedEntry.correctionReason}</dd>
                              </>
                            )}
                            <dt>{t(lang, 'tags')}</dt>
                            <dd>{selectedEntry.tags.length ? selectedEntry.tags.join(', ') : '—'}</dd>
                            <dt>{t(lang, 'hash')}</dt>
                            <dd className="hash-mono">{selectedEntry.hash}</dd>
                            {selectedEntry.signature && (
                              <>
                                <dt>{t(lang, 'signer')}</dt>
                                <dd>{selectedEntry.signature.signerName}</dd>
                              </>
                            )}
                          </dl>
                        </div>
                      )}
                    </div>

                    <div className="section">
                      <button type="button" className="section-toggle" onClick={() => setBodyOpen((v) => !v)}>
                        {bodyOpen ? '▾' : '▸'} {t(lang, 'body')}
                      </button>
                      {bodyOpen && (
                        <div className="section-body">
                          <MarkdownBody source={selectedEntry.body} />
                        </div>
                      )}
                    </div>

                    {selectedEntry.attachments.length > 0 && (
                      <div className="section">
                        <button type="button" className="section-toggle" onClick={() => setAttachOpen((v) => !v)}>
                          {attachOpen ? '▾' : '▸'} {t(lang, 'attachments')} (
                          {selectedEntry.attachments.length})
                        </button>
                        {attachOpen && (
                          <div className="section-body">
                            <div className="attach-list">
                              {selectedEntry.attachments.map((att) => (
                                <div key={att.id} className="attach-item">
                                  {previewUrls[att.id] && (
                                    <img
                                      src={previewUrls[att.id]}
                                      alt={att.originalName}
                                      className="attach-preview"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    className="linkish"
                                    onClick={() =>
                                      void window.api.openAttachment(notebook.id, att.storedName)
                                    }
                                  >
                                    {att.originalName} ({shortHash(att.sha256)})
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="status-bar">
        <span className={error ? 'bad' : verifyResult ? (verifyResult.ok ? 'ok' : 'bad') : ''}>
          {error ?? status}
        </span>
        <span className={labIndicator.className} title={labProbe?.message ?? ''}>
          <span className="lab-dot" aria-hidden />
          {labIndicator.text}
        </span>
        {notebook && (
          <span>
            {notebook.entries.length} {t(lang, 'pages')}
          </span>
        )}
      </footer>

      {folderModal && (
        <div className="modal-back" onClick={() => !busy && setFolderModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>
              {folderModal.mode === 'create'
                ? t(lang, 'folderModalCreate')
                : folderModal.mode === 'renameNotebook'
                  ? t(lang, 'notebookModalRename')
                  : t(lang, 'folderModalRename')}
            </h2>
            <label className="field">
              {folderModal.mode === 'renameNotebook'
                ? t(lang, 'notebookNamePrompt')
                : t(lang, 'folderNamePrompt')}
              <input
                value={folderModal.name}
                onChange={(e) => setFolderModal({ ...folderModal, name: e.target.value })}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && folderModal.name.trim() && !busy) {
                    void handleSubmitFolderModal()
                  }
                }}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setFolderModal(null)} disabled={busy}>
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void handleSubmitFolderModal()}
                disabled={busy || !folderModal.name.trim()}
              >
                {folderModal.mode === 'create' ? t(lang, 'create') : t(lang, 'rename')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="modal-back" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>{t(lang, 'newNotebook')}</h2>
            <label className="field">
              {t(lang, 'notebookTitle')}
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              {t(lang, 'authorName')}
              <input
                value={createAuthor}
                onChange={(e) => setCreateAuthor(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => void handleCreateNotebook()}
                disabled={busy}
              >
                {t(lang, 'create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        open={showSettings}
        settings={settings}
        busy={busy}
        labProbe={labProbe}
        onClose={() => setShowSettings(false)}
        onSave={async (patch) => {
          await handleUpdateSettings(patch)
          if (patch.labServer) await refreshLabProbe()
        }}
        onPickDataDir={handlePickDataDir}
        onResetDataDir={handleResetDataDir}
        onPickLabShare={handlePickLabShare}
        onSetLabSharePath={handleSetLabSharePath}
        onOpenLabNetwork={handleOpenLabNetwork}
        onProbeLab={handleProbeLab}
        syncCandidates={syncCandidates}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        backupMessages={backupMessages}
        onPickSyncCandidate={(root) => {
          const trimmed = root.replace(/[\\/]+$/, '')
          void handleSetLabSharePath(`${trimmed}\\LabNoteChain`)
        }}
      />

      {showEnroll && (
        <div className="modal-back" onClick={() => !busy && setShowEnroll(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2>{t(lang, 'signer')}</h2>
            <p className="modal-lead">{t(lang, 'signerLead')}</p>
            {identity ? (
              <dl className="kv" style={{ marginBottom: 12 }}>
                <dt>{t(lang, 'name')}</dt>
                <dd>{identity.signerName}</dd>
                <dt>{t(lang, 'publicKey')}</dt>
                <dd className="hash-mono">{shortHash(identity.publicKey)}</dd>
              </dl>
            ) : (
              <label className="field">
                {t(lang, 'signerName')}
                <input
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && enrollName.trim() && !busy) void handleEnroll()
                  }}
                />
              </label>
            )}
            {error && showEnroll && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setShowEnroll(false)} disabled={busy}>
                {t(lang, 'close')}
              </button>
              {identity ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      setError(null)
                      const res = await window.api.clearIdentity()
                      setBusy(false)
                      if (!res.ok) {
                        setError(res.error)
                        return
                      }
                      setIdentity(null)
                      setEnrollName('')
                    })()
                  }}
                >
                  {t(lang, 'unregister')}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void handleEnroll()}
                  disabled={busy || !enrollName.trim()}
                >
                  {busy ? t(lang, 'verifyingUser') : t(lang, 'registerWithHello')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
