import { useEffect, useMemo, useRef } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { SKILLS } from '../../../../shared/game/skills.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import GameIcon from '../icons/game-icon.jsx'

// Dark indigo panel, 2px ink border and the inset violet line (the mockup's .hud).
const PANEL = 'absolute bg-[rgba(16,12,36,0.82)] border-2 border-[#0a0818] shadow-[inset_0_0_0_1px_rgba(160,130,255,0.35)] px-2 py-1.5 text-white'
const FILL = {
  hp: 'bg-gradient-to-b from-[#ff7a7f] to-[#c22a35]',
  mp: 'bg-gradient-to-b from-[#7fb6ff] to-[#1f55c8]',
  xp: 'bg-gradient-to-b from-[#a98bff] to-[#5a2fd9]',
  boss: 'bg-gradient-to-b from-[#7dffb0] to-[#1f8a4c]',
}
// Damage the hero takes is red, healing green, shields and potions cyan, crits gold.
const LOG_COLORS = { crit: 'text-[#ffd76a]', hurt: 'text-[#ff8a8a]', heal: 'text-[#7dffb0]', shield: 'text-[#7fe9ff]', potion: 'text-[#7fe9ff]' }
const LOG_TONES = { hurt: 'bad', heal: 'good', shield: 'good', potion: 'good' }
const KEYS = { m: 'world', i: 'bag', k: 'tree' }
const SKILL_KEYS = ['Q', 'W', 'E', 'R']
const LOG_SIZE = 5
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]))

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

// Typing in a field must never trigger a shortcut.
function typing(target) {
  const tag = target?.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable === true
}

function Bar({ kind, label, now, max, text, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (now / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(now)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      className={`relative mt-[3px] h-3 border border-[#0a0818] bg-[#2a2440] ${className}`}
    >
      <i className={`absolute inset-y-0 left-0 ${FILL[kind]}`} style={{ width: `${pct}%` }} />
      <span className="relative block pl-1 font-label text-[9px] leading-[12px]">{text}</span>
    </div>
  )
}

function Slot({ label, icon, keyHint, cooldown, count, potion }) {
  const cooling = cooldown > 0
  return (
    <div
      data-testid="slot"
      aria-label={label}
      role="group"
      className={`relative grid size-11 place-items-center border-2 bg-[radial-gradient(#3a2a7a,#1a1238)] ${potion ? 'ml-0.5 border-[#4a4266]' : 'border-[#8f6bff]'}`}
    >
      {icon && <GameIcon name={icon} size={2} className={cooling ? 'opacity-35' : ''} />}
      <kbd className="absolute left-0.5 top-0 font-label text-[9px] text-[#c3b2ff]">{keyHint}</kbd>
      {count !== undefined && <b className="absolute bottom-0 right-0.5 font-label text-[10px]">{count}</b>}
      {cooling && <i className="absolute inset-0 grid place-items-center bg-black/55 font-label text-[13px] not-italic">{cooldown}s</i>}
    </div>
  )
}

// The floating HUD over the scene. view: the server View. live (optional): what only the playback
// knows, { hp, mana, buffs: [{ id, icon, seconds, bad? }], cooldowns: { [skillId]: seconds } }.
// boss (optional): { name, phase, phases, hp, maxHp, enrageSec }. log: fight events, the last 5 show.
// onFullscreen / onKey('world' | 'bag' | 'tree'): shortcuts F, M, I, K. fullscreenSupported hides the button.
export default function GameHud({ view, live = {}, boss, log = [], onFullscreen, onKey, fullscreenSupported = true, fullscreenActive = false }) {
  const { t, locale } = useI18n()
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const handlers = useRef({})
  handlers.current = { onFullscreen, onKey }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'f') handlers.current.onFullscreen?.()
      else if (KEYS[key]) handlers.current.onKey?.(KEYS[key])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { level, stats, hero } = view
  const maxHp = stats.hp
  const maxMana = stats.mana
  const hp = live.hp ?? maxHp
  const mana = live.mana ?? maxMana
  const barText = (label, now, max) => t('game.hud.bar', { label, now: fmt.format(Math.round(now)), max: fmt.format(Math.round(max)) })
  const hpLabel = t('game.hud.hp')
  const manaLabel = t('game.hud.mana')
  const xpLabel = t('game.hud.xp')
  const active = hero.hunt?.difficulty ?? 'normal'
  const events = log.slice(-LOG_SIZE)
  const cooldowns = live.cooldowns ?? {}

  const lineOf = (ev) => {
    const kind = ev.who === 'enemy' && (ev.type === 'hit' || ev.type === 'skill') ? 'hurt' : ev.type
    const key = `game.log.${kind}`
    const skill = ev.skill && SKILL_BY_ID[ev.skill] ? t(`game.skill.${ev.skill}`) : (ev.skill ?? '')
    const text = t(key, { amount: fmt.format(Math.round(ev.amount ?? 0)), skill })
    return { kind, text: text === key ? t('game.log.other') : text }
  }

  return (
    <div role="group" aria-label={t('game.hud.label')} className="pointer-events-none absolute inset-0 font-pixel">
      <div className={`${PANEL} pointer-events-auto left-2 top-2 flex w-[236px] items-start gap-2`}>
        <GameIcon name="helm" size={2} />
        <div className="min-w-0 flex-1">
          <b className="text-xs">{t('game.hud.level', { level: level.level })}</b>
          <Bar kind="hp" label={hpLabel} now={hp} max={maxHp} text={barText(hpLabel, hp, maxHp)} />
          <Bar kind="mp" label={manaLabel} now={mana} max={maxMana} text={barText(manaLabel, mana, maxMana)} />
          <Bar kind="xp" label={xpLabel} now={level.into} max={level.needed} text={barText(xpLabel, level.into, level.needed)} />
          {live.buffs?.length > 0 && (
            <ul aria-label={t('game.hud.buffs')} className="mt-[5px] flex gap-1">
              {live.buffs.map((b) => (
                <li key={b.id} className={`relative border p-px ${b.bad ? 'border-[#ff5a6e] bg-[#2e0f1a]' : 'border-[#4fd1c5] bg-[#10263a]'}`}>
                  <GameIcon name={b.icon} size={1} />
                  <em className="absolute -bottom-1 -right-0.5 bg-[#0a0818] px-0.5 text-[8px] not-italic">{t('game.hud.seconds', { seconds: b.seconds })}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {boss && (
        <div className={`${PANEL} pointer-events-auto left-1/2 top-2 w-[250px] -translate-x-[30%]`}>
          <div className="flex items-center gap-1.5 text-[11px]">
            <GameIcon name="skull" size={1} />
            <b>{boss.name}</b>
            <span className="text-[10px] text-[#9a93b8]">{t('game.hud.phase', { phase: boss.phase, phases: boss.phases })}</span>
            {boss.enrageSec !== undefined && <span className="ml-auto text-[10px] text-[#ff8a5c]">{t('game.hud.enrage', { time: clock(boss.enrageSec) })}</span>}
          </div>
          <Bar kind="boss" label={boss.name} now={boss.hp} max={boss.maxHp} text={`${fmt.format(Math.round(boss.hp))} / ${fmt.format(Math.round(boss.maxHp))}`} />
        </div>
      )}

      <ul aria-label={t('game.hud.difficulties')} className={`${PANEL} pointer-events-auto right-2 top-[92px] flex gap-1 p-1 sm:top-[68px]`}>
        {Object.entries(DIFFICULTIES).map(([id, d]) => {
          const locked = level.level < d.minLevel
          const name = t(`game.diff.${id}`)
          return (
            <li
              key={id}
              aria-current={id === active ? 'true' : undefined}
              aria-label={locked ? `${name}, ${t('game.hud.locked', { level: d.minLevel })}` : undefined}
              className={`border px-[5px] py-0.5 text-[9px] ${id === active ? 'border-[#f2c14e] text-[#ffd76a]' : 'border-[#4a4266] text-[#9a93b8]'}`}
            >
              {name}
              {locked && <small className="ml-1 text-[8px]">{t('game.hud.minLevel', { level: d.minLevel })}</small>}
            </li>
          )
        })}
      </ul>

      {/* Empty, the log stays in place for screen readers but draws nothing. */}
      <div role="log" aria-label={t('game.hud.log')} className={`${PANEL} bottom-[66px] left-2 w-[270px] max-w-[calc(100%-1rem)] text-[10px] ${events.length ? '' : 'opacity-0'}`}>
        <ul>
          {events.map((ev, i) => {
            const line = lineOf(ev)
            return (
              <li key={`${ev.t ?? i}-${i}`} data-tone={LOG_TONES[line.kind]} className={`my-px ${LOG_COLORS[line.kind] ?? ''}`}>
                {line.text}
              </li>
            )
          })}
        </ul>
      </div>

      <div className={`${PANEL} pointer-events-auto bottom-2 left-1/2 flex -translate-x-1/2 gap-[5px] p-[5px]`}>
        {hero.skills.loadout.map((id, i) => {
          const name = id ? t(`game.skill.${id}`) : t('game.hud.emptySlot')
          const cd = id ? Math.ceil(cooldowns[id] ?? 0) : 0
          return (
            <Slot
              key={`${id ?? 'empty'}-${i}`}
              label={cd > 0 ? t('game.hud.slotCd', { name, seconds: cd }) : name}
              icon={id ? SKILL_BY_ID[id]?.icon : undefined}
              keyHint={SKILL_KEYS[i]}
              cooldown={cd}
            />
          )
        })}
        <Slot potion label={t('game.hud.potionHp', { count: hero.potions.hp })} icon="hppot" keyHint="1" count={fmt.format(hero.potions.hp)} />
        <Slot potion label={t('game.hud.potionMp', { count: hero.potions.mp })} icon="mppot" keyHint="2" count={fmt.format(hero.potions.mp)} />
      </div>

      {onFullscreen && fullscreenSupported && (
        <button
          type="button"
          onClick={onFullscreen}
          aria-label={fullscreenActive ? t('game.hud.exitFullscreen') : t('game.hud.fullscreen')}
          className={`${PANEL} pointer-events-auto right-2 top-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 font-label text-[10px]`}
        >
          <GameIcon name="map" size={1} />
          <kbd className="text-[9px] text-[#c3b2ff]">F</kbd>
        </button>
      )}
    </div>
  )
}
