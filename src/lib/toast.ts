import { useEffect, useState } from 'react'

// Shows a toast for 1.8 s.
export function useToast(): [string | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setText(null), 1800)
    return () => clearTimeout(t)
  }, [text])
  return [text, setText]
}
