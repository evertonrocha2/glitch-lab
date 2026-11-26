import { useId, useState } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { HUNT_WORLDS, ZONES } from '../../../../shared/game/zones.js'
import { HUB_ID, WORLDS } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { isEnemWorld, showsEnem } from '../../world/enem-worlds.js'
import GameIcon from '../icons/game-icon.jsx'
import { ActionButton, BlockTitle } from './panel-ui.jsx'

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
      <BlockTitle id={mapsId}>{t('game.world.maps')}</BlockTitle>
      <ul aria-labelledby={mapsId} className="grid grid-cols-2 gap-1">
        {worlds.map((each) => {
          const here = each.id === world
          return (
            <li
              key={each.id}
              aria-current={here ? 'location' : undefined}
              className={`flex flex-col border-2 px-1.5 py-1 ${here ? 'border-[#f2c14e] bg-[#2a1f5a]' : 'border-[#2e2650] bg-[#1e1838] text-[#9a93b8]'}`}
            >
              <span className={here ? 'font-bold text-white' : ''}>{t(`world.name.${each.id}`)}</span>
              <small className="text-[10px]">{here ? t('game.world.here') : HUNT_WORLDS.includes(each.id) ? '' : t('game.world.soon')}</small>
            </li>
          )
        })}
      </ul>

      <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
        <legend className="mb-1 p-0">
          <BlockTitle>{t('game.world.difficulty')}</BlockTitle>
        </legend>
        <div className="flex flex-wrap gap-1">
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

      <BlockTitle>{t('game.world.zones')}</BlockTitle>
      {list.map((state, at) => {
        const def = ZONES[world][state.id]
        const locked = lockReason(t, list, at, level, difficulty, world)
        const here = hunt?.world === world && hunt.zone === state.id && hunt.difficulty === difficulty
        const bossWhy = replaying ? t('game.why.fighting') : locked ?? (level < state.bossLevel ? t('game.why.level', { level: state.bossLevel }) : null)
        const huntWhy = replaying ? t('game.why.fighting') : locked
        return (
          <ZoneCard key={state.id} title={t('game.world.zoneTitle', { n: at + 1, name: zoneName(state.id) })} locked={Boolean(locked)}>
            <p className="m-0 text-[#b9b0de]">
              {t('game.world.minLevel', { level: state.minLevel })}
              {locked && <span className="text-[#ff9aa6]">{`. ${locked}`}</span>}
            </p>
            <p className="m-0 flex items-center gap-1">
              <GameIcon name="skull" size={1} />
              {t('game.world.boss', { boss: t(`game.boss.${def.boss}`) })}
              {state.beaten && <b className="ml-1 border border-[#6fe39a] px-1 text-[10px] text-[#6fe39a]">{t('game.world.beaten')}</b>}
            </p>
            <p className="m-0 text-[#b9b0de]">
              {t('game.world.power', { power: fmt.format(suggestedPower(def, difficulty)) })}
              {here && <b className="ml-2 text-[#ffd76a]">{t('game.world.hunting')}</b>}
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

      <ActionButton busy={busy} onClick={leave}>
        {t('game.world.leave')}
      </ActionButton>
    </>
  )
}

function ZoneCard({ title, locked, children }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={`flex flex-col gap-1 border-2 bg-[#120e26] p-2 ${locked ? 'border-[#2e2650] opacity-80' : 'border-[#4a3b8f]'}`}>
      <h4 id={titleId} className="m-0 text-[12px] font-bold text-white">
        {title}
      </h4>
      {children}
    </section>
  )
}
