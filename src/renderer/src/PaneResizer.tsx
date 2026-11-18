import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  edge: 'left' | 'right'
  label: string
  onResize: (deltaX: number) => void
  onReset?: () => void
}

/**
 * Cursor の sash と同様：細い線＋広いヒット領域、ドラッグで幅変更、ダブルクリックで既定に戻す。
 */
export default function PaneResizer({ edge, label, onResize, onReset }: Props) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      dragging.current = true
      lastX.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
      document.body.classList.add('pane-resizing')
    },
    []
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const dx = e.clientX - lastX.current
      lastX.current = e.clientX
      if (dx !== 0) onResize(dx)
    },
    [onResize]
  )

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    document.body.classList.remove('pane-resizing')
  }, [])

  return (
    <div
      className={`pane-resizer pane-resizer-${edge}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onReset?.()}
    />
  )
}
