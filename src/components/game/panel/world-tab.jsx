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
const FINAL = 'z3'

// The zone's suggested power on a difficulty: enemies scale by its mult, so the power does too.
export const suggestedPower = (zone, difficulty) => Math.round(zone.suggestedPower * DIFFICULTIES[difficulty].mult)

// Why a zone of the list is closed: the level, the difficulty, or the boss before it.
function lockReason(t, list, at, level, difficulty, world) {
  const state = list[at]
  if (state.unlocked) return null
  const needs = Math.max(state.minLevel, DIFFICULTIES[difficulty].minLevel)
  if (level < needs) return t('game.why.level', { level: needs })
  const before = ORDER[ORDER.indexOf(difficulty) - 1]
  if (before) return t('game.why.difficulty', { boss: t(`game.boss.${ZONES[world][FINAL].boss}`), difficulty: t(`game.diff.${before}`) })
  return t('game.why.prevBoss', { boss: t(`game.boss.${ZONES[world][list[at - 1].id].boss}`) })
}

// The Mundo tab: the world map list, the Forest's zones on a difficulty, and per zone "Caçar aqui"
// and "Enfrentar chefe". actions.startHunt / fightBoss / stopHunt take { world, zone, difficulty } and
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
          {ORDER.map((id) => {
            const open = (view.zones?.[world]?.[id] ?? []).some((zone) => zone.unlocked)
            const needs = DIFFICULTIES[id].minLevel
            const before = ORDER[ORDER.indexOf(id) - 1]
            const why =
              open || !before
                ? null
                : level < needs
                  ? t('game.why.level', { level: needs })
                  : t('game.why.difficulty', { boss: t(`game.boss.${ZONES[world][FINAL].boss}`), difficulty: t(`game.diff.${before}`) })
            return (
              <ActionButton key={id} pressed={id === difficulty} why={why} onClick={() => setDifficulty(id)} tone={id === difficulty ? 'gold' : 'default'}>
                {t(`game.diff.${id}`)}
              </ActionButton>
            )
          })}
        </div>
      </fieldset>

      <SectionTitle>{t('game.world.zones')}</SectionTitle>
      {list.map((state, at) => {
        const def = ZONES[world][state.id]
        const locked = lockReason(t, list, at, level, difficulty, world)
        const here = hunt?.world === world && hunt.zone === state.id && hunt.difficulty === difficulty
        const bossWhy = replaying ? t('game.why.fighting') : locked ?? (level < state.bossLevel ? t('game.why.level', { level: state.bossLevel }) : null)
        const huntWhy = replaying ? t('game.why.fighting') : locked
        return (
          <ZoneCard key={state.id} title={t('game.world.zoneTitle', { n: at + 1, name: zoneName(state.id) })} locked={Boolean(locked)}>
            <p className="m-0 text-[11px] text-[#a89fd0]">
              {t('game.world.minLevel', { level: state.minLevel })}
              {locked && <span className="text-[#ff9aa6]">{`. ${locked}`}</span>}
            </p>
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px]">
              <GameIcon name="skull" size={1} />
              {t('game.world.boss', { boss: t(`game.boss.${def.boss}`) })}
              {state.beaten && <Chip tone="ok">{t('game.world.beaten')}</Chip>}
            </p>
            <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px] text-[#a89fd0]">
              {t('game.world.power', { power: fmt.format(suggestedPower(def, difficulty)) })}
              {here && <Chip tone="gold">{t('game.world.hunting')}</Chip>}
            </p>
            <div className="flex flex-wrap items-start gap-1.5">
              {here ? (
                <ActionButton busy={busy} onClick={stop}>
                  {t('game.world.stop')}
                </ActionButton>
              ) : (
                <ActionButton busy={busy} why={huntWhy} onClick={() => start(state.id)}>
                  {t('game.world.hunt')}
                </ActionButton>
              )}
              <ActionButton tone="danger" busy={busy} why={bossWhy} onClick={() => fight(state.id)}>
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

// A zone: a raised box when open, sunk and dimmed while locked.
function ZoneCard({ title, locked, children }) {
  const titleId = useId()
  return (
    <Frame as="section" tone={locked ? 'inset' : 'panel'} aria-labelledby={titleId} className={`flex flex-col gap-1.5 p-2.5 ${locked ? 'opacity-80' : ''}`}>
      <h4 id={titleId} className={`m-0 font-pixel text-[11px] font-normal leading-tight ${locked ? 'text-[#a89fd0]' : 'text-white'}`}>
        {title}
      </h4>
      {children}
    </Frame>
  )
}
