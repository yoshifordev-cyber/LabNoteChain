import { useCallback, useEffect, useState } from 'react'

const KEY_LEFT = 'integrity-lab.pane.left'
const KEY_RIGHT = 'integrity-lab.pane.right'

export const DEFAULT_LEFT = 220
export const DEFAULT_RIGHT = 340
const MIN_LEFT = 140
const MAX_LEFT = 480
const MIN_RIGHT = 200
const MAX_RIGHT = 560

function read(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function usePaneWidths() {
  const [leftWidth, setLeftWidth] = useState(() =>
    clamp(read(KEY_LEFT, DEFAULT_LEFT), MIN_LEFT, MAX_LEFT)
  )
  const [rightWidth, setRightWidth] = useState(() =>
    clamp(read(KEY_RIGHT, DEFAULT_RIGHT), MIN_RIGHT, MAX_RIGHT)
  )

  useEffect(() => {
    try {
      localStorage.setItem(KEY_LEFT, String(leftWidth))
      localStorage.setItem(KEY_RIGHT, String(rightWidth))
    } catch {
      /* ignore */
    }
  }, [leftWidth, rightWidth])

  const resizeLeft = useCallback((dx: number) => {
    setLeftWidth((w) => clamp(w + dx, MIN_LEFT, MAX_LEFT))
  }, [])

  const resizeRight = useCallback((dx: number) => {
    // 右境界を右へ動かすと右ペインは狭くなる
    setRightWidth((w) => clamp(w - dx, MIN_RIGHT, MAX_RIGHT))
  }, [])

  const resetLeft = useCallback(() => setLeftWidth(DEFAULT_LEFT), [])
  const resetRight = useCallback(() => setRightWidth(DEFAULT_RIGHT), [])

  return {
    leftWidth,
    rightWidth,
    resizeLeft,
    resizeRight,
    resetLeft,
    resetRight
  }
}
