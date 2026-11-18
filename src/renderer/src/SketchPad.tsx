import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react'
import type { AppLanguage } from '../../shared/settings'
import { t } from './i18n'

export type SketchPadHandle = {
  exportPngDataUrl: () => string | null
  clear: () => void
  isDirty: () => boolean
}

type Props = {
  lang?: AppLanguage
  handleRef?: MutableRefObject<SketchPadHandle | null>
  onDirtyChange?: (dirty: boolean) => void
}

type Tool = 'pen' | 'eraser'

export default function SketchPad({ lang = 'en', handleRef, onDirtyChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#15141a')
  const [width, setWidth] = useState(2)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const paintBlank = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const w = Math.max(320, Math.floor(rect.width))
      const h = 280
      const snapshot = dirty.current ? canvas.toDataURL() : null
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintBlank(ctx, w, h)
      if (snapshot) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, w, h)
        img.src = snapshot
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!handleRef) return
    handleRef.current = {
      exportPngDataUrl: () => {
        if (!dirty.current || !canvasRef.current) return null
        return canvasRef.current.toDataURL('image/png')
      },
      clear: () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
        dirty.current = false
        onDirtyChange?.(false)
      },
      isDirty: () => dirty.current
    }
  }, [handleRef, onDirtyChange])

  function pos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function pointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    const { x, y } = pos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = tool === 'eraser' ? width * 4 : width
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
  }

  function pointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!dirty.current) {
      dirty.current = true
      onDirtyChange?.(true)
    }
  }

  function pointerUp(e: PointerEvent<HTMLCanvasElement>) {
    drawing.current = false
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="sketch">
      <div className="sketch-toolbar">
        <button
          type="button"
          className={tool === 'pen' ? 'tb-btn primary' : 'tb-btn'}
          onClick={() => setTool('pen')}
        >
          {t(lang, 'pen')}
        </button>
        <button
          type="button"
          className={tool === 'eraser' ? 'tb-btn primary' : 'tb-btn'}
          onClick={() => setTool('eraser')}
        >
          {t(lang, 'eraser')}
        </button>
        <span className="tb-sep" />
        {['#15141a', '#0a84ff', '#cc2936'].map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${color === c && tool === 'pen' ? ' on' : ''}`}
            style={{ background: c }}
            onClick={() => {
              setColor(c)
              setTool('pen')
            }}
            aria-label={`${t(lang, 'color')} ${c}`}
          />
        ))}
        <label className="width-label">
          {t(lang, 'strokeWidth')}
          <input
            type="range"
            min={1}
            max={8}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </label>
        <button type="button" className="tb-btn" onClick={() => handleRef?.current?.clear()}>
          {t(lang, 'clearCanvas')}
        </button>
      </div>
      <div className="sketch-canvas-wrap">
        <canvas
          ref={canvasRef}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={pointerUp}
        />
      </div>
    </div>
  )
}
