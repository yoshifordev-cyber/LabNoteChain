import { useEffect, useRef, useState } from 'react'
import type {
  AppSettingsPublic,
  LabShareProbe,
  SettingsPatch,
  SyncFolderCandidate
} from '../../shared/settings'
import { t, type MessageKey } from './i18n'

type Tab = 'general' | 'appearance' | 'connections'

type Props = {
  open: boolean
  settings: AppSettingsPublic
  busy: boolean
  labProbe: LabShareProbe | null
  onClose: () => void
  onSave: (patch: SettingsPatch) => Promise<void>
  onPickDataDir: () => Promise<void>
  onResetDataDir: () => Promise<void>
  onPickLabShare: () => Promise<void>
  onSetLabSharePath: (path: string) => Promise<void>
  onOpenLabNetwork: () => Promise<void>
  onProbeLab: () => Promise<void>
  syncCandidates: SyncFolderCandidate[]
  onPickSyncCandidate: (rootPath: string) => void
  onExportBackup: () => Promise<void>
  onImportBackup: () => Promise<void>
  backupMessages: string[] | null
}

export default function SettingsModal({
  open,
  settings,
  busy,
  labProbe,
  onClose,
  onSave,
  onPickDataDir,
  onResetDataDir,
  onPickLabShare,
  onSetLabSharePath,
  onOpenLabNetwork,
  onProbeLab,
  syncCandidates,
  onPickSyncCandidate,
  onExportBackup,
  onImportBackup,
  backupMessages
}: Props) {
  const [tab, setTab] = useState<Tab>('general')
  const [draft, setDraft] = useState(settings)
  const [sharePathDraft, setSharePathDraft] = useState(settings.labServer.sharePath)
  const wasOpen = useRef(false)
  const lang = draft.language

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(settings)
      setSharePathDraft(settings.labServer.sharePath)
      setTab('general')
    } else if (open) {
      setDraft(settings)
      setSharePathDraft(settings.labServer.sharePath)
    }
    wasOpen.current = open
  }, [open, settings])

  if (!open) return null

  const label = (key: MessageKey) => t(lang, key)

  async function commit(patch: SettingsPatch) {
    setDraft((d) => ({
      ...d,
      ...patch,
      labServer: { ...d.labServer, ...(patch.labServer ?? {}) },
      cloud: { ...d.cloud, ...(patch.cloud ?? {}) }
    }))
    await onSave(patch)
  }

  return (
    <div className="modal-back" onClick={() => !busy && onClose()}>
      <div
        className="modal settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label('settings')}
      >
        <h2>{label('settings')}</h2>
        <div className="settings-tabs">
          {(
            [
              ['general', 'general'],
              ['appearance', 'appearance'],
              ['connections', 'connections']
            ] as const
          ).map(([id, key]) => (
            <button
              key={id}
              type="button"
              className={`settings-tab${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label(key)}
            </button>
          ))}
        </div>

        <div className="settings-body">
          {tab === 'general' && (
            <>
              <label className="field">
                {label('language')}
                <select
                  value={draft.language}
                  disabled={busy}
                  onChange={(e) => void commit({ language: e.target.value as 'ja' | 'en' })}
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </label>

              <div className="field">
                <span>{label('dataFolder')}</span>
                <p className="settings-hint">{label('dataFolderHint')}</p>
                <code className="settings-path">{settings.resolvedDataDir}</code>
                <div className="settings-row">
                  <button type="button" className="btn" disabled={busy} onClick={() => void onPickDataDir()}>
                    {label('chooseFolder')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || settings.dataDir == null}
                    onClick={() => void onResetDataDir()}
                  >
                    {label('useDefaultFolder')}
                  </button>
                </div>
              </div>

              <fieldset className="settings-block">
                <legend>{label('backupTitle')}</legend>
                <p className="settings-hint">{label('backupHint')}</p>
                <div className="settings-row settings-row-wrap">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void onExportBackup()}
                  >
                    {label('backupExport')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void onImportBackup()}
                  >
                    {label('backupImport')}
                  </button>
                </div>
                {backupMessages && backupMessages.length > 0 && (
                  <ul className="backup-result">
                    {backupMessages.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </fieldset>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <label className="field">
                {label('theme')}
                <select
                  value={draft.theme}
                  disabled={busy}
                  onChange={(e) =>
                    void commit({ theme: e.target.value as AppSettingsPublic['theme'] })
                  }
                >
                  <option value="light">{label('themeLight')}</option>
                  <option value="dark">{label('themeDark')}</option>
                  <option value="system">{label('themeSystem')}</option>
                </select>
              </label>

              <label className="field">
                {label('fontSize')}
                <select
                  value={draft.fontSize}
                  disabled={busy}
                  onChange={(e) =>
                    void commit({ fontSize: e.target.value as AppSettingsPublic['fontSize'] })
                  }
                >
                  <option value="sm">{label('fontSizeSm')}</option>
                  <option value="md">{label('fontSizeMd')}</option>
                  <option value="lg">{label('fontSizeLg')}</option>
                </select>
              </label>

              <label className="field">
                {label('fontFamily')}
                <select
                  value={draft.fontFamily}
                  disabled={busy}
                  onChange={(e) =>
                    void commit({
                      fontFamily: e.target.value as AppSettingsPublic['fontFamily']
                    })
                  }
                >
                  <option value="system">{label('fontSystem')}</option>
                  <option value="arial">{label('fontArial')}</option>
                  <option value="yu-gothic">{label('fontYuGothic')}</option>
                  <option value="meiryo">{label('fontMeiryo')}</option>
                  <option value="sans">{label('fontSans')}</option>
                  <option value="serif">{label('fontSerif')}</option>
                </select>
              </label>
            </>
          )}

          {tab === 'connections' && (
            <>
              <fieldset className="settings-block">
                <legend>{label('labServer')}</legend>
                <p className="settings-hint">{label('labServerHint')}</p>
                <p className="settings-hint">{label('labConnectSteps')}</p>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.labServer.enabled}
                    disabled={busy}
                    onChange={(e) =>
                      void commit({ labServer: { enabled: e.target.checked } })
                    }
                  />
                  {label('labServerEnable')}
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.labServer.autoAnchor}
                    disabled={busy || !draft.labServer.enabled}
                    onChange={(e) =>
                      void commit({ labServer: { autoAnchor: e.target.checked } })
                    }
                  />
                  {label('labAutoAnchor')}
                </label>
                <label className="field">
                  {label('labSharePath')}
                  <input
                    value={sharePathDraft}
                    disabled={busy || !draft.labServer.enabled}
                    placeholder={label('labSharePathPlaceholder')}
                    spellCheck={false}
                    onChange={(e) => setSharePathDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && sharePathDraft.trim()) {
                        void onSetLabSharePath(sharePathDraft)
                      }
                    }}
                  />
                </label>
                <div className="settings-row settings-row-wrap">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy || !draft.labServer.enabled || !sharePathDraft.trim()}
                    onClick={() => void onSetLabSharePath(sharePathDraft)}
                  >
                    {label('labApplyPath')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !draft.labServer.enabled}
                    onClick={() => void onPickLabShare()}
                  >
                    {label('labBrowseFolder')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void onOpenLabNetwork()}
                  >
                    {label('labOpenNetwork')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !settings.labServer.sharePath}
                    onClick={() => void onProbeLab()}
                  >
                    {label('testConnection')}
                  </button>
                </div>
                <div className="sync-candidates">
                  <span className="sync-candidates-title">{label('labDetectedFolders')}</span>
                  {syncCandidates.length === 0 ? (
                    <p className="settings-hint">{label('labDetectedNone')}</p>
                  ) : (
                    <div className="settings-row settings-row-wrap">
                      {syncCandidates.map((c) => (
                        <button
                          key={c.path}
                          type="button"
                          className="btn"
                          disabled={busy || !draft.labServer.enabled}
                          title={c.path}
                          onClick={() => onPickSyncCandidate(c.path)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="settings-hint">{label('labGoogleDriveHint')}</p>
                </div>
                <p className="settings-hint">{label('labLayoutHint')}</p>
                {labProbe && (
                  <p
                    className={`settings-hint lab-probe-msg${
                      labProbe.reachable ? ' ok' : labProbe.enabled ? ' bad' : ''
                    }`}
                  >
                    {labProbe.message}
                    {labProbe.latencyMs != null ? ` (${labProbe.latencyMs} ms)` : ''}
                  </p>
                )}
              </fieldset>

              <fieldset className="settings-block">
                <legend>{label('cloud')}</legend>
                <p className="settings-hint">{label('cloudHint')}</p>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.cloud.enabled}
                    disabled={busy}
                    onChange={(e) => void commit({ cloud: { enabled: e.target.checked } })}
                  />
                  {label('cloudEnable')}
                </label>
                <label className="field">
                  {label('cloudEndpoint')}
                  <input
                    value={draft.cloud.endpoint}
                    disabled={busy || !draft.cloud.enabled}
                    placeholder="https://…"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        cloud: { ...d.cloud, endpoint: e.target.value }
                      }))
                    }
                    onBlur={() =>
                      void commit({ cloud: { endpoint: draft.cloud.endpoint.trim() } })
                    }
                  />
                </label>
                <p className="settings-hint">{label('cloudComingSoon')}</p>
              </fieldset>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn primary" onClick={onClose} disabled={busy}>
            {label('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
