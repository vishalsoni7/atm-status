import { useNavigate } from 'react-router-dom'

// Go back through app history when there is some; otherwise jump to `fallback`
// (e.g. the page was opened from a shared link).
export function useBack() {
  const navigate = useNavigate()
  return (fallback: string) => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
