import { useId, useMemo } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { ACERTOS_PER_POINT } from '../../../../shared/game/fuel.js'
import { BAG_SIZE } from '../../../../shared/game/items.js'
import { HUNT_WORLDS, ZONES } from '../../../../shared/game/zones.js'
import { gearOf } from '../hero/gear.js'
import { HeroCanvas } from '../hero/hero-canvas.jsx'
import GameIcon from '../icons/game-icon.jsx'
import ItemTooltip from '../item-tooltip/item-tooltip.jsx'
import { useStudyWindow } from '../study-window/study-window-provider.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import Bar from '../ui/bar.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import ItemCell, { EmptyCell } from './item-cell.jsx'
import { ActionButton } from './panel-ui.jsx'

// The doll's two slot columns, each read top to bottom.
const LEFT = ['helm', 'amulet', 'chest', 'offhand']
const RIGHT = ['weapon', 'ring', 'boots', 'relic']

// The empty slot's faded icon.
const SLOT_ICON = { helm: 'helm', amulet: 'amulet', ring: 'ring', weapon: 'sword', chest: 'armor', offhand: 'shield', boots: 'boot', relic: 'keyboard' }

// The stats in three titled groups: each stat, its icon and how its value reads.
const STAT_GROUPS = [
  [
    'Offense',
    [
      ['attack', 'sword', 'flat'],
      ['critChance', 'target', 'pct'],
      ['critDamage', 'skull', 'pct'],
      ['attackSpeed', 'clock', 'speed'],
      ['magicPct', 'staff', 'pct'],
    ],
  ],
  [
    'Defense',
    [
      ['hp', 'heart', 'flat'],
      ['mana', 'mppot', 'flat'],
      ['armor', 'shield', 'flat'],
      ['dodge', 'feather', 'pct'],
    ],
  ],
  [
    'Resist',
    [
      ['resFire', 'flame', 'pct'],
      ['resIce', 'snow', 'pct'],
      ['resLightning', 'bolt', 'pct'],
      ['resPoison', 'poison', 'pct'],
    ],
  ],
]

// The power bar's track runs this far past the boss's number, so the boss mark sits inside it.
const POWER_HEADROOM = 1.25
// The fill: amber while short of the boss, green once ready. Both keep the gold boss mark and the
// white numbers readable (a gold fill hid them).
const POWER_SHORT = '#c98a1c'
const POWER_READY = '#2fae5f'

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
  // suggestedPower is tuned on Normal only; the scaled number is an estimate, so it reads "approx.".
  return { boss: def.boss, suggested: Math.round(def.suggestedPower * diff.mult), approx: diff.mult !== 1 }
}

// The Hero tab: the paper doll (the live hero on a pedestal, four slots each side), the worn item's
// tooltip and actions, the study quest card, the power bar against the next boss and the stats.
// The doll and the quest card come first: the desktop console shows about 400px of the tab.
// onEditLook (optional): opens the character creator; without it the Appearance button is hidden.
export default function HeroTab({ view, actions, runner, selectedId, onSelect, onForge, target, studyHref, onEditLook }) {
  const text = useItemText()
  const { t } = text
  const worn = view.hero.items.filter((item) => item.equipped)
  const selected = worn.find((item) => item.id === selectedId)
  const bagFull = view.hero.items.length - worn.length >= BAG_SIZE

  return (
    <>
      <Doll view={view} worn={worn} selectedId={selectedId} onSelect={onSelect} onEditLook={onEditLook} text={text} />

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

      <StudyQuest study={view.study} href={studyHref} text={text} />
      <PowerBox view={view} target={target} text={text} />
      <StatGroups stats={view.stats} text={text} />
    </>
  )
}

// The paper doll: slots left and right, the hero (wearing what is equipped) on a pedestal between.
function Doll({ view, worn, selectedId, onSelect, onEditLook, text }) {
  const { t } = text
  const bySlot = Object.fromEntries(worn.map((item) => [item.equipped, item]))
  const gear = useMemo(() => gearOf(view.hero.items), [view.hero.items])

  const column = (slots) => (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {slots.map((slot) => {
        const item = bySlot[slot]
        const slotName = t(`game.slot.${slot}`)
        return (
          <li key={slot} data-slot={slot}>
            {item ? (
              <ItemCell
                item={item}
                label={t('game.hero.slotItem', { slot: slotName, name: text.cellLabel(item) })}
                selected={item.id === selectedId}
                onClick={() => onSelect(item.id === selectedId ? null : item.id)}
              />
            ) : (
              <EmptyCell label={t('game.hero.emptySlot', { slot: slotName })} icon={SLOT_ICON[slot]} name={t(`game.slotShort.${slot}`)} />
            )}
          </li>
        )
      })}
    </ul>
  )

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only groups the slots and the hero.
    <div role="group" aria-label={t('game.hero.gear')} className="grid grid-cols-[minmax(44px,56px)_minmax(0,1fr)_minmax(44px,56px)] gap-1.5">
      {column(LEFT)}
      <div className="flex min-w-0 flex-col items-center justify-center">
        <HeroCanvas look={view.hero.look} gear={gear} scale={4} animate label={t('game.hero.doll')} className="block h-auto max-w-full" />
        <Pedestal />
        {onEditLook && (
          <Frame
            as="button"
            type="button"
            tone="raised"
            onClick={onEditLook}
            className="mt-2 cursor-pointer px-3 pb-1.5 pt-2 font-pixel text-[10px] leading-none text-[#e9e4ff] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c14e]"
          >
            {t('game.look.edit')}
          </Frame>
        )}
      </div>
      {column(RIGHT)}
    </div>
  )
}

// The stone the hero stands on: stepped rows, lit on top, ink at the base.
function Pedestal() {
  return (
    <div aria-hidden="true" className="-mt-2 flex w-full flex-col items-center">
      <i className="block h-1 w-[44%] bg-[#574a96]" />
      <i className="block h-1.5 w-[54%] border-x-2 border-[#120c22] bg-[#3e3170]" />
      <i className="block h-2 w-[62%] border-x-2 border-[#120c22] bg-[#241c44]" />
      <i className="block h-0.5 w-[62%] bg-[#120c22]" />
    </div>
  )
}

function PowerBox({ view, target, text }) {
  const { t } = text
  const goal = bossTarget(view, target)
  const power = view.power
  const short = goal && power < goal.suggested
  const vars = goal && { boss: t(`game.boss.${goal.boss}`), power: goal.approx ? t('game.hero.approx', { power: text.number(goal.suggested) }) : text.number(goal.suggested), gap: text.number(goal.suggested - power) }
  const max = goal ? Math.max(power, Math.round(goal.suggested * POWER_HEADROOM)) : Math.max(power, 1)
  const shown = goal ? t('game.hero.powerOf', { power: text.number(power), suggested: vars.power }) : text.number(power)
  return (
    <div className="flex flex-col gap-1.5">
      <SectionTitle>{t('game.hero.power')}</SectionTitle>
      <Bar value={power} max={max} tick={goal?.suggested} label={t('game.hero.power')} text={shown} color={short ? POWER_SHORT : POWER_READY} className="h-5" />
      {goal && <p className={`m-0 text-[11px] leading-snug ${short ? 'text-[#ff9aa6]' : 'text-[#6fe39a]'}`}>{short ? t('game.hero.needs', vars) : t('game.hero.ready', vars)}</p>}
    </div>
  )
}

function StatGroups({ stats, text }) {
  const { t, locale } = text
  const baseId = useId()
  const pct = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const speed = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const show = (kind, value = 0) => {
    if (kind === 'speed') return t('game.hero.perSecond', { value: speed.format(value) })
    if (kind === 'pct') return `${pct.format(value)}%`
    return text.number(Math.round(value))
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only names the stat lists together.
    <div role="group" aria-label={t('game.hero.stats')} className="flex flex-col gap-2.5">
      {STAT_GROUPS.map(([group, rows]) => {
        const id = `${baseId}-${group}`
        return (
          <div key={group} className="flex flex-col gap-1.5">
            <SectionTitle id={id}>{t(`game.hero.stats${group}`)}</SectionTitle>
            <ul aria-labelledby={id} className="m-0 grid list-none grid-cols-2 gap-x-3 gap-y-1 p-0 text-[11px] leading-tight">
              {rows.map(([stat, icon, kind]) => (
                <li key={stat} className="flex min-w-0 items-center gap-1.5">
                  <GameIcon name={icon} size={1} className="shrink-0" />
                  <span className="min-w-0 text-[#a89fd0]">{text.statName(stat)}</span>
                  <b className="ml-auto shrink-0 pl-1 text-white">{show(kind, stats[stat])}</b>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// The study call to action as a quest card: a gold frame, the book, today's answers and a meter
// filling toward the next tree point (gone once those points are maxed out). Inside the game (a
// StudyWindowProvider above) it opens the study page in the study window, so the game stays on
// screen; elsewhere it is a plain link to it.
function StudyQuest({ study, href, text }) {
  const { t } = text
  const studyWindow = useStudyWindow()
  const next = study?.today?.toNextPoint
  const done = next == null ? 0 : ACERTOS_PER_POINT - next
  let target = {}
  if (href && studyWindow) target = { as: 'button', type: 'button', onClick: () => studyWindow.open(href) }
  else if (href) target = { as: 'a', href }
  return (
    <Frame
      {...target}
      tone="gold"
      className={`flex flex-col gap-2 p-2.5 text-left text-[#e9e4ff] no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${href ? 'cursor-pointer' : ''}`}
    >
      <span className="flex items-center gap-2">
        <GameIcon name="book" size={2} className="shrink-0" />
        <span className="flex min-w-0 flex-col items-start gap-1">
          <Chip tone="gold">{t('game.hero.quest')}</Chip>
          <b className="font-pixel text-[11px] font-normal leading-tight text-[#f2c14e]">{t('game.hero.study')}</b>
        </span>
      </span>
      {next != null && (
        <Bar
          value={done}
          max={ACERTOS_PER_POINT}
          segments={ACERTOS_PER_POINT}
          label={t('game.hero.studyMeter')}
          text={`${text.number(done)} / ${text.number(ACERTOS_PER_POINT)}`}
          color="#6fe39a"
        />
      )}
      <span className="flex flex-col gap-0.5 leading-snug">
        <small className="text-[11px] text-[#e9e4ff]">{t('game.hero.studyToday', { count: study?.today?.correct ?? 0 })}</small>
        <small className="text-[11px] text-[#a89fd0]">{next == null ? t('game.hero.studyCapped') : t('game.hero.studyNext', { count: next })}</small>
      </span>
    </Frame>
  )
}
