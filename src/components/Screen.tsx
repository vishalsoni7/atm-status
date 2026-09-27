import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { useBack } from '../lib/nav'
import { Icon, Spinner } from './Icon'

const PULL_TRIGGER = 70

interface Props {
  title: string
  // Big bold title in the content that shrinks into the bar on scroll (iOS "large title").
  largeTitle?: boolean
  back?: { label: string; to: string }
  // Scroll distance after which the small title fades into the bar.
  revealAt?: number
  onRefresh?: () => Promise<unknown>
  // Sheets and pop-ups: pinned to the screen, not scrolled with the content.
  overlay?: ReactNode
  children: ReactNode
}

export function Screen({ title, largeTitle, back, revealAt = 44, onRefresh, overlay, children }: Props) {
  const goBack = useBack()
  const [scrolled, setScrolled] = useState(false)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const startY = useRef<number | null>(null)

  function onTouchStart(e: TouchEvent) {
    if (!onRefresh || refreshing || (scroller.current?.scrollTop ?? 0) > 0) return
    startY.current = e.touches[0].clientY
    setDragging(true)
  }
  function onTouchMove(e: TouchEvent) {
    if (startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    // Rubber-band: the further you pull, the less it moves.
    setPull(dy > 0 ? Math.min(120, dy * 0.45) : 0)
  }
  async function onTouchEnd() {
    if (startY.current === null) return
    startY.current = null
    setDragging(false)
    if (pull < PULL_TRIGGER * 0.8 || !onRefresh) return setPull(0)
    setRefreshing(true)
    setPull(56)
    navigator.vibrate?.(8)
    try {
      await Promise.all([onRefresh(), new Promise((r) => setTimeout(r, 600))])
    } finally {
      setRefreshing(false)
      setPull(0)
    }
  }

  return (
    <div className="screen">
      <header className={`nav${scrolled ? ' nav-scrolled' : ''}`}>
        <div className="nav-side">
          {back && (
            <button className="nav-back" onClick={() => goBack(back.to)}>
              <Icon name="chevronLeft" size={26} stroke={2.4} />
              <span>{back.label}</span>
            </button>
          )}
        </div>
        <h2 className="nav-title" aria-hidden={!scrolled}>{title}</h2>
        <div className="nav-side" />
      </header>

      <div
        ref={scroller}
        className={`scroll${largeTitle ? ' scroll-large' : ''}`}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > revealAt)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {onRefresh && (
          <div className={`ptr${refreshing ? ' ptr-active' : ''}`} style={{ opacity: refreshing ? 1 : Math.min(1, pull / PULL_TRIGGER) }}>
            <span style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }}>
              <Spinner size={24} />
            </span>
          </div>
        )}
        <div
          className={`content${dragging ? '' : ' content-settle'}`}
          style={pull ? { transform: `translateY(${pull}px)` } : undefined}
        >
          {largeTitle && <h1 className="large-title">{title}</h1>}
          {children}
        </div>
      </div>
      {overlay}
    </div>
  )
}
