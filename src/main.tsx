import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS Safari only applies :active styles when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Short launch animation (fades out by ~0.9 s). The app renders underneath
// from the start, so the map is never waiting on it.
const SPLASH_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 650
const splash = document.getElementById('splash')
if (splash) {
  setTimeout(() => {
    splash.classList.add('out')
    splash.addEventListener('animationend', (e) => {
      if (e.target === splash) splash.remove()
    })
  }, Math.max(0, SPLASH_MS - performance.now()))
}
