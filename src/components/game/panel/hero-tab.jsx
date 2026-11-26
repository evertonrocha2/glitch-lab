import { useId } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { BAG_SIZE, SLOTS } from '../../../../shared/game/items.js'
import { HUNT_WORLDS, ZONES } from '../../../../shared/game/zones.js'
import GameIcon from '../icons/game-icon.jsx'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import ItemCell, { EmptyCell } from './item-cell.jsx'
import { ActionButton } from './panel-ui.jsx'

// The empty slot's faded icon.
const SLOT_ICON = { helm: 'helm', amulet: 'amulet', ring: 'ring', weapon: 'sword', chest: 'armor', offhand: 'shield', boots: 'boot', relic: 'keyboard' }

// The stat grid: each stat, its icon and how its value reads.
const STAT_ROWS = [
  ['attack', 'sword', 'flat'],
  ['critChance', 'target', 'pct'],
  ['critDamage', 'skull', 'pct'],
  ['attackSpeed', 'clock', 'speed'],
  ['magicPct', 'staff', 'pct'],
  ['hp', 'heart', 'flat'],
  ['mana', 'mppot', 'flat'],
  ['armor', 'shield', 'flat'],
  ['dodge', 'feather', 'pct'],
  ['resFire', 'flame', 'pct'],
  ['resIce', 'snow', 'pct'],
  ['resLightning', 'bolt', 'pct'],
  ['resPoison', 'poison', 'pct'],
]

// The boss the power bar measures against: the target, else the running hunt's zone, else the first
// open zone not yet beaten on that difficulty. Its suggestedPower scales with the difficulty, like
// the enemies do.
export function bossTarget(view, target) {
  const hunt = view.hero.hunt
  const world = target?.world ?? hunt?.world ?? HUNT_WORLDS[0]
  const difficulty = target?.difficulty ?? hunt?.difficulty ?? 'normal'
  let zone = target?.zone ?? hunt?.zone
  if (!zone) {
    const list = view.zones?.[world]?.[difficulty] ?? []
    const open = list.filter((each) => each.unlocked)
    zone = (open.find((each) => !each.beaten) ?? open.at(-1) ?? list[0])?.id
  }
  const def = ZONES[world]?.[zone]
  const diff = DIFFICULTIES[difficulty]
  if (!def || !diff) return null
  return { boss: def.boss, suggested: Math.round(def.suggestedPower * diff.mult) }
}

export default function HeroTab({ view, actions, runner, selectedId, onSelect, onForge, target, portrait, studyHref }) {
  const text = useItemText()
  const { t } = text
  const worn = view.hero.items.filter((item) => item.equipped)
  const bySlot = Object.fromEntries(worn.map((item) => [item.equipped, item]))
  const selected = worn.find((item) => item.id === selectedId)
  const bagFull = view.hero.items.length - worn.length >= BAG_SIZE

  return (
    <>
      {portrait}
      <PowerBox view={view} target={target} text={text} />

      <ul aria-label={t('game.hero.gear')} className="m-0 grid list-none grid-cols-4 gap-1.5 p-0">
        {SLOTS.map((slot) => {
          const item = bySlot[slot]
          const slotName = t(`game.slot.${slot}`)
          return (
            <li key={slot}>
              {item ? (
                <ItemCell
                  item={item}
                  label={t('game.hero.slotItem', { slot: slotName, name: text.cellLabel(item) })}
                  selected={item.id === selectedId}
                  onClick={() => onSelect(item.id === selectedId ? null : item.id)}
                />
              ) : (
                <EmptyCell label={t('game.hero.emptySlot', { slot: slotName })} icon={SLOT_ICON[slot]} />
              )}
            </li>
          )
        })}
      </ul>

      {selected && (
        <div className="flex flex-col gap-1.5">
          <ItemTooltip item={selected} worn={worn} />
          <div className="flex flex-wrap gap-1.5">
            <ActionButton
              busy={runner.busy}
              why={bagFull ? t('game.why.bagFull') : null}
              onClick={() => runner.run(() => actions.unequipSlot(selected.equipped)).then((done) => done && onSelect(null))}
            >
              {t('game.act.unequip')}
            </ActionButton>
            <ActionButton busy={runner.busy} onClick={() => onForge(selected.id)}>
              {t('game.act.forge')}
            </ActionButton>
          </div>
        </div>
      )}

      <StatGrid stats={view.stats} text={text} />
      <StudyCta study={view.study} href={studyHref} text={text} />
    </>
  )
}

function PowerBox({ view, target, text }) {
  const { t } = text
  const labelId = useId()
  const goal = bossTarget(view, target)
  const power = view.power
  const pct = goal ? Math.min(100, (power / goal.suggested) * 100) : 100
  const short = goal && power < goal.suggested
  const vars = goal && { boss: t(`game.boss.${goal.boss}`), power: text.number(goal.suggested), gap: text.number(goal.suggested - power) }
  return (
    <div className="border-2 border-[#2e2650] bg-[#160f2e] p-1.5">
      <div className="flex justify-between">
        <span id={labelId}>{t('game.hero.power')}</span>
        <b className="text-white">{text.number(power)}</b>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={power}
        aria-valuemin={0}
        aria-valuemax={goal?.suggested ?? power}
        className="relative mt-[3px] h-3 border border-[#0a0818] bg-[#2a2440]"
      >
        <i className="absolute inset-y-0 left-0 bg-linear-to-b from-[#ffd76a] to-[#c98a1c]" style={{ width: `${pct}%` }} />
        <span aria-hidden="true" className="absolute -top-[3px] right-0 h-4 w-0.5 bg-[#ff5a6e]" />
      </div>
      {goal && <p className={`m-0 mt-1 text-[11px] ${short ? 'text-[#ff9aa6]' : 'text-[#6fe39a]'}`}>{short ? t('game.hero.needs', vars) : t('game.hero.ready', vars)}</p>}
    </div>
  )
}

function StatGrid({ stats, text }) {
  const { t, locale } = text
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const speed = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const show = (kind, value = 0) => {
    if (kind === 'speed') return t('game.hero.perSecond', { value: speed.format(value) })
    if (kind === 'pct') return `${pct.format(value)}%`
    return text.number(Math.round(value))
  }
  return (
    <ul aria-label={t('game.hero.stats')} className="m-0 grid list-none grid-cols-2 gap-x-2 gap-y-[3px] p-0 text-[11px]">
      {STAT_ROWS.map(([stat, icon, kind]) => (
        <li key={stat} className="flex items-center gap-1">
          <GameIcon name={icon} size={1} />
          <span>{text.statName(stat)}</span>
          <b className="ml-auto text-white">{show(kind, stats[stat])}</b>
        </li>
      ))}
    </ul>
  )
}

// The study call to action (the mockup's yellow .study box). Task 20 passes its link.
function StudyCta({ study, href, text }) {
  const { t } = text
  const next = study?.today?.toNextPoint
  const body = (
    <>
      <b>{t('game.hero.study')}</b>
      <small className="text-[11px]">{t('game.hero.studyToday', { count: study?.today?.correct ?? 0 })}</small>
      <small className="text-[11px]">{next == null ? t('game.hero.studyCapped') : t('game.hero.studyNext', { count: next })}</small>
    </>
  )
  const box = 'flex min-h-11 flex-col gap-0.5 border-2 border-[#0a0818] bg-[#f2c14e] p-2 text-[#1c1d26] shadow-[3px_3px_0_#6a3df0] no-underline'
  return href ? (
    <a href={href} className={`${box} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}>
      {body}
    </a>
  ) : (
    <div className={box}>{body}</div>
  )
}
