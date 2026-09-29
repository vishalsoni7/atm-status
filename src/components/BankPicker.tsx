import { useState } from 'react'
import { BANK_CHOICES } from '../lib/banks'
import { Icon } from './Icon'
import { BankBadge } from './Status'

// Searchable bank list, with "Other" for anything not listed.
export function BankPicker({ value, onChange }: { value: string; onChange: (bank: string) => void }) {
  const [query, setQuery] = useState('')
  const [other, setOther] = useState(() => (value && !BANK_CHOICES.includes(value) ? value : ''))
  const q = query.trim().toLowerCase()
  const matches = q ? BANK_CHOICES.filter((b) => b.toLowerCase().includes(q)) : BANK_CHOICES
  const otherSelected = value !== '' && value === other.trim()

  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex h-11 items-center gap-2 rounded-[14px] border-[1.5px] border-chip px-3 text-muted focus-within:border-primary">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Search bank"
          aria-label="Search bank"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint"
        />
      </label>
      <div role="radiogroup" aria-label="Bank" className="flex flex-col">
        {matches.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={value === b}
            onClick={() => onChange(b)}
            className="flex min-h-12 items-center gap-3 border-t border-hair text-left active:bg-soft"
          >
            <BankBadge bank={b} size={28} />
            <span className="flex-1 text-[15px] font-semibold">{b}</span>
            {value === b && <span className="text-primary"><Icon name="check" size={20} stroke={2.6} /></span>}
          </button>
        ))}
        <div className="flex min-h-12 items-center gap-3 border-t border-hair">
          <span className="w-7 shrink-0 text-xs font-semibold text-muted">Other</span>
          <input
            type="text"
            placeholder="Type the bank's name"
            aria-label="Other bank"
            value={other}
            maxLength={80}
            onChange={(e) => {
              setOther(e.target.value)
              onChange(e.target.value.trim())
            }}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          {otherSelected && <span className="text-primary"><Icon name="check" size={20} stroke={2.6} /></span>}
        </div>
      </div>
    </div>
  )
}
