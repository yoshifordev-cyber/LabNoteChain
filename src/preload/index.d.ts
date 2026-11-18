import type { NotebookApi } from './index'

declare global {
  interface Window {
    api: NotebookApi
  }
}

export {}
