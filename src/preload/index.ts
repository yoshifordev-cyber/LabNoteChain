import { contextBridge, ipcRenderer } from 'electron'
import type {
  AddEntryInput,
  ApiResponse,
  CreateNotebookInput,
  LibraryFolder,
  LibraryIndex,
  Notebook,
  NotebookSummary,
  SearchHit,
  SignerIdentityPublic,
  VerifyResult
} from '../shared/types'
import type {
  AppSettingsPublic,
  LabShareProbe,
  LabTimestampRecord,
  SettingsPatch,
  SyncFolderCandidate,
  BackupExportResult,
  BackupImportResult
} from '../shared/settings'

const api = {
  listNotebooks: (): Promise<ApiResponse<NotebookSummary[]>> =>
    ipcRenderer.invoke('notebooks:list'),
  search: (query: string): Promise<ApiResponse<SearchHit[]>> =>
    ipcRenderer.invoke('notebooks:search', query),
  getNotebook: (id: string): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:get', id),
  renameNotebook: (id: string, title: string): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:rename', id, title),
  createNotebook: (input: CreateNotebookInput): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:create', input),
  listFolders: (): Promise<ApiResponse<LibraryFolder[]>> =>
    ipcRenderer.invoke('library:listFolders'),
  createFolder: (name: string): Promise<ApiResponse<LibraryFolder>> =>
    ipcRenderer.invoke('library:createFolder', name),
  renameFolder: (folderId: string, name: string): Promise<ApiResponse<LibraryFolder>> =>
    ipcRenderer.invoke('library:renameFolder', folderId, name),
  deleteFolder: (folderId: string): Promise<ApiResponse<LibraryIndex>> =>
    ipcRenderer.invoke('library:deleteFolder', folderId),
  moveNotebookToFolder: (input: {
    notebookId: string
    folderId: string | null
  }): Promise<ApiResponse<LibraryIndex>> => ipcRenderer.invoke('library:moveNotebook', input),
  addEntry: (input: AddEntryInput): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:addEntry', input),
  addCorrection: (input: AddEntryInput): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:addCorrection', input),
  sealNotebook: (id: string): Promise<ApiResponse<Notebook>> =>
    ipcRenderer.invoke('notebooks:seal', id),
  verifyNotebook: (id: string): Promise<ApiResponse<VerifyResult>> =>
    ipcRenderer.invoke('notebooks:verify', id),
  exportEvidence: (
    id: string
  ): Promise<ApiResponse<{ path: string; verify: VerifyResult }>> =>
    ipcRenderer.invoke('notebooks:exportEvidence', id),
  pickFiles: (): Promise<ApiResponse<string[]>> => ipcRenderer.invoke('dialog:pickFiles'),
  openAttachment: (notebookId: string, storedName: string): Promise<ApiResponse<boolean>> =>
    ipcRenderer.invoke('attachments:open', notebookId, storedName),
  saveDataUrl: (dataUrl: string, fileName: string): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke('attachments:saveDataUrl', dataUrl, fileName),
  readAttachmentDataUrl: (
    notebookId: string,
    storedName: string
  ): Promise<ApiResponse<string>> =>
    ipcRenderer.invoke('attachments:readDataUrl', notebookId, storedName),
  getSettings: (): Promise<ApiResponse<AppSettingsPublic>> =>
    ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: SettingsPatch): Promise<ApiResponse<AppSettingsPublic>> =>
    ipcRenderer.invoke('settings:update', patch),
  pickDataDir: (): Promise<ApiResponse<AppSettingsPublic>> =>
    ipcRenderer.invoke('settings:pickDataDir'),
  exportBackup: (): Promise<ApiResponse<BackupExportResult>> => ipcRenderer.invoke('backup:export'),
  importBackup: (): Promise<ApiResponse<BackupImportResult>> => ipcRenderer.invoke('backup:import'),
  probeLabShare: (opts?: { write?: boolean }): Promise<ApiResponse<LabShareProbe>> =>
    ipcRenderer.invoke('lab:probe', opts),
  detectSyncFolders: (): Promise<ApiResponse<SyncFolderCandidate[]>> =>
    ipcRenderer.invoke('lab:detectSyncFolders'),
  setLabSharePath: (path: string): Promise<ApiResponse<AppSettingsPublic>> =>
    ipcRenderer.invoke('lab:setSharePath', path),
  pickLabShareDir: (): Promise<ApiResponse<AppSettingsPublic>> =>
    ipcRenderer.invoke('lab:pickShareDir'),
  openLabNetwork: (): Promise<ApiResponse<boolean>> => ipcRenderer.invoke('lab:openNetwork'),
  anchorLabEntry: (input: {
    notebookId: string
    entryId: string
  }): Promise<ApiResponse<LabTimestampRecord>> => ipcRenderer.invoke('lab:anchorEntry', input),
  getIdentity: (): Promise<ApiResponse<SignerIdentityPublic | null>> =>
    ipcRenderer.invoke('identity:get'),
  deviceAuthAvailable: (): Promise<ApiResponse<boolean>> =>
    ipcRenderer.invoke('identity:deviceAuthAvailable'),
  enrollIdentity: (input: {
    signerName: string
  }): Promise<ApiResponse<SignerIdentityPublic>> => ipcRenderer.invoke('identity:enroll', input),
  clearIdentity: (): Promise<ApiResponse<boolean>> => ipcRenderer.invoke('identity:clear'),
  signEntry: (input: {
    notebookId: string
    entryId: string
  }): Promise<ApiResponse<Notebook>> => ipcRenderer.invoke('identity:signEntry', input)
}

contextBridge.exposeInMainWorld('api', api)

export type NotebookApi = typeof api
