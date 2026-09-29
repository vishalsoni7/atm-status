import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { fetchAtm } from '../lib/api'
import { atmName } from '../lib/banks'
import { useBack } from '../lib/nav'
import type { Atm } from '../lib/types'

export function ThanksScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const goBack = useBack()
  const [atm, setAtm] = useState<Atm | null>(null)

  useEffect(() => {
    fetchAtm(id).then(setAtm, () => setAtm(null))
  }, [id])

  const place = atm?.landmark || atm?.address
  const who = atm ? `${atmName(atm.bank)}${place ? ` on ${place}` : ''}` : 'This ATM'

  return (
    <div className="absolute inset-0 flex flex-col bg-white px-5 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+32px)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="flex size-28 items-center justify-center rounded-full bg-ok-soft" aria-hidden="true">
          <span className="flex size-[76px] items-center justify-center rounded-full bg-ok text-white">
            <Icon name="check" size={38} stroke={3} />
          </span>
        </span>
        <h1 className="font-display text-[32px] font-bold tracking-[-0.015em]">Thanks for reporting</h1>
        <p className="max-w-[300px] text-base leading-normal text-muted text-pretty">
          {who} now shows your update to everyone nearby.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/?filter=ok', { replace: true })}
          className="h-14 rounded-2xl bg-primary text-[17px] font-bold text-white active:bg-primary-dark"
        >
          Find a working ATM
        </button>
        <button type="button" onClick={() => goBack(`/atm/${id}`)} className="h-12 text-base font-bold text-primary">
          View this ATM
        </button>
      </div>
    </div>
  )
}
