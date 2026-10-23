import { BOT_OFFER_MS } from '../../../shared/duel.js'
import { formatElapsed, playerName } from '../../lib/duel.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import PixelButton from '../pixel/PixelButton.jsx'
import PixelCard from '../pixel/PixelCard.jsx'
import { PlayerFace } from './Play.jsx'

// My open duel before anyone joins: the link and code to share (private), or the search (quick
// match). After BOT_OFFER_MS with nobody, the Glitch Bot is offered so nobody waits forever.
export function WaitingRoom({ duel, now, link, copied, onCopy, onBot, onCancel, busy }) {
  const t = useT()
  const waited = now - Date.parse(duel.createdAt)
  const friend = duel.kind === 'private'
  return (
    <div className="space-y-6">
      <PixelCard className="p-5 sm:p-6">
        <p className="font-label text-xs text-secondary">
          {t('duel.wait.elapsed', { time: formatElapsed(waited) })}
          <span className="motion-safe:animate-blink">_</span>
        </p>
        <h2 className="mt-2 font-pixel text-2xl font-bold text-ink sm:text-3xl">{friend ? t('duel.wait.friendTitle') : t('duel.wait.queueTitle')}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{friend ? t('duel.wait.friendHow') : t('duel.wait.queueHow')}</p>
        {friend && (
          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="block min-w-0">
              <span className="font-label text-xs text-ink">{t('duel.wait.link')}</span>
              <input
                readOnly
                value={link}
                onFocus={(event) => event.target.select()}
                className="mt-1 block w-full min-w-0 border-2 border-ink bg-mist px-3 py-2 font-mono text-xs text-ink"
              />
            </label>
            <PixelButton onClick={onCopy}>{copied ? t('duel.wait.copied') : t('duel.wait.copy')}</PixelButton>
            <p className="font-label text-xs text-muted sm:col-span-2">
              {t('duel.wait.code')}:{' '}
              <strong data-testid="duel-code" className="ml-1 border-2 border-ink bg-white px-2 py-1 font-mono text-base tracking-[0.3em] text-ink">
                {duel.code}
              </strong>
            </p>
          </div>
        )}
        <div className="mt-6">
          <PixelButton variant="ghost" onClick={onCancel} disabled={busy}>
            {t('duel.wait.cancel')}
          </PixelButton>
        </div>
      </PixelCard>

      {waited >= BOT_OFFER_MS && (
        <PixelCard tone="secondary" className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <PlayerFace player={{ bot: true }} className="size-10" />
            <div className="min-w-0">
              <h3 className="font-pixel text-xl font-bold text-ink">{t('duel.wait.botTitle')}</h3>
              <p className="mt-1 text-sm text-muted">{t('duel.wait.botHow')}</p>
            </div>
          </div>
          <PixelButton variant="secondary" onClick={onBot} disabled={busy}>
            {t('duel.lobby.bot')}
          </PixelButton>
        </PixelCard>
      )}
    </div>
  )
}

// Someone else's open duel: who's asking, and a button to take the empty seat.
export function Invitation({ duel, onJoin, busy }) {
  const t = useT()
  const host = duel.players[0]
  return (
    <PixelCard className="p-5 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerFace player={host} className="size-10" />
        <h2 className="min-w-0 font-pixel text-2xl font-bold text-ink">{t('duel.invite.title')}</h2>
      </div>
      <p className="mt-3 text-sm text-muted">{t('duel.invite.from', { name: playerName(t, host) })}</p>
      <p className="mt-2 text-sm text-ink">{t('duel.rules.tab')}</p>
      <div className="mt-5">
        <PixelButton onClick={onJoin} disabled={busy}>
          {t('duel.invite.join')}
        </PixelButton>
      </div>
    </PixelCard>
  )
}
