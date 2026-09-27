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

// Let the launch animation finish its ping before revealing the app.
const MIN_SPLASH_MS = matchMedia('(prefers-reduced-motion: reduce)').matches ? 400 : 1500
const splash = document.getElementById('splash')
if (splash) {
  setTimeout(() => {
    splash.classList.add('out')
    document.getElementById('root')?.classList.add('revealed')
    splash.addEventListener('animationend', (e) => {
      if (e.target === splash) splash.remove()
    })
  }, Math.max(0, MIN_SPLASH_MS - performance.now()))
}
