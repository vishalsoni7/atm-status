const YEAR = new Date().getFullYear()

// About block at the end of the home screen: credit, required attribution, disclaimer.
export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-head">
        <img src="/favicon.svg" alt="" width="32" height="32" />
        <p>
          <strong>ATM Status</strong>
          <span>Version {__APP_VERSION__} · Pilot in Bhilwara</span>
        </p>
      </div>
      <p>
        Statuses are reported by people who used the ATM and may be out of date. Not affiliated with any bank.
        No account needed.
      </p>
      <p>
        ATM locations ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
        {' · '}
        <span className="nowrap">© {YEAR} Vishal Soni</span>
      </p>
    </footer>
  )
}
