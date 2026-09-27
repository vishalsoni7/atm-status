// Small SF Symbols-style line icons, drawn on a 24px grid.
const PATHS = {
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  xmark: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  banknote: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM6 10v4M18 10v4',
  directions: 'M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM9 14.5v-2.5a1.5 1.5 0 0 1 1.5-1.5H15M13 8.5l2 2-2 2',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  mail: 'M3.5 6h17v12h-17zM4 6.5l8 6.5 8-6.5',
  location: 'M20 4L3.5 11.2l7.3 1.9 1.9 7.3z',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  question: 'M9.2 9a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1.1-1.3 2v.4M12 17.2v.3',
  wifiOff: 'M3 3l18 18M8.5 16.2a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 5-2.5M19 12.6a10 10 0 0 0-2.3-1.7M2 9a15 15 0 0 1 4.6-2.9M22 9a15 15 0 0 0-9-3.9M12 20h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, stroke = 2 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

// iOS activity indicator: eight spokes, stepping round.
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" aria-label="Loading" role="img">
      {Array.from({ length: 8 }, (_, i) => (
        <line
          key={i}
          x1="12" y1="3" x2="12" y2="7.5"
          stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
          opacity={0.25 + (i / 7) * 0.75}
          transform={`rotate(${i * 45} 12 12)`}
        />
      ))}
    </svg>
  )
}
