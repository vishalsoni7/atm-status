const YEAR = new Date().getFullYear()

// About block at the end of the list: credit, required attribution, disclaimer.
export function AppFooter() {
  return (
    <footer className="flex flex-col gap-2 border-t border-hair pt-4 pb-2 text-xs leading-4 text-muted">
      <div className="flex items-center gap-2.5">
        <img src="/favicon.svg" alt="" width="32" height="32" className="rounded-lg" />
        <p className="flex flex-col">
          <strong className="text-[15px] font-bold text-ink">ATM Status</strong>
          <span>Version {__APP_VERSION__}</span>
        </p>
      </div>
      <p>Statuses are reported by people who used the ATM and may be out of date. Not affiliated with any bank. No account needed.</p>
      <p className="whitespace-nowrap text-center text-[clamp(10px,3.2vw,12px)]">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
        {' · '}© {YEAR} Vishal Soni
      </p>
    </footer>
  )
}
