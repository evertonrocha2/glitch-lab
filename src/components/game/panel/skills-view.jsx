import { useId, useMemo, useState } from 'react'
import { tuneSkill } from '../../../../shared/game/skill-mods.js'
import { LOADOUT_SIZE, MAX_SKILL_LEVEL, MAX_THRESHOLD, SKILLS, skillPower, skillUpgradeCost } from '../../../../shared/game/skills.js'
import { socketedSupports } from '../../../../shared/game/talents.js'
import GameIcon from '../icons/game-icon.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { ActionButton } from './panel-ui.jsx'
import { modText } from './support-gem.js'

const BOX = 'flex flex-col gap-2 p-2.5'
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
  // The loadout has no draft: each equip, remove or move saves at once, so an equipped skill always
  // fights. Only the potion thresholds wait for Save.
  const slots = saved
  const [thresholds, setThresholds] = useState(savedThresholds)
  const skillName = (id) => t(`game.skill.${id}`)

  const changed = thresholds.hp !== savedThresholds.hp || thresholds.mp !== savedThresholds.mp
  const free = slots.indexOf(null)
  // Each skill as the hero fights with it: its skill passives (in the hero's effects) and support gems.
  const effects = view.stats?.effects
  const { talents, treeSockets } = view.hero
  const tuned = useMemo(() => {
    const tuning = { effects: effects ?? [], supports: socketedSupports(talents ?? [], treeSockets) }
    return Object.fromEntries(SKILLS.map((def) => [def.id, tuneSkill(def, tuning)]))
  }, [effects, talents, treeSockets])

  const commit = (next) => runner.run(() => actions.saveLoadout({ skills: next, thresholds: savedThresholds }), () => t('game.loadout.saved'))
  const move = (from, to) => {
    const next = [...slots]
    ;[next[from], next[to]] = [next[to], next[from]]
    commit(next)
  }
  const put = (at, id) => commit(slots.map((each, i) => (i === at ? id : each)))
  const save = () => runner.run(() => actions.saveLoadout({ skills: slots, thresholds }), () => t('game.loadout.saved'))

  return (
    <>
      <SectionTitle id={listId}>{t('game.skills.list')}</SectionTitle>
      <ul aria-labelledby={listId} className="m-0 flex list-none flex-col gap-1.5 p-0">
        {SKILLS.map((def) => (
          <SkillRow
            key={def.id}
            def={def}
            tuned={tuned[def.id]}
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

      <Frame as="section" aria-labelledby={loadoutId} className={BOX}>
        <SectionTitle id={loadoutId}>{t('game.loadout.title')}</SectionTitle>
        <ol aria-labelledby={loadoutId} className="m-0 flex list-none flex-col gap-1 p-0">
          {slots.map((id, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positions.
            <li key={i} className="flex min-h-11 items-center gap-2 border-2 border-[#120c22] bg-[#100c20] py-0.5 pl-1.5 pr-0.5 shadow-[inset_2px_2px_0_#0a0818]">
              <Chip tone="ink" aria-hidden="true">
                {i + 1}
              </Chip>
              <span className="sr-only">{t('game.loadout.slot', { slot: i + 1 })}: </span>
              {id ? <GameIcon name={SKILL_BY_ID[id]?.icon ?? 'bag'} size={1} /> : <span className="inline-block size-4.5" />}
              <span className={`min-w-0 flex-1 ${id ? 'text-white' : 'text-[#7d8196]'}`}>{id ? skillName(id) : t('game.loadout.empty')}</span>
              {id && (
                <span className="flex gap-1">
                  <SlotButton label={t('game.loadout.up', { skill: skillName(id) })} busy={runner.busy} hidden={i === 0} onClick={() => move(i, i - 1)}>
                    ↑
                  </SlotButton>
                  <SlotButton label={t('game.loadout.down', { skill: skillName(id) })} busy={runner.busy} hidden={i === LOADOUT_SIZE - 1} onClick={() => move(i, i + 1)}>
                    ↓
                  </SlotButton>
                  <SlotButton label={t('game.loadout.remove', { skill: skillName(id) })} busy={runner.busy} onClick={() => put(i, null)}>
                    ×
                  </SlotButton>
                </span>
              )}
            </li>
          ))}
        </ol>
      </Frame>

      <Frame as="section" aria-labelledby={potionsId} className={BOX}>
        <SectionTitle id={potionsId}>{t('game.loadout.potions')}</SectionTitle>
        <Threshold label={t('game.loadout.hp')} icon="hppot" value={thresholds.hp} onChange={(hp) => setThresholds((now) => ({ ...now, hp }))} />
        <Threshold label={t('game.loadout.mp')} icon="mppot" value={thresholds.mp} onChange={(mp) => setThresholds((now) => ({ ...now, mp }))} />
      </Frame>

      <span>
        <ActionButton tone="gold" busy={runner.busy} why={changed ? null : t('game.why.unchanged')} quiet onClick={save}>
          {t('game.loadout.save')}
        </ActionButton>
      </span>
    </>
  )
}

// A loadout move. hidden keeps the row aligned when the move has nowhere to go.
// busy: a save is on its way; the next change waits for it, so two quick clicks never undo each other.
function SlotButton({ label, hidden = false, busy = false, onClick, children }) {
  if (hidden) return <span className="inline-block size-11" />
  return (
    <Frame
      as="button"
      type="button"
      tone="raised"
      onClick={onClick}
      disabled={busy}
      className="size-11 cursor-pointer text-[13px] leading-none text-[#e9e4ff] hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </Frame>
  )
}

function Threshold({ label, icon, value, onChange }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <GameIcon name={icon} size={1} />
      <label htmlFor={id} className="flex-1 text-[#e9e4ff]">
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
      <output htmlFor={id} className="w-10 text-right font-pixel text-[10px] text-white">
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

// tuned: the skill with what changes it (tuneSkill); its mana, cooldown and durations are the ones shown.
function SkillRow({ def, tuned, level, slot, canEquip, view, actions, runner, text, onEquip }) {
  const { t } = text
  const modsId = useId()
  const mods = modText(t, text.number)
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
    <Frame as="li" tone={have ? 'panel' : 'inset'} className={BOX}>
      <div className="flex items-center gap-2.5">
        <GameIcon name={def.icon} size={2} className={have ? '' : 'opacity-60'} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <b className={`font-pixel text-[11px] font-normal leading-tight ${have ? 'text-white' : 'text-[#a89fd0]'}`}>{name}</b>
          <Chip tone={have ? 'gold' : 'muted'}>{have ? t('game.skills.level', { level, max: MAX_SKILL_LEVEL }) : t('game.skills.notOwned')}</Chip>
        </div>
      </div>
      <small className="text-[11px] text-[#8fb8ff]">{describe(t, tuned, level)}</small>
      <small className="text-[11px] text-[#a89fd0]">{t('game.skills.meta', { mana: text.number(tuned.mana), seconds: text.number(tuned.cooldownMs / 1000) })}</small>
      {tuned.mods.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <small id={modsId} className="font-pixel text-[9px] text-[#7fe9ff]">
            {t('game.skills.mods')}
          </small>
          <ul aria-labelledby={modsId} className="m-0 list-disc pl-3.5 text-[11px] text-[#7fe9ff]">
            {tuned.mods.map(({ kind, id }) => (
              <li key={`${kind}:${id}`}>
                {t(kind === 'passive' ? 'game.skills.modPassive' : 'game.skills.modSupport', { name: mods.name(kind, id), desc: mods.desc(kind, id) })}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!have && <small className="text-[11px] text-[#a89fd0]">{t('game.skills.price', { fragments: text.number(def.price) })}</small>}
      {cost && <small className="text-[11px] text-[#a89fd0]">{t('game.skills.next', { fragments: text.number(cost.fragments) })}</small>}
      <span className="flex flex-wrap items-start gap-1.5">
        {have ? (
          <>
            <ActionButton tone="gold" busy={runner.busy} why={upgradeWhy} onClick={upgrade}>
              {named(t('game.skills.upgrade'))}
            </ActionButton>
            {slot >= 0 ? (
              <small className="self-center text-[#6fe39a]">{t('game.skills.inSlot', { slot: slot + 1 })}</small>
            ) : (
              <ActionButton busy={runner.busy} why={canEquip ? null : t('game.why.loadoutFull', { count: LOADOUT_SIZE })} onClick={onEquip}>
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
    </Frame>
  )
}
