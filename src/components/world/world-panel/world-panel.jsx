import { useId } from 'react'
import { nextGoal } from '../../../../shared/world/unlocks.js'
import { HUB_ID } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import GameIcon from '../../game/icons/game-icon.jsx'
import Bar from '../../game/ui/bar.jsx'
import Frame, { Chip, SectionTitle } from '../../game/ui/frame.jsx'
import { isEnemWorld, showsEnem } from '../enem-worlds.js'
import { leftText, progressText } from '../requirement-text.js'

// Beside the map, in the game kit: the lock closest to opening (with how far along it is), then every
// world with what it still asks for. state is GET /api/world; currentWorld is where the hero stands.
// Outside pt-BR the ENEM worlds are left out, from the list and from the next goal.
export default function WorldPanel({ state: all, currentWorld }) {
  const { t, locale } = useI18n()
  const goalId = useId()
  const listId = useId()
  const state = showsEnem(locale) ? all : { ...all, worlds: all.worlds.filter((world) => !isEnemWorld(world.id)) }
  const goal = nextGoal(state)
  const nameOf = (id) => t(`world.name.${id}`)
  const target = goal && (goal.zoneId ? t('world.zone', { world: nameOf(goal.worldId), n: goal.zoneId.slice(1) }) : nameOf(goal.worldId))

  return (
    <div className="flex min-w-0 flex-col gap-3 p-1 lg:p-2">
      {goal && (
        <section aria-labelledby={goalId} className="flex flex-col gap-2">
          <SectionTitle id={goalId}>{t('world.panel.goal')}</SectionTitle>
          <Frame tone="gold" className="flex flex-col gap-2 p-2.5">
            <p className="m-0 flex items-start gap-2 font-pixel text-[11px] leading-relaxed text-[#ffd76a]">
              <GameIcon name="key" size={1} className="mt-0.5" />
              <span>{t('world.goal', { target, left: leftText(t, goal) })}</span>
            </p>
            <Bar value={goal.have} max={goal.need} label={target} text={progressText(t, goal)} color="#6a3df0" className="h-5" />
          </Frame>
        </section>
      )}
      <SectionTitle id={listId}>{t('world.panel.title')}</SectionTitle>
      <ul aria-labelledby={listId} className="m-0 flex list-none flex-col gap-1 p-0">
        {state.worlds
          .filter((world) => world.id !== HUB_ID)
          .map((world) => {
            const here = world.id === currentWorld
            return (
              <Frame
                as="li"
                tone={here ? 'raised' : 'inset'}
                key={world.id}
                aria-current={here ? 'location' : undefined}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-2 text-xs"
              >
                <span className={`min-w-0 font-pixel text-[11px] ${here ? 'text-[#f2c14e]' : world.unlocked ? 'text-[#e9e4ff]' : 'text-[#a89fd0]'}`}>{nameOf(world.id)}</span>
                {world.unlocked ? (
                  <Chip tone="ok" className="shrink-0">
                    {t('world.status.open')}
                  </Chip>
                ) : (
                  <span className="ml-auto flex items-center gap-1.5 text-right font-mono text-[11px] text-[#a89fd0]">
                    <GameIcon name="key" size={1} />
                    {progressText(t, world)}
                  </span>
                )}
              </Frame>
            )
          })}
      </ul>
    </div>
  )
}
