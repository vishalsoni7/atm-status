import { useState, type FormEvent } from 'react'
import { InvalidContactError, saveContact, type ContactSource } from '../lib/api'
import { markContactSaved, useContactSaved } from '../lib/contact'
import { Icon, Spinner } from './Icon'

const COPY: Record<ContactSource, { title: string; text: string }> = {
  home: {
    title: 'Stay in touch',
    text: 'Leave your email or mobile number. This is optional.',
  },
  after_report: {
    title: 'Thanks for reporting',
    text: "Leave your email or mobile number if you'd like. This is optional.",
  },
}

// Optional: asks for an email or mobile number until it's saved, then hides.
export function ContactCard({ source }: { source: ContactSource }) {
  const saved = useContactSaved()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (saved) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return setError('Enter your email or 10-digit mobile number.')
    setSending(true)
    setError(null)
    try {
      await saveContact(value, source)
      markContactSaved()
    } catch (err) {
      console.error('save_contact failed', err)
      setError(
        err instanceof InvalidContactError
          ? "That doesn't look like an email or a 10-digit mobile number. Check it and try again."
          : "Couldn't save. Check your internet connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  const { title, text } = COPY[source]
  return (
    <section className="contact-card" aria-labelledby={`contact-${source}`}>
      <div className="contact-head">
        <span className="contact-icon"><Icon name="mail" size={18} stroke={2.2} /></span>
        <div>
          <h3 id={`contact-${source}`}>{title}</h3>
          <p>{text}</p>
        </div>
      </div>
      <form className="contact-form" onSubmit={submit} noValidate>
        <input
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Email or mobile number"
          aria-label="Email or mobile number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={sending}
        />
        <button type="submit" disabled={sending}>
          {sending ? <Spinner size={18} /> : 'Save'}
        </button>
      </form>
      {error && <p className="contact-error">{error}</p>}
      <p className="contact-note">We may contact you about ATM Status.</p>
    </section>
  )
}
