import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { Icon } from './Icon'

const CLOSE_MS = 250

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// Modal bottom sheet: slides up over a dimmed screen; drag down, tap outside or Esc to close.
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
    <div className="absolute inset-0 z-[1000]">
      <div
        className={`absolute inset-0 bg-ink/40 ${open ? 'anim-fade-in' : 'anim-fade-out'}`}
        onClick={onClose}
        style={drag ? { opacity: Math.max(0.2, 1 - drag / 400) } : undefined}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`scroll-y absolute inset-x-0 bottom-0 max-h-[92%] rounded-t-[24px] bg-white px-5 pb-[calc(var(--safe-bottom)+20px)] shadow-[0_-6px_24px_rgba(21,24,27,0.10)] ${open ? 'anim-sheet-up' : 'anim-sheet-down'}`}
        style={drag ? { transform: `translateY(${drag}px)`, transition: dragging ? 'none' : 'transform .3s' } : undefined}
      >
        <div className="cursor-grab touch-none pt-2.5" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="mx-auto h-[5px] w-10 rounded-full bg-chip" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3 pt-4 pb-3">
            <h2 className="font-display text-2xl font-bold tracking-[-0.01em]">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-soft text-ink">
              <Icon name="xmark" size={20} />
            </button>
          </div>
        </div>
        {children}
      </section>
    </div>
  )
}

// Short confirmation at the bottom of the screen ("ATM added").
export function Toast({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="anim-toast absolute bottom-[calc(var(--safe-bottom)+24px)] left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-3 text-[15px] font-semibold text-white shadow-lg"
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-ok"><Icon name="check" size={13} stroke={3.2} /></span>
      {text}
    </div>
  )
}
