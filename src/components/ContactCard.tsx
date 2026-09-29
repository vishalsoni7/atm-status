import { useState, type FormEvent } from 'react'
import { InvalidContactError, saveContact, type ContactSource } from '../lib/api'
import { markContactSaved, useContactSaved } from '../lib/contact'
import { Icon, Spinner } from './Icon'

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

  return (
    <section className="flex flex-col gap-3 rounded-[18px] bg-ground p-4" aria-labelledby={`contact-${source}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-primary">
          <Icon name="mail" size={18} />
        </span>
        <div>
          <h3 id={`contact-${source}`} className="text-base font-bold">Stay in touch</h3>
          <p className="text-sm text-muted">Leave your email or mobile number. This is optional.</p>
        </div>
      </div>
      <form className="flex gap-2" onSubmit={submit} noValidate>
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
          className="h-12 min-w-0 flex-1 rounded-[14px] border-[1.5px] border-chip bg-white px-3.5 text-base outline-none placeholder:text-faint focus:border-primary"
        />
        <button type="submit" disabled={sending} className="flex h-12 min-w-[76px] items-center justify-center rounded-[14px] bg-primary px-4 font-bold text-white disabled:opacity-60">
          {sending ? <Spinner size={18} /> : 'Save'}
        </button>
      </form>
      {error && <p className="text-[13px] text-down-ink">{error}</p>}
      <p className="text-xs text-muted">We may contact you about ATM Status.</p>
    </section>
  )
}
