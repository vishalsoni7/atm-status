import { useState } from 'react'
import { BANK_CHOICES } from '../lib/banks'
import { Icon } from './Icon'
import { BankBadge } from './Status'

// iOS-style searchable list of banks, with "Other" for anything not listed.
export function BankPicker({ value, onChange }: { value: string; onChange: (bank: string) => void }) {
  const [query, setQuery] = useState('')
  const [other, setOther] = useState(() => (value && !BANK_CHOICES.includes(value) ? value : ''))
  const q = query.trim().toLowerCase()
  const matches = q ? BANK_CHOICES.filter((b) => b.toLowerCase().includes(q)) : BANK_CHOICES
  const otherSelected = value !== '' && value === other.trim()

  return (
    <div className="bank-picker">
      <label className="search-field">
        <Icon name="search" size={16} stroke={2.2} />
        <input
          type="search"
          placeholder="Search bank"
          aria-label="Search bank"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoCorrect="off"
        />
      </label>
      <div className="group bank-list" role="radiogroup" aria-label="Bank">
        {matches.map((b) => (
          <button
            key={b}
            type="button"
            role="radio"
            aria-checked={value === b}
            className="cell cell-bank"
            onClick={() => onChange(b)}
          >
            <BankBadge bank={b} size={28} />
            <span className="cell-title">{b}</span>
            {value === b && <span className="bank-check"><Icon name="check" size={18} stroke={2.6} /></span>}
          </button>
        ))}
        <div className="cell cell-bank cell-other">
          <span className="bank-other-label">Other</span>
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
          />
          {otherSelected && <span className="bank-check"><Icon name="check" size={18} stroke={2.6} /></span>}
        </div>
      </div>
    </div>
  )
}
