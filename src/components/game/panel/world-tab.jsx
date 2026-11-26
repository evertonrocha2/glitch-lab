import { useId, useState } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { HUNT_WORLDS, ZONES } from '../../../../shared/game/zones.js'
import { HUB_ID, WORLDS } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { isEnemWorld, showsEnem } from '../../world/enem-worlds.js'
import GameIcon from '../icons/game-icon.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { ActionButton } from './panel-ui.jsx'

const ORDER = Object.keys(DIFFICULTIES)

// The zone's suggested power on a difficulty: enemies scale by its mult, so the power does too.
export const suggestedPower = (zone, difficulty) => Math.round(zone.suggestedPower * DIFFICULTIES[difficulty].mult)

// How dangerous a zone is for the hero: at the suggested power it beats the boss, under 70% of it it
// does not (shared/game/zones.js), so those are the steps. Advice only: every zone is open.
export function dangerOf(power, suggested) {
  if (power >= suggested) return 'safe'
  return power >= suggested * 0.7 ? 'risky' : 'deadly'
}
const DANGER_TONE = { safe: 'ok', risky: 'gold', deadly: 'danger' }

// The Mundo tab: the world map list, the Forest's zones on a difficulty, and per zone "Caçar aqui"
// and "Enfrentar chefe". Every zone and difficulty is open from the start: each zone says how
// dangerous it is for the hero, and a harder difficulty shows a strong warning. actions.startHunt / fightBoss / stopHunt take { world, zone, difficulty } and
// resolve to the new View (the page applies it, and plays the boss fight back). replaying: a boss
// fight is on screen, so nothing else starts. onLeave: back to the Lab, after the hunt stops.
export default function WorldTab({ view, actions, runner, replaying = false, onLeave }) {
  const { t, locale } = useI18n()
  const fmt = new Intl.NumberFormat(locale)
  const mapsId = useId()
  const world = view.hero.hunt?.world ?? HUNT_WORLDS[0]
  const [difficulty, setDifficulty] = useState(view.hero.hunt?.difficulty ?? 'normal')
  const level = view.level.level
  const list = view.zones?.[world]?.[difficulty] ?? []
  const hunt = view.hero.hunt
  const zoneName = (id) => t(`game.zone.${ZONES[world][id].name}`)
  const busy = runner.busy
  const heroPower = view.power ?? 0
  const diff = DIFFICULTIES[difficulty]

  const worlds = WORLDS.filter((each) => each.id !== HUB_ID && (showsEnem(locale) || !isEnemWorld(each.id)))

  const start = (zone) => runner.run(() => actions.startHunt({ world, zone, difficulty }), () => t('game.world.started', { zone: zoneName(zone) }))
  const fight = (zone) => runner.run(() => actions.fightBoss({ world, zone, difficulty }))
  const stop = () => runner.run(() => actions.stopHunt(), () => t('game.world.stopped'))
  const leave = async () => {
    if (hunt) {
      const done = await runner.run(() => actions.stopHunt())
      if (!done) return
    }
    onLeave?.()
  }

  return (
    <>
      <SectionTitle id={mapsId}>{t('game.world.maps')}</SectionTitle>
      <ul aria-labelledby={mapsId} className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
        {worlds.map((each) => {
          const here = each.id === world
          const note = here ? t('game.world.here') : HUNT_WORLDS.includes(each.id) ? '' : t('game.world.soon')
          return (
            <Frame
              as="li"
              key={each.id}
              tone={here ? 'gold' : 'inset'}
              aria-current={here ? 'location' : undefined}
              className="flex min-h-12 flex-col items-start justify-center gap-1 px-2.5 py-2"
            >
              <span className={`font-pixel text-[10px] leading-tight ${here ? 'text-[#f2c14e]' : 'text-[#a89fd0]'}`}>{t(`world.name.${each.id}`)}</span>
              {note && <Chip tone={here ? 'gold' : 'muted'}>{note}</Chip>}
            </Frame>
          )
        })}
      </ul>

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 w-full p-0">
          <SectionTitle>{t('game.world.difficulty')}</SectionTitle>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((id) => (
            <ActionButton key={id} pressed={id === difficulty} onClick={() => setDifficulty(id)} tone={id === difficulty ? 'gold' : 'default'}>
              {t(`game.diff.${id}`)}
            </ActionButton>
          ))}
        </div>
        <div aria-live="polite">
          {difficulty !== 'normal' && (
            <Frame tone="inset" className="mt-1 flex items-start gap-2 px-2.5 py-2 text-[11px] leading-relaxed text-[#ff9aa6]">
              <GameIcon name="skull" size={1} className="mt-0.5 shrink-0" />
              <p className="m-0">
                {t('gameOpen.diff.warn', { difficulty: t(`game.diff.${difficulty}`), mult: fmt.format(diff.mult), level: diff.minLevel })}
                {level < diff.minLevel && <strong className="block font-bold text-[#ffd3d9]">{t('gameOpen.diff.below', { level })}</strong>}
              </p>
            </Frame>
          )}
        </div>
      </fieldset>

      <SectionTitle>{t('game.world.zones')}</SectionTitle>
      {list.map((state, at) => {
        const def = ZONES[world][state.id]
        const here = hunt?.world === world && hunt.zone === state.id && hunt.difficulty === difficulty
        const why = replaying ? t('game.why.fighting') : null
        const suggested = suggestedPower(def, difficulty)
        const danger = dangerOf(heroPower, suggested)
        return (
          <ZoneCard
            key={state.id}
            title={t('game.world.zoneTitle', { n: at + 1, name: zoneName(state.id) })}
            tag={
              <Chip tone={DANGER_TONE[danger]} title={t('gameOpen.danger.label', { danger: t(`gameOpen.danger.${danger}`) })} className="shrink-0">
                {t(`gameOpen.danger.${danger}`)}
              </Chip>
            }
          >
            <p className="m-0 text-[11px] text-[#a89fd0]">{t('gameOpen.zone.level', { level: Math.max(state.minLevel, diff.minLevel) })}</p>
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px]">
              <GameIcon name="skull" size={1} />
              {t('game.world.boss', { boss: t(`game.boss.${def.boss}`) })}
              {state.beaten && <Chip tone="ok">{t('game.world.beaten')}</Chip>}
            </p>
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px] text-[#a89fd0]">
              {t('game.world.power', { power: fmt.format(suggested) })}
              {here && <Chip tone="gold">{t('game.world.hunting')}</Chip>}
            </p>
            {heroPower < suggested && <p className="m-0 text-[11px] text-[#ff9aa6]">{t('gameOpen.under', { power: fmt.format(heroPower) })}</p>}
            <div className="flex flex-wrap items-start gap-1.5">
              {here ? (
                <ActionButton busy={busy} onClick={stop}>
                  {t('game.world.stop')}
                </ActionButton>
              ) : (
                <ActionButton busy={busy} why={why} onClick={() => start(state.id)}>
                  {t('game.world.hunt')}
                </ActionButton>
              )}
              <ActionButton tone="danger" busy={busy} why={why} onClick={() => fight(state.id)}>
                {t('game.world.fight')}
              </ActionButton>
            </div>
          </ZoneCard>
        )
      })}

      <span>
        <ActionButton busy={busy} onClick={leave}>
          {t('game.world.leave')}
        </ActionButton>
      </span>
    </>
  )
}

// A zone: a raised box with its title and, on the right, its danger tag.
function ZoneCard({ title, tag, children }) {
  const titleId = useId()
  return (
    <Frame as="section" tone="panel" aria-labelledby={titleId} className="flex flex-col gap-1.5 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <h4 id={titleId} className="m-0 font-pixel text-[11px] font-normal leading-tight text-white">
          {title}
        </h4>
        {tag}
      </div>
      {children}
    </Frame>
  )
}
