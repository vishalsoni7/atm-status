import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon } from './Icon'

const CLOSE_MS = 280

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// iOS-style bottom sheet: slides up, dims the page, drag down or tap outside to close.
export function Sheet({ open, title, onClose, children }: Props) {
  const [mounted, setMounted] = useState(open)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef<number | null>(null)

  // Stay mounted while the close animation plays.
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open || !mounted) return
    const t = setTimeout(() => {
      setMounted(false)
      setDrag(0)
    }, CLOSE_MS)
    return () => clearTimeout(t)
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  function onTouchStart(e: TouchEvent) {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  function onTouchMove(e: TouchEvent) {
    if (startY.current === null) return
    setDrag(Math.max(0, e.touches[0].clientY - startY.current))
  }
  function onTouchEnd() {
    startY.current = null
    setDragging(false)
    if (drag > 110) onClose()
    else setDrag(0)
  }

  return (
    <div className={`sheet-layer${open ? '' : ' sheet-closing'}`}>
      <div className="sheet-backdrop" onClick={onClose} style={drag ? { opacity: Math.max(0.2, 1 - drag / 400) } : undefined} />
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={drag ? { transform: `translateY(${drag}px)`, transition: dragging ? 'none' : undefined } : undefined}
      >
        <div className="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <span className="grabber" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="sheet-close" onClick={onClose} aria-label="Close">
              <Icon name="xmark" size={14} stroke={3} />
            </button>
          </div>
        </div>
        {children}
      </section>
    </div>
  )
}

// Centred frosted confirmation, like iOS's "Added to Library" HUD.
export function Hud({ text }: { text: string }) {
  return (
    <div className="hud" role="status">
      <svg className="hud-check" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
      </svg>
      <span>{text}</span>
    </div>
  )
}
