import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LOOK_OPTIONS, normalizeLook, randomLook } from '../../../shared/game/look.js'
import { createRng } from '../../../shared/game/rng.js'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'
import { HeroCanvas } from './hero/hero-canvas.jsx'
import { EYES, HAIR, OUTFIT, SKIN } from './hero/palette.js'
import { useActionRunner } from './panel/use-action.js'
import Frame, { SectionTitle } from './ui/frame.jsx'

// Each color option as a ramp [shadow, mid, light, highlight], for the swatches.
const RAMPS = {
  skin: SKIN.map((skin) => skin.t),
  hairColor: HAIR,
  eyeColor: EYES.map(({ i, I }) => [i, i, I, '#ffffff']),
  outfit: OUTFIT,
}

// The order the groups show in: who the hero is first (skin, hair, eyes), then the clothes.
const GROUPS = [
  { field: 'skin', kind: 'swatch' },
  { field: 'hairStyle', kind: 'head' },
  { field: 'hairColor', kind: 'swatch' },
  { field: 'eyeStyle', kind: 'head' },
  { field: 'eyeColor', kind: 'swatch' },
  { field: 'outfit', kind: 'swatch' },
]

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
// Tab stops: a radio group is one stop (its checked radio), as the browser does it.
const tabStops = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((el) => !(el.type === 'radio' && !el.checked))

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2c14e]'

// The character creator: six pickers beside a big live preview. Saving goes through onSave; the
// dialog closes when it resolves and shows the error inline when it rejects.
//   look: the hero's current look (normalized here). gear: gearOf(items), shown when the switch is on.
//   first: the hero never picked a look. Then the title invites, "Depois" (onLater) replaces "Cancelar",
//   and Escape or the backdrop do nothing, so the choice is always explicit.
//   onSave(look): resolves when saved. onClose(): hide. onLater(): first time only, skip for now.
export default function LookDialog({ look, gear, first = false, onSave, onClose, onLater }) {
  const { t } = useI18n()
  const titleId = useId()
  const introId = useId()
  const panel = useRef(null)
  const [draft, setDraft] = useState(() => normalizeLook(look))
  const hasGear = Boolean(gear) && Object.keys(gear).length > 0
  const [withGear, setWithGear] = useState(true)
  const { run, busy, notice } = useActionRunner()

  useEffect(() => {
    const opener = document.activeElement
    panel.current?.focus()
    return () => opener?.focus?.()
  }, [])

  const name = (field, index) => t(`game.look.${field}.${index}`)
  const names = Object.fromEntries(Object.keys(LOOK_OPTIONS).map((field) => [field, name(field, draft[field])]))
  const pick = (field, index) => setDraft((current) => ({ ...current, [field]: index }))
  const dismiss = first ? null : onClose

  function save() {
    run(
      () => onSave({ ...draft }),
      () => {
        onClose()
        return null
      },
    )
  }

  function onKeyDown(event) {
    // The game's shortcuts (F, I, K, M) listen on window: keys typed here stay here.
    event.stopPropagation()
    if (event.key === 'Escape') {
      dismiss?.()
      return
    }
    if (event.key !== 'Tab') return
    const items = tabStops(panel.current)
    if (items.length === 0) return
    const firstItem = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === panel.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      firstItem.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
      {dismiss ? (
        <button type="button" tabIndex={-1} aria-label={t('game.look.cancel')} onClick={dismiss} className="absolute inset-0 cursor-default bg-[#05040c]/80" />
      ) : (
        // First time there is no way out but a choice: a press outside keeps focus in the creator.
        <div
          aria-hidden="true"
          onMouseDown={(e) => {
            e.preventDefault()
            panel.current?.focus()
          }}
          className="absolute inset-0 bg-[#05040c]/80"
        />
      )}
      <Frame
        ref={panel}
        tone="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={introId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative flex max-h-[calc(100dvh-16px)] w-[min(940px,100%)] flex-col p-1 font-mono text-xs text-[#e9e4ff] shadow-[6px_6px_0_rgba(0,0,0,.5)] focus-visible:outline-none"
      >
        <header className="flex flex-col gap-1 border-b-2 border-[#0a0818] px-3 pb-2.5 pt-3 shadow-[0_2px_0_#3e3170]">
          <h2 id={titleId} className="m-0 font-pixel text-[17px] font-normal uppercase leading-none tracking-[0.06em] text-[#f2c14e] [text-shadow:2px_2px_0_#120c22]">
            {first ? t('game.look.titleFirst') : t('game.look.title')}
          </h2>
          <p id={introId} className="m-0 text-[11px] leading-snug text-[#a89fd0]">
            {t('game.look.intro')}
          </p>
        </header>

        <div className="gw-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
          <div className="grid gap-3 md:grid-cols-[300px_minmax(0,1fr)] md:items-start">
            <Stage
              look={draft}
              gear={hasGear && withGear ? gear : undefined}
              label={t('game.look.preview', names)}
              toggle={hasGear ? <GearSwitch on={withGear} onChange={setWithGear} label={t('game.look.gear')} /> : null}
            />
            <div className="flex min-w-0 flex-col gap-3">
              {GROUPS.map(({ field, kind }) => (
                <Picker key={field} field={field} kind={kind} draft={draft} label={t(`game.look.group.${field}`)} current={names[field]} name={name} onPick={pick} />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t-2 border-[#3e3170] px-2 pb-1.5 pt-2.5 shadow-[0_-2px_0_#0a0818]">
          {notice?.kind === 'error' && (
            <p role="alert" className="m-0 border-2 border-[#120c22] bg-[#2e0f1a] px-2 py-1.5 text-[11px] text-[#ffd3d9]">
              {notice.text}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <KitButton onClick={() => setDraft(randomLook(createRng(Date.now())))} disabled={busy}>
              <Die />
              {t('game.look.random')}
            </KitButton>
            <div className="flex flex-wrap items-center gap-2">
              {first ? (
                <KitButton onClick={onLater} disabled={busy}>
                  {t('game.look.later')}
                </KitButton>
              ) : (
                <KitButton onClick={onClose} disabled={busy}>
                  {t('game.look.cancel')}
                </KitButton>
              )}
              <KitButton primary onClick={save} disabled={busy}>
                {t('game.look.save')}
              </KitButton>
            </div>
          </div>
        </footer>
      </Frame>
    </div>,
    document.body,
  )
}

const WIDE = '(min-width: 768px)'

// True from the two-column width up. Without matchMedia (tests) it answers true.
function useWide() {
  const read = () => {
    try {
      return window.matchMedia ? window.matchMedia(WIDE).matches : true
    } catch {
      return true
    }
  }
  const [wide, setWide] = useState(read)
  useEffect(() => {
    let list = null
    try {
      list = window.matchMedia?.(WIDE) ?? null
    } catch {
      list = null
    }
    if (!list?.addEventListener) return undefined
    const onChange = () => setWide(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])
  return wide
}

// The preview: the hero on a lit stone, the gear switch under it. Wide, it is big (scale 5) beside the
// pickers. On a phone it is smaller (scale 3) and stays pinned at the top while the pickers scroll
// under it, so every pick shows on the hero.
function Stage({ look, gear, label, toggle }) {
  const wide = useWide()
  return (
    <Frame
      tone="inset"
      className="sticky top-0 z-10 flex min-w-0 items-center justify-center gap-3 p-2 shadow-[0_8px_0_#1b1433] md:min-h-[440px] md:self-stretch md:flex-col md:gap-4 md:p-3 md:shadow-none"
    >
      <div className="relative flex flex-col items-center pt-1">
        <HeroCanvas look={look} gear={gear} scale={wide ? 5 : 3} animate label={label} className="relative block h-auto max-w-full" />
        <div aria-hidden="true" className="-mt-3 flex w-full flex-col items-center md:-mt-4">
          <i className="block h-1 w-[46%] bg-[#574a96]" />
          <i className="block h-1.5 w-[56%] border-x-2 border-[#120c22] bg-[#3e3170]" />
          <i className="block h-2.5 w-[64%] border-x-2 border-[#120c22] bg-[#241c44]" />
          <i className="block h-0.5 w-[64%] bg-[#120c22]" />
        </div>
      </div>
      {toggle}
    </Frame>
  )
}

// A pixel on/off switch: a track with a square knob that slides and turns gold when on.
function GearSwitch({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex min-h-11 cursor-pointer items-center gap-2.5 px-1 font-pixel text-[11px] text-[#e9e4ff] hover:text-white ${FOCUS_RING}`}
    >
      <span aria-hidden="true" className={`relative block h-4 w-8 border-2 border-[#120c22] ${on ? 'bg-[#3a2c10]' : 'bg-[#100c20]'}`}>
        <span
          className={`absolute top-0 block size-3 ${on ? 'left-4 bg-[#f2c14e] shadow-[inset_-2px_-2px_0_#9a6a1c]' : 'left-0 bg-[#6a5bb0] shadow-[inset_-2px_-2px_0_#3e3170]'}`}
        />
      </span>
      {label}
    </button>
  )
}

// The option ids of a field: 0..count-1.
const optionsOf = (field) => Array.from({ length: LOOK_OPTIONS[field] }, (_, id) => id)

// One look field as a radio group: color swatches, or head chips that show the hero with that style.
// Real radios (visually hidden), so the browser gives one Tab stop per group and arrow keys inside it.
function Picker({ field, kind, draft, label, current, name, onPick }) {
  const headingId = useId()
  const group = useId()
  const options = optionsOf(field)
  const columns = options.length > 4 ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-4'
  const radio = (id) => ({
    type: 'radio',
    name: group,
    value: id,
    checked: draft[field] === id,
    onChange: () => onPick(field, id),
  })
  return (
    <div role="radiogroup" aria-labelledby={headingId} className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle id={headingId} className="min-w-0 flex-1">
          {label}
        </SectionTitle>
        <span aria-hidden="true" className="shrink-0 font-pixel text-[10px] text-[#e9e4ff]">
          {current}
        </span>
      </div>
      {kind === 'swatch' ? (
        <div className="flex flex-wrap gap-1">
          {options.map((id) => (
            <Swatch key={id} ramp={RAMPS[field][id]} radio={radio(id)} name={name(field, id)} />
          ))}
        </div>
      ) : (
        <div className={`grid gap-1.5 ${columns}`}>
          {options.map((id) => (
            <HeadChip key={id} look={{ ...draft, [field]: id }} radio={radio(id)} name={name(field, id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// A color option: a bevelled pixel tile of the ramp. Checked gets a gold ring and a notch under it.
function Swatch({ ramp, radio, name }) {
  const [shadow, mid, light, hi] = ramp
  return (
    <label className="relative grid size-10 cursor-pointer place-items-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-white">
      <input {...radio} aria-label={name} className="sr-only" />
      <span
        aria-hidden="true"
        className="block size-8 border-2 border-[#120c22]"
        style={{
          background: light,
          boxShadow: `inset 2px 2px 0 ${hi}, inset -2px -2px 0 ${shadow}, inset -4px -4px 0 ${mid}${radio.checked ? ', 0 0 0 2px #f2c14e' : ''}`,
        }}
      />
      {radio.checked && <i aria-hidden="true" className="absolute -bottom-0.5 left-1/2 block h-1 w-2 -translate-x-1/2 bg-[#f2c14e]" />}
    </label>
  )
}

// A style option: the hero's head with that style over its name. The name labels the radio.
function HeadChip({ look, radio, name }) {
  const on = radio.checked
  return (
    <Frame
      as="label"
      tone={on ? 'raised' : 'inset'}
      className={`flex min-w-0 cursor-pointer flex-col items-center gap-1 px-1 pb-1.5 pt-1.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-white ${on ? 'shadow-[0_0_0_2px_#f2c14e]' : 'hover:brightness-125'}`}
    >
      <input {...radio} className="sr-only" />
      <span aria-hidden="true" className="block">
        <HeroCanvas look={look} crop="head" scale={3} className="block" />
      </span>
      <span className={`max-w-full text-center font-pixel text-[9px] leading-tight ${on ? 'text-[#f2c14e]' : 'text-[#a89fd0]'}`}>{name}</span>
    </Frame>
  )
}

// A game button: raised, or solid gold for the main action.
function KitButton({ primary = false, onClick, disabled, children }) {
  return (
    <Frame
      as="button"
      type="button"
      tone="raised"
      onClick={onClick}
      disabled={disabled}
      style={primary ? { '--f-bg': '#f2c14e', '--f-hi': '#fff1b0', '--f-lo': '#9a6a1c' } : undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 px-4 font-pixel text-[11px] uppercase leading-none tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-60 ${primary ? 'text-[#120c22]' : 'text-[#e9e4ff] hover:text-white'}`}
    >
      {children}
    </Frame>
  )
}

// A pixel die for the random button: a bone tile with three pips on the diagonal.
function Die() {
  return (
    <span aria-hidden="true" className="relative block size-3.5 border-2 border-[#120c22] bg-[#e9e4ff]">
      <i className="absolute left-px top-px block size-0.5 bg-[#120c22] shadow-[3px_3px_0_#120c22,6px_6px_0_#120c22]" />
    </span>
  )
}
