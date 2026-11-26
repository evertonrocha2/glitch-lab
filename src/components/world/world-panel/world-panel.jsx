import { useId } from 'react'
import { nextGoal } from '../../../../shared/world/unlocks.js'
import { HUB_ID } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import PixelCard from '../../ui/pixel-card/pixel-card.jsx'
import { isEnemWorld, showsEnem } from '../enem-worlds.js'
import { LOCK, LOCK_COLORS } from '../hero-sprite.js'
import { leftText, progressText } from '../requirement-text.js'

function LockIcon() {
  return (
    <svg viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" className="size-3.5 shrink-0">
      {LOCK.flatMap((line, y) => [...line].map((pixel, x) => (pixel === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={LOCK_COLORS[pixel]} />)))}
    </svg>
  )
}

// Beside the map: the lock closest to opening, then every world with what it still asks for.
// state is GET /api/world; currentWorld is where the hero stands.
// Outside pt-BR the ENEM worlds are left out, from the list and from the next goal.
export default function WorldPanel({ state: all, currentWorld }) {
  const { t, locale } = useI18n()
  const listId = useId()
  const state = showsEnem(locale) ? all : { ...all, worlds: all.worlds.filter((world) => !isEnemWorld(world.id)) }
  const goal = nextGoal(state)
  const nameOf = (id) => t(`world.name.${id}`)
  const target = goal && (goal.zoneId ? t('world.zone', { world: nameOf(goal.worldId), n: goal.zoneId.slice(1) }) : nameOf(goal.worldId))

  return (
    <PixelCard tone="secondary" className="p-5">
      {goal && (
        <section className="mb-6">
          <h2 className="font-label text-xs text-secondary">{t('world.panel.goal')}</h2>
          <p className="mt-2 font-medium text-ink">{t('world.goal', { target, left: leftText(t, goal) })}</p>
        </section>
      )}
      <h2 id={listId} className="font-label text-xs text-secondary">
        {t('world.panel.title')}
      </h2>
      <ul aria-labelledby={listId} className="mt-3 space-y-3">
        {state.worlds
          .filter((world) => world.id !== HUB_ID)
          .map((world) => (
            <li key={world.id} aria-current={world.id === currentWorld ? 'location' : undefined} className="flex items-start justify-between gap-3 text-sm">
              <span className={world.id === currentWorld ? 'font-bold text-ink' : 'text-ink'}>{nameOf(world.id)}</span>
              <span className="flex items-center gap-1.5 text-right text-muted">
                {!world.unlocked && <LockIcon />}
                {world.unlocked ? t('world.status.open') : progressText(t, world)}
              </span>
            </li>
          ))}
      </ul>
    </PixelCard>
  )
}
