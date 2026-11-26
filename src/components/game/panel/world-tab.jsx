import { useId, useMemo } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { ZONES, zoneDef } from '../../../../shared/game/zones.js'
import { HUB_ID, WORLDS } from '../../../../shared/world/worlds.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { shownIn } from '../../world/enem-worlds.js'
import { dangerOf, suggestedPower, zoneInfo } from '../../world/zone-info.js'
import GameIcon from '../icons/game-icon.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { ActionButton } from './panel-ui.jsx'

export { dangerOf, suggestedPower }

const ORDER = Object.keys(DIFFICULTIES)
const DANGER_TONE = { safe: 'ok', risky: 'gold', deadly: 'danger' }

// The Mundo tab (fase 3): the hunt running now (with a pause for the zone the hero stands in), the
// difficulty the hero hunts on, and every region this locale shows by tier: the town, then each hunt
// region with its zones, how dangerous each is for the hero, its suggested level, about what an hour
// there pays (the server's own rules, at today's study multiplier) and its boss. The hero hunts by
// walking (standing in a zone hunts there), so there is no "hunt here" button; a boss is fought from
// the region the hero stands in.
//   here: { world, zone } where the hero stands. difficulty / onDifficulty: the picked difficulty.
//   paused: the player paused the hunt in this zone. onPause(): stops the hunt and keeps it stopped
//   until the hero leaves the zone. replaying: a boss fight is on screen, so nothing else starts.
//   actions.fightBoss takes { world, zone, difficulty } and resolves to the new View.
export default function WorldTab({ view, actions, runner, replaying = false, here, difficulty = 'normal', onDifficulty, paused = false, onPause }) {
  const { t, locale } = useI18n()
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const regionsId = useId()
  const level = view.level.level
  const hunt = view.hero.hunt
  const busy = runner.busy
  const heroPower = view.power ?? 0
  const diff = DIFFICULTIES[difficulty]
  const why = replaying ? t('game.why.fighting') : null
  const zoneName = (world, id) => t(`game.zone.${ZONES[world][id].name}`)

  // The town first, then the regions by tier, in map order within a tier.
  const regions = useMemo(
    () => WORLDS.filter((world) => shownIn(locale)(world.id)).sort((a, b) => a.tier - b.tier || WORLDS.indexOf(a) - WORLDS.indexOf(b)),
    [locale],
  )
  // Every zone's numbers for this hero and difficulty (an hour of the server's own settle each).
  const infos = useMemo(() => {
    const out = {}
    for (const world of regions) for (const id of Object.keys(ZONES[world.id] ?? {})) out[`${world.id}:${id}`] = zoneInfo(view, world.id, id, difficulty)
    return out
  }, [regions, view, difficulty])

  const fight = (world, zone) => runner.run(() => actions.fightBoss({ world, zone, difficulty }))
  const pause = () => runner.run(() => onPause(), () => t('game.world.stopped'))
  const huntDef = hunt && zoneDef(hunt.world, hunt.zone)

  return (
    <>
      <Frame tone="inset" className="flex flex-col gap-1.5 p-2.5">
        <p className="m-0 font-pixel text-[11px] leading-relaxed text-white">
          {huntDef
            ? t('game.view.hunting', { zone: `${t(`world.name.${hunt.world}`)}, ${zoneName(hunt.world, hunt.zone)}`, difficulty: t(`game.diff.${hunt.difficulty}`) })
            : t('world.view.idle')}
        </p>
        <p className="m-0 text-[11px] leading-relaxed text-[#a89fd0]">{t('world.tab.walk')}</p>
        {huntDef && here?.zone && hunt.world === here.world && hunt.zone === here.zone && !paused && (
          <span>
            <ActionButton busy={busy} why={why} onClick={pause}>
              {t('world.tab.pause')}
            </ActionButton>
          </span>
        )}
      </Frame>

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 w-full p-0">
          <SectionTitle>{t('game.world.difficulty')}</SectionTitle>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((id) => (
            <ActionButton key={id} pressed={id === difficulty} onClick={() => onDifficulty?.(id)} tone={id === difficulty ? 'gold' : 'default'}>
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

      <SectionTitle id={regionsId}>{t('world.tab.regions')}</SectionTitle>
      <ul aria-labelledby={regionsId} className="m-0 flex list-none flex-col gap-2 p-0">
        {regions.map((world) => {
          const isHere = here?.world === world.id
          const zones = ZONES[world.id] ? Object.values(ZONES[world.id]) : []
          const beaten = (view.zones?.[world.id]?.[difficulty] ?? []).filter((each) => each.beaten).map((each) => each.id)
          return (
            <Frame
              as="li"
              key={world.id}
              tone={isHere ? 'gold' : 'panel'}
              aria-current={isHere ? 'location' : undefined}
              aria-label={t(`world.name.${world.id}`)}
              className="flex flex-col gap-1.5 p-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h4 className={`m-0 font-pixel text-[11px] font-normal leading-tight ${isHere ? 'text-[#e8c35a]' : 'text-white'}`}>{t(`world.name.${world.id}`)}</h4>
                <span className="flex flex-wrap gap-1">
                  {isHere && <Chip tone="gold">{t('game.world.here')}</Chip>}
                  <Chip tone={world.id === HUB_ID ? 'ok' : 'muted'}>{world.id === HUB_ID ? t('world.safe') : t('world.tier', { n: world.tier })}</Chip>
                </span>
              </div>
              {world.id === HUB_ID && <p className="m-0 text-[11px] leading-relaxed text-[#a89fd0]">{t('world.tab.town')}</p>}
              {zones.map((zone) => {
                const info = infos[`${world.id}:${zone.id}`]
                const huntingHere = hunt?.world === world.id && hunt.zone === zone.id && hunt.difficulty === difficulty
                const won = beaten.includes(zone.id)
                return (
                  <Frame as="section" key={zone.id} tone="inset" aria-label={zoneName(world.id, zone.id)} className="flex flex-col gap-1 px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="m-0 font-pixel text-[10px] font-normal leading-tight text-white">
                        {t('game.world.zoneTitle', { n: zone.id.slice(1), name: zoneName(world.id, zone.id) })}
                      </h5>
                      <Chip tone={DANGER_TONE[info.danger]} title={t('gameOpen.danger.label', { danger: t(`gameOpen.danger.${info.danger}`) })} className="shrink-0">
                        {t(`gameOpen.danger.${info.danger}`)}
                      </Chip>
                    </div>
                    <p className="m-0 flex flex-wrap items-center gap-x-2 text-[11px] text-[#a89fd0]">
                      <span>{t('gameOpen.zone.level', { level: info.level })}</span>
                      {info.xpHour !== null && <b className="font-normal text-[#e8c35a]">{t('world.xpHour', { xp: fmt.format(info.xpHour) })}</b>}
                      <span>{t('world.tab.xpKill', { xp: fmt.format(zone.xp * diff.mult) })}</span>
                    </p>
                    <p className="m-0 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <GameIcon name="skull" size={1} />
                      {t('game.world.boss', { boss: t(`game.boss.${zone.boss}`) })}
                      {won && <Chip tone="ok">{t('game.world.beaten')}</Chip>}
                      {huntingHere && <Chip tone="gold">{t('game.world.hunting')}</Chip>}
                    </p>
                    <p className="m-0 text-[11px] text-[#a89fd0]">{t('game.world.power', { power: fmt.format(info.suggested) })}</p>
                    {heroPower < info.suggested && <p className="m-0 text-[11px] text-[#ff9aa6]">{t('gameOpen.under', { power: fmt.format(heroPower) })}</p>}
                    {isHere && (
                      <span>
                        <ActionButton tone="danger" busy={busy} why={why} onClick={() => fight(world.id, zone.id)}>
                          {t('game.world.fight')}
                        </ActionButton>
                      </span>
                    )}
                  </Frame>
                )
              })}
              {!isHere && zones.length > 0 && <p className="m-0 text-[10px] leading-relaxed text-[#8a93ad]">{t('world.tab.fightHere')}</p>}
            </Frame>
          )
        })}
      </ul>
    </>
  )
}
