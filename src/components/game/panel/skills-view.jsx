import { useId, useState } from 'react'
import { LOADOUT_SIZE, MAX_SKILL_LEVEL, MAX_THRESHOLD, SKILLS, skillPower, skillUpgradeCost } from '../../../../shared/game/skills.js'
import GameIcon from '../icons/game-icon.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import { ActionButton, BlockTitle } from './panel-ui.jsx'

const BOX = 'flex flex-col gap-1.5 border-2 border-[#2e2650] bg-[#160f2e] p-1.5'
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill]))
const THRESHOLD_STEP = 0.05

const padded = (loadout) => Array.from({ length: LOADOUT_SIZE }, (_, i) => loadout?.[i] ?? null)
const pct = (share) => Math.round(share * 100)

// The Habilidades view: the eight skills (buy and upgrade with fragments), the four loadout slots and
// the potion thresholds. The loadout is a draft until Save; a new View from the server resets it.
export default function SkillsView({ view, actions, runner }) {
  const { loadout } = view.hero.skills
  const { hp, mp } = view.hero.thresholds ?? {}
  return <SkillsBody key={JSON.stringify([loadout, hp, mp])} view={view} actions={actions} runner={runner} />
}

function SkillsBody({ view, actions, runner }) {
  const text = useItemText()
  const { t } = text
  const listId = useId()
  const loadoutId = useId()
  const potionsId = useId()
  const owned = view.hero.skills.owned
  const saved = padded(view.hero.skills.loadout)
  const savedThresholds = { hp: view.hero.thresholds?.hp ?? 0, mp: view.hero.thresholds?.mp ?? 0 }
  const [slots, setSlots] = useState(saved)
  const [thresholds, setThresholds] = useState(savedThresholds)
  const skillName = (id) => t(`game.skill.${id}`)

  const changed =
    slots.some((id, i) => id !== saved[i]) || thresholds.hp !== savedThresholds.hp || thresholds.mp !== savedThresholds.mp
  const free = slots.indexOf(null)

  const move = (from, to) =>
    setSlots((now) => {
      const next = [...now]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  const put = (at, id) => setSlots((now) => now.map((each, i) => (i === at ? id : each)))
  const save = () => runner.run(() => actions.saveLoadout({ skills: slots, thresholds }), () => t('game.loadout.saved'))

  return (
    <>
      <BlockTitle id={listId}>{t('game.skills.list')}</BlockTitle>
      <ul aria-labelledby={listId} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {SKILLS.map((def) => (
          <SkillRow
            key={def.id}
            def={def}
            level={owned[def.id] ?? 0}
            slot={slots.indexOf(def.id)}
            canEquip={free >= 0}
            view={view}
            actions={actions}
            runner={runner}
            text={text}
            onEquip={() => put(free, def.id)}
          />
        ))}
      </ul>

      <section aria-labelledby={loadoutId} className={BOX}>
        <BlockTitle id={loadoutId}>{t('game.loadout.title')}</BlockTitle>
        <ol aria-labelledby={loadoutId} className="m-0 flex list-none flex-col gap-1 p-0">
          {slots.map((id, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions.
            <li key={i} className="flex min-h-11 items-center gap-1.5">
              <b className="w-4 text-center text-[#9a93b8]" aria-hidden="true">
                {i + 1}
              </b>
              <span className="sr-only">{t('game.loadout.slot', { slot: i + 1 })}: </span>
              {id ? <GameIcon name={SKILL_BY_ID[id]?.icon ?? 'bag'} size={1} /> : <span className="inline-block size-4.5" />}
              <span className={`flex-1 ${id ? 'text-white' : 'text-[#7d8196]'}`}>{id ? skillName(id) : t('game.loadout.empty')}</span>
              {id && (
                <span className="flex gap-1">
                  <SlotButton label={t('game.loadout.up', { skill: skillName(id) })} hidden={i === 0} onClick={() => move(i, i - 1)}>
                    ↑
                  </SlotButton>
                  <SlotButton label={t('game.loadout.down', { skill: skillName(id) })} hidden={i === LOADOUT_SIZE - 1} onClick={() => move(i, i + 1)}>
                    ↓
                  </SlotButton>
                  <SlotButton label={t('game.loadout.remove', { skill: skillName(id) })} onClick={() => put(i, null)}>
                    ×
                  </SlotButton>
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby={potionsId} className={BOX}>
        <BlockTitle id={potionsId}>{t('game.loadout.potions')}</BlockTitle>
        <Threshold label={t('game.loadout.hp')} icon="hppot" value={thresholds.hp} onChange={(hp) => setThresholds((now) => ({ ...now, hp }))} />
        <Threshold label={t('game.loadout.mp')} icon="mppot" value={thresholds.mp} onChange={(mp) => setThresholds((now) => ({ ...now, mp }))} />
      </section>

      <span>
        <ActionButton tone="gold" busy={runner.busy} why={changed ? null : t('game.why.unchanged')} quiet onClick={save}>
          {t('game.loadout.save')}
        </ActionButton>
      </span>
    </>
  )
}

// A loadout move. hidden keeps the row aligned when the move has nowhere to go.
function SlotButton({ label, hidden = false, onClick, children }) {
  if (hidden) return <span className="inline-block size-11" />
  return (
    <button
      type="button"
      onClick={onClick}
      className="size-11 cursor-pointer border-2 border-[#8f6bff] bg-[#2a1f5a] text-[13px] text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#f2c14e]"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

function Threshold({ label, icon, value, onChange }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <GameIcon name={icon} size={1} />
      <label htmlFor={id} className="flex-1 text-[#d9d3f5]">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={MAX_THRESHOLD}
        step={THRESHOLD_STEP}
        value={value}
        aria-valuetext={`${pct(value)}%`}
        onChange={(event) => onChange(Math.round(Number(event.target.value) * 100) / 100)}
        className="h-11 w-28 cursor-pointer accent-[#f2c14e]"
      />
      <output htmlFor={id} className="w-9 text-right text-white">
        {pct(value)}%
      </output>
    </div>
  )
}

// What a skill does at a level, with its numbers.
function describe(t, def, level) {
  return t(`game.skillDesc.${def.id}`, {
    power: pct(skillPower(def, Math.max(1, level))),
    seconds: (def.durationMs ?? 0) / 1000,
    slow: pct(def.slow ?? 0),
    slowSeconds: (def.slowMs ?? 0) / 1000,
  })
}

function SkillRow({ def, level, slot, canEquip, view, actions, runner, text, onEquip }) {
  const { t } = text
  const name = t(`game.skill.${def.id}`)
  const have = level > 0
  const cost = have ? skillUpgradeCost(level) : null
  const fragments = view.hero.fragments ?? 0
  const heroLevel = view.level?.level ?? 1
  const named = (verb) => (
    <>
      {verb} <span className="sr-only">{name}</span>
    </>
  )

  const buyWhy = heroLevel < def.minLevel ? t('game.why.level', { level: def.minLevel }) : fragments < def.price ? t('game.why.fragments') : null
  const upgradeWhy = !cost ? t('game.why.maxUpgrade') : fragments < cost.fragments ? t('game.why.fragments') : null
  const buy = () => runner.run(() => actions.buySkill(def.id), () => t('game.skills.bought', { skill: name }))
  const upgrade = () =>
    runner.run(
      () => actions.upgradeSkill(def.id),
      (result) => t('game.skills.upgraded', { skill: name, level: result?.hero?.skills?.owned?.[def.id] ?? level + 1 }),
    )

  return (
    <li className={BOX}>
      <div className="flex items-center gap-2">
        <GameIcon name={def.icon} size={2} />
        <div className="flex flex-1 flex-col">
          <b className={have ? 'text-white' : 'text-[#b9b0de]'}>{name}</b>
          <small className={have ? 'text-[#ffd76a]' : 'text-[#7d8196]'}>
            {have ? t('game.skills.level', { level, max: MAX_SKILL_LEVEL }) : t('game.skills.notOwned')}
          </small>
        </div>
      </div>
      <small className="text-[#8fb8ff]">{describe(t, def, level)}</small>
      <small className="text-[#b9b0de]">{t('game.skills.meta', { mana: text.number(def.mana), seconds: text.number(def.cooldownMs / 1000) })}</small>
      {!have && <small className="text-[#b9b0de]">{t('game.skills.price', { fragments: text.number(def.price) })}</small>}
      {cost && <small className="text-[#b9b0de]">{t('game.skills.next', { fragments: text.number(cost.fragments) })}</small>}
      <span className="flex flex-wrap items-start gap-1.5">
        {have ? (
          <>
            <ActionButton tone="gold" busy={runner.busy} why={upgradeWhy} onClick={upgrade}>
              {named(t('game.skills.upgrade'))}
            </ActionButton>
            {slot >= 0 ? (
              <small className="self-center text-[#6fe39a]">{t('game.skills.inSlot', { slot: slot + 1 })}</small>
            ) : (
              <ActionButton why={canEquip ? null : t('game.why.loadoutFull', { count: LOADOUT_SIZE })} onClick={onEquip}>
                {named(t('game.loadout.add'))}
              </ActionButton>
            )}
          </>
        ) : (
          <ActionButton tone="gold" busy={runner.busy} why={buyWhy} onClick={buy}>
            {named(t('game.skills.buy'))}
          </ActionButton>
        )}
      </span>
    </li>
  )
}
