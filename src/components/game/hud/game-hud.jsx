import { useEffect, useMemo, useRef } from 'react'
import { DIFFICULTIES } from '../../../../shared/game/enemies.js'
import { SKILLS } from '../../../../shared/game/skills.js'
import { useI18n } from '../../../lib/i18n/I18nProvider.jsx'
import { gearOf } from '../hero/gear.js'
import { HeroCanvas } from '../hero/hero-canvas.jsx'
import GameIcon from '../icons/game-icon.jsx'
import Bar from '../ui/bar.jsx'
import Frame, { Chip } from '../ui/frame.jsx'
import { RARITY_TRIM } from '../ui/tokens.js'

// The bar fills: flat pixel colors, the Bar adds its own light and dark rows.
const FILL = { hp: '#d8364c', mp: '#3a78e0', xp: '#8f62f0', boss: '#3fb867' }
// What a log line reads as: damage the hero takes is red, dealt light, crits gold, healing green,
// shields and potions green too, loot in its rarity's trim (set inline), the rest (dodge, phases) muted.
const LOG_TONE_CLASS = {
  bad: 'text-[#ff7a85]',
  dealt: 'text-[#e9e4ff]',
  crit: 'gw-log-crit text-[#f2c14e]',
  good: 'text-[#7dffb0]',
  loot: '',
  info: 'text-[#a89fd0]',
}
const KIND_TONE = { hurt: 'bad', heal: 'good', shield: 'good', potion: 'good', hit: 'dealt', skill: 'dealt', dot: 'dealt', crit: 'crit' }
// The newest line (last) is fully lit, each older one dimmer.
const LOG_FADE = [1, 0.78, 0.6, 0.46, 0.34]
// The log's fill lets the scene show through; outline and bevel stay solid.
const LOG_BG = 'rgba(16, 12, 32, 0.72)'
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

// One action slot: a sunk 44px box, the key as a chip top left, the cooldown over it, a count badge
// for potions. Empty slots show a faint plus.
function Slot({ label, icon, keyHint, cooldown, count, className = '' }) {
  const cooling = cooldown > 0
  return (
    <Frame tone="inset" data-testid="slot" data-empty={icon ? undefined : ''} aria-label={label} role="group" className={`grid size-11 shrink-0 place-items-center ${className}`}>
      {icon ? (
        <GameIcon name={icon} size={2} className={cooling ? 'opacity-35' : ''} />
      ) : (
        <span aria-hidden="true" className="relative block size-2.5">
          <i className="absolute inset-x-0 top-1 block h-0.5 bg-[#3e3170]" />
          <i className="absolute inset-y-0 left-1 block w-0.5 bg-[#3e3170]" />
        </span>
      )}
      {cooling && <i className="absolute inset-0 grid place-items-center bg-black/55 font-label text-[13px] not-italic">{cooldown}s</i>}
      <kbd className="absolute left-0.5 top-0.5 z-10 border border-[#120c22] bg-[#120c22] px-0.5 font-pixel text-[8px] leading-none text-[#c3b2ff]">{keyHint}</kbd>
      {count !== undefined && (
        <Chip tone="ink" className="absolute bottom-0 right-0 z-10 text-[9px]">
          {count}
        </Chip>
      )}
    </Frame>
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
  const gear = useMemo(() => gearOf(hero.items), [hero.items])
  const maxHp = stats.hp
  const maxMana = stats.mana
  const hp = live.hp ?? maxHp
  const mana = live.mana ?? maxMana
  const nums = (now, max) => `${fmt.format(Math.round(now))} / ${fmt.format(Math.round(max))}`
  const active = hero.hunt?.difficulty ?? 'normal'
  const events = log.slice(-LOG_SIZE)
  const cooldowns = live.cooldowns ?? {}

  const lineOf = (ev) => {
    const kind = ev.who === 'enemy' && (ev.type === 'hit' || ev.type === 'skill') ? 'hurt' : ev.type
    const key = `game.log.${kind}`
    const skill = ev.skill && SKILL_BY_ID[ev.skill] ? t(`game.skill.${ev.skill}`) : (ev.skill ?? '')
    const text = t(key, { amount: fmt.format(Math.round(ev.amount ?? 0)), skill })
    const rarity = ev.rarity && Object.hasOwn(RARITY_TRIM, ev.rarity) ? ev.rarity : undefined
    const tone = rarity ? 'loot' : kind !== 'hurt' && ev.crit ? 'crit' : (KIND_TONE[kind] ?? 'info')
    return { tone, rarity, text: text === key ? t('game.log.other') : text }
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this only names the overlay.
    <div role="group" aria-label={t('game.hud.label')} className="pointer-events-none absolute inset-0 font-pixel text-[#e9e4ff]">
      <Frame className="pointer-events-auto absolute left-2 top-2 flex items-start gap-2 p-1.5">
        <div className="relative shrink-0">
          <Frame tone="inset" className="p-1 leading-none">
            <HeroCanvas look={hero.look} gear={gear} crop="head" scale={2} label={t('game.hero.doll')} className="block" />
          </Frame>
          <Chip tone="gold" data-testid="level-badge" aria-hidden="true" className="absolute -bottom-1 -right-1.5 z-10">
            {level.level}
          </Chip>
        </div>
        <div className="flex w-[136px] flex-col gap-1">
          <span className="sr-only">{t('game.hud.level', { level: level.level })}</span>
          <Bar label={t('game.hud.hp')} value={Math.round(hp)} max={Math.round(maxHp)} text={nums(hp, maxHp)} color={FILL.hp} className="h-4" />
          <Bar label={t('game.hud.mana')} value={Math.round(mana)} max={Math.round(maxMana)} text={nums(mana, maxMana)} color={FILL.mp} className="h-4" />
          <Bar label={t('game.hud.xp')} value={level.into} max={level.needed} text={nums(level.into, level.needed)} color={FILL.xp} className="h-4" />
          {live.buffs?.length > 0 && (
            <ul aria-label={t('game.hud.buffs')} className="mt-0.5 flex gap-1">
              {live.buffs.map((b) => (
                <li key={b.id} className={`relative border-2 p-px ${b.bad ? 'border-[#ff5a6e] bg-[#2e0f1a]' : 'border-[#4fd1c5] bg-[#10263a]'}`}>
                  <GameIcon name={b.icon} size={1} />
                  <em className="absolute -bottom-1 -right-1 bg-[#120c22] px-0.5 text-[8px] not-italic">{t('game.hud.seconds', { seconds: b.seconds })}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Frame>

      {boss && (
        <Frame className="pointer-events-auto absolute inset-x-2 top-[160px] p-1.5 sm:inset-x-auto sm:left-1/2 sm:top-2 sm:w-[250px] sm:-translate-x-[30%]">
          <div className="mb-1 flex items-center gap-1.5 text-[11px]">
            <GameIcon name="skull" size={1} />
            <b className="truncate">{boss.name}</b>
            <span className="shrink-0 text-[10px] text-[#a89fd0]">{t('game.hud.phase', { phase: boss.phase, phases: boss.phases })}</span>
            {boss.enrageSec !== undefined && <span className="ml-auto shrink-0 text-[10px] text-[#ff8a5c]">{t('game.hud.enrage', { time: clock(boss.enrageSec) })}</span>}
          </div>
          <Bar label={boss.name} value={Math.round(boss.hp)} max={Math.round(boss.maxHp)} text={nums(boss.hp, boss.maxHp)} color={FILL.boss} className="h-4" />
        </Frame>
      )}

      <Frame as="ul" aria-label={t('game.hud.difficulties')} className="pointer-events-auto absolute right-2 top-[92px] flex gap-1 p-1 sm:top-[68px]">
        {Object.entries(DIFFICULTIES).map(([id, d]) => {
          const locked = level.level < d.minLevel
          const name = t(`game.diff.${id}`)
          const current = id === active
          return (
            <li
              key={id}
              aria-current={current ? 'true' : undefined}
              aria-label={locked ? `${name}, ${t('game.hud.locked', { level: d.minLevel })}` : undefined}
              className="flex"
            >
              <Chip tone={current ? 'gold' : locked ? 'ink' : 'muted'} className={`gap-1 py-0.5 ${locked ? 'text-[#8a80b8]' : ''}`}>
                {name}
                {locked && <small className="text-[8px] font-normal text-[#a89fd0]">{t('game.hud.minLevel', { level: d.minLevel })}</small>}
              </Chip>
            </li>
          )
        })}
      </Frame>

      {/* Empty, the log stays in place for screen readers but draws nothing. aria-live off: it ticks all the time, so it is read on demand, never announced. */}
      <Frame
        role="log"
        aria-live="off"
        aria-label={t('game.hud.log')}
        style={{ '--f-bg': LOG_BG }}
        className={`absolute bottom-[70px] left-2 w-[270px] max-w-[calc(100%-1rem)] px-2.5 py-1.5 text-[10px] ${events.length ? '' : 'opacity-0'}`}
      >
        <ul>
          {events.map((ev, i) => {
            const line = lineOf(ev)
            const age = events.length - 1 - i
            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: events can share a time; the window only slides, never reorders.
                key={`${ev.t ?? i}-${i}`}
                data-tone={line.tone}
                data-rarity={line.rarity}
                className={`my-px truncate ${LOG_TONE_CLASS[line.tone]}`}
                style={{ opacity: LOG_FADE[age] ?? LOG_FADE.at(-1), color: line.rarity ? RARITY_TRIM[line.rarity] : undefined }}
              >
                {line.text}
              </li>
            )
          })}
        </ul>
      </Frame>

      <Frame className="pointer-events-auto absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 p-1.5">
        {hero.skills.loadout.map((id, i) => {
          const name = id ? t(`game.skill.${id}`) : t('game.hud.emptySlot')
          const cd = id ? Math.ceil(cooldowns[id] ?? 0) : 0
          return (
            <Slot
              // biome-ignore lint/suspicious/noArrayIndexKey: a loadout slot is a fixed position (Q, W, E, R).
              key={`${id ?? 'empty'}-${i}`}
              label={cd > 0 ? t('game.hud.slotCd', { name, seconds: cd }) : name}
              icon={id ? SKILL_BY_ID[id]?.icon : undefined}
              keyHint={SKILL_KEYS[i]}
              cooldown={cd}
            />
          )
        })}
        <i aria-hidden="true" className="mx-0.5 block w-0.5 self-stretch bg-[#0a0818] shadow-[1px_0_0_#3e3170]" />
        <Slot label={t('game.hud.potionHp', { count: hero.potions.hp })} icon="hppot" keyHint="1" count={fmt.format(hero.potions.hp)} />
        <Slot label={t('game.hud.potionMp', { count: hero.potions.mp })} icon="mppot" keyHint="2" count={fmt.format(hero.potions.mp)} />
      </Frame>

      {onFullscreen && fullscreenSupported && (
        <Frame
          as="button"
          tone="raised"
          type="button"
          onClick={onFullscreen}
          aria-label={fullscreenActive ? t('game.hud.exitFullscreen') : t('game.hud.fullscreen')}
          className="pointer-events-auto absolute right-2 top-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 px-2 font-label text-[10px]"
        >
          <GameIcon name="map" size={1} />
          <kbd className="text-[9px] text-[#c3b2ff]">F</kbd>
        </Frame>
      )}
    </div>
  )
}
