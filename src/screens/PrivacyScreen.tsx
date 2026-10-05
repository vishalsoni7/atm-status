import type { ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { PRIVACY_EMAIL, PRIVACY_UPDATED } from '../lib/about'
import { useBack } from '../lib/nav'

// Plain-language privacy notice. Keep it in step with what the app actually does.
export function PrivacyScreen() {
  const goBack = useBack()
  return (
    <div className="scroll-y absolute inset-0 bg-surface">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-surface/90 px-4 pt-[calc(var(--safe-top)+12px)] pb-3 backdrop-blur">
        <button
          type="button"
          onClick={() => goBack('/')}
          aria-label="Back"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-soft text-ink"
        >
          <Icon name="chevronLeft" size={22} />
        </button>
        <span className="text-sm font-semibold text-muted">ATM Status</span>
      </div>

      <article className="flex flex-col gap-6 px-5 pt-2 pb-[calc(var(--safe-bottom)+40px)] text-[15px] leading-[1.6] text-ink">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-[30px] leading-tight font-bold tracking-[-0.015em]">Privacy</h1>
          <p className="text-sm text-muted">Last updated {PRIVACY_UPDATED}</p>
        </header>

        <p>
          ATM Status shows whether ATMs near you are working, based on reports from people who used them. You don't
          need an account. This page explains what the app collects and why.
        </p>

        <Section title="What we collect">
          <Item label="Your reports">
            The ATM, whether it was working, the reason you picked (if any) and the time. Each report is linked to a
            random ID stored on your phone, not to your name or number. We use it to stop repeated or fake reports.
          </Item>
          <Item label="Your location">
            Used on your phone to find ATMs near you and to check you're at an ATM before you report. To find nearby
            ATMs, your current position is sent to our database for that one lookup. We don't keep a history of
            where you've been. If you add a missing ATM, the spot where you added it is saved as that ATM's location.
          </Item>
          <Item label="Your internet address">
            Stored only as a scrambled one-way code, to limit spam. It can't be turned back into your address.
          </Item>
          <Item label="Email or mobile number (optional)">
            Only if you choose to share it. We may use it to contact you about ATM Status. Never shown to others.
          </Item>
        </Section>

        <Section title="What we don't do">
          <p>No ads. We don't sell your data, and we don't track you across other apps or websites.</p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Reports are kept so the app can show an ATM's recent history. Contact details are kept until you ask us
            to delete them.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            <li>Turn off location for this app in your phone or browser settings. You can still search an area.</li>
            <li>Clearing this site's data on your phone resets your random ID.</li>
            <li>
              To see, correct or delete your contact details or reports, email us. We reply within 30 days.
            </li>
          </ul>
        </Section>

        <Section title="Contact">
          <p>
            Questions or requests:{' '}
            <a href={`mailto:${PRIVACY_EMAIL}`} className="font-semibold underline underline-offset-2">
              {PRIVACY_EMAIL}
            </a>
          </p>
          <p className="text-sm text-muted">If this page changes, we'll update the date at the top.</p>
        </Section>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] bg-ground p-4">
      <h3 className="font-semibold">{label}</h3>
      <p className="mt-1 text-muted">{children}</p>
    </div>
  )
}
