const YEAR = new Date().getFullYear()

// About block at the end of the list: who made it, what it is, required credit.
export function AppFooter() {
  return (
    <footer className="mt-2 flex flex-col gap-4 border-t border-hair pt-5 pb-3">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" width="40" height="40" className="rounded-[11px] shadow-[0_2px_8px_rgba(28,79,209,0.25)]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <strong className="font-display text-[17px] leading-tight font-bold tracking-[-0.01em] text-ink">ATM Status</strong>
          <span className="text-[13px] text-muted">Know before you go</span>
        </div>
        <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[11px] font-semibold text-muted">v{__APP_VERSION__}</span>
      </div>

      <p className="text-[13px] leading-[1.55] text-muted">
        Statuses are reported by people who used the ATM and may be out of date. Not affiliated with any bank. No
        account needed.
      </p>

      <p className="self-center rounded-full bg-ground px-4 py-2 text-[13px] font-semibold text-ink">Be kind to animals  🐾♥️</p>

      <p className="text-center text-xs leading-relaxed text-faint">
        © {YEAR} Vishal Soni
        <span aria-hidden="true" className="mx-1.5">·</span>
        Map data ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="text-faint underline decoration-chip underline-offset-2"
        >
          OpenStreetMap
        </a>
      </p>
    </footer>
  )
}
