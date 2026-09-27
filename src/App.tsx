import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigationType, type Location } from 'react-router-dom'
import { Detail } from './screens/Detail'
import { Nearby } from './screens/Nearby'

const TRANSITION_MS = 480

export default function App() {
  return (
    <BrowserRouter>
      <Stack />
    </BrowserRouter>
  )
}

function Pages({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<Nearby />} />
      {/* The report sheet opens over the detail page, so both share one screen. */}
      <Route path="/atm/:id/report?" element={<Detail />} />
      <Route path="*" element={<Nearby />} />
    </Routes>
  )
}

type Dir = 'none' | 'push' | 'pop'
interface Entry { key: string; location: Location; dir: Dir }

// iOS navigation stack: new screens slide in from the right, going back slides
// them away. The outgoing screen stays rendered until the animation ends.
function Stack() {
  const location = useLocation()
  const navType = useNavigationType()
  const key = screenKey(location.pathname)
  const [current, setCurrent] = useState<Entry>({ key, location, dir: 'none' })
  const [leaving, setLeaving] = useState<Entry | null>(null)

  if (key !== current.key) {
    const forcedPop = (location.state as { direction?: string } | null)?.direction === 'pop'
    const dir: Dir = navType === 'POP' || forcedPop ? 'pop' : 'push'
    setLeaving({ ...current, dir })
    setCurrent({ key, location, dir })
  } else if (location !== current.location) {
    setCurrent({ ...current, location })
  }

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setLeaving(null), TRANSITION_MS)
    return () => clearTimeout(t)
  }, [leaving])

  const pages: [Entry, string][] = [[current, `page-in-${current.dir}`]]
  if (leaving) pages.unshift([leaving, `page-out-${leaving.dir}`])
  return (
    <>
      {pages.map(([entry, cls]) => (
        <Page key={entry.key} className={cls} inert={entry === leaving}>
          <Pages location={entry.location} />
        </Page>
      ))}
    </>
  )
}

function Page({ className, inert, children }: { className: string; inert: boolean; children: ReactNode }) {
  return (
    <div className={`page ${className}`} inert={inert}>
      {children}
    </div>
  )
}

function screenKey(pathname: string) {
  return pathname.replace(/\/report\/?$/, '')
}
