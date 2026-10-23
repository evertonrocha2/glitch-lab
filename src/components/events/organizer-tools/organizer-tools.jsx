import { useState } from 'react'
import { Link } from 'react-router'
import { canPickWinners, WINNERS_EDIT_MS, winnersLocked } from '../../../../shared/events.js'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../../lib/i18n/format.js'
import PixelButton from '../../ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { WHEN } from '../event-bits/event-bits.jsx'
import Medal from '../medal/medal.jsx'

const PLACES = [1, 2, 3]

function CloseEarly({ onClose }) {
  const t = useT()
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <PixelButton variant="ghost" onClick={() => setAsking(true)} className="w-full">
        {t('events.tools.close')}
      </PixelButton>
    )
  }
  return (
    <div className="border-2 border-dashed border-ink/40 p-3">
      <p className="text-sm text-ink">{t('events.tools.closeAsk')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <PixelButton onClick={onClose} className="px-3 py-2">
          {t('events.tools.closeYes')}
        </PixelButton>
        <PixelButton variant="ghost" onClick={() => setAsking(false)} className="px-3 py-2">
          {t('events.entry.cancel')}
        </PixelButton>
      </div>
    </div>
  )
}

// Pick 1st, 2nd and 3rd from the entries (by votes first, as a suggestion), then announce.
// announcedAt: when the winners were first announced; the pick can change for a while after.
function WinnerPicker({ entries, announcedAt, onPick }) {
  const t = useT()
  const { date } = useFormat()
  const [picked, setPicked] = useState(() => {
    const placed = PLACES.map((place) => entries.find((item) => item.place === place)?.id ?? '')
    return placed.some(Boolean) ? placed : PLACES.map((_, index) => entries[index]?.id ?? '')
  })
  const [busy, setBusy] = useState(false)
  if (!entries.length) return <p className="text-sm text-muted">{t('events.tools.noEntries')}</p>

  const chosen = picked.filter(Boolean)
  // First place first, no gaps (2nd without 1st) and nobody twice.
  const valid = chosen.length > 0 && new Set(chosen).size === chosen.length && picked.slice(0, chosen.length).every(Boolean)

  async function announce() {
    setBusy(true)
    await onPick(chosen)
    setBusy(false)
  }

  return (
    <div>
      <p className="font-label text-xs text-ink">{t('events.tools.winners')}</p>
      <p className="mt-1 text-xs text-muted">{t('events.tools.winnersHint')}</p>
      {PLACES.map((place, index) => (
        <div key={place} className="mt-3 flex items-center gap-2">
          <Medal place={place} className="size-7" label={false} />
          <label htmlFor={`winner-${place}`} className="sr-only">
            {t(`events.place.${place}`)}
          </label>
          <select
            id={`winner-${place}`}
            value={picked[index]}
            onChange={(event) => setPicked((current) => current.map((value, at) => (at === index ? event.target.value : value)))}
            className="w-full min-w-0 flex-1 truncate border-2 border-ink bg-white px-2 py-1.5 text-sm text-ink"
          >
            <option value="">{t('events.tools.nobody')}</option>
            {entries.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.author.name}, {t('events.entry.votes', { count: item.votes })})
              </option>
            ))}
          </select>
        </div>
      ))}
      <PixelButton onClick={announce} disabled={!valid || busy} className="mt-4 w-full">
        {t('events.tools.announce')}
      </PixelButton>
      {announcedAt && (
        <p className="mt-2 text-xs text-secondary">{t('events.tools.announced', { date: date(new Date(Date.parse(announcedAt) + WINNERS_EDIT_MS).toISOString(), WHEN) })}</p>
      )}
    </div>
  )
}

// Only the organizer sees this: edit before the start, close early while live, winners after the end
// (until the pick is final).
export default function OrganizerTools({ event, status, now = Date.now(), entries, onClose, onPick }) {
  const t = useT()
  return (
    <PixelCard tone="secondary" as="section" aria-label={t('events.tools.title')} className="p-5">
      <h2 className="font-label text-xs text-secondary">{t('events.tools.title')}</h2>
      <div className="mt-3 space-y-3">
        {status === 'upcoming' && (
          <>
            <PixelButton as={Link} to={`/events/${event.id}/edit`} variant="secondary" className="w-full">
              {t('events.tools.edit')}
            </PixelButton>
            <p className="text-xs text-muted">{t('events.tools.editHint')}</p>
          </>
        )}
        {status === 'live' && (
          <>
            <CloseEarly onClose={onClose} />
            <p className="text-xs text-muted">{t('events.tools.waitEnd')}</p>
          </>
        )}
        {canPickWinners(status) &&
          (winnersLocked(event, now) ? (
            <p className="text-sm text-muted">{t('events.tools.final')}</p>
          ) : (
            <WinnerPicker key={entries.map((item) => `${item.id}:${item.place}`).join()} entries={entries} announcedAt={event.announcedAt} onPick={onPick} />
          ))}
      </div>
    </PixelCard>
  )
}
