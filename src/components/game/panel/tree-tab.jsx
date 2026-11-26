import { useId, useMemo, useRef, useState } from 'react'
import { CHANCE } from '../../../../shared/game/combat-effects.js'
import { canAllocate, MAX_KEYSTONES, RESPEC_GOLD_PER_POINT, TALENTS } from '../../../../shared/game/talents.js'
import { capitalize } from '../../../lib/i18n/format.js'
import GameIcon from '../icons/game-icon.jsx'
import { useItemText } from '../item-tooltip/item-text.js'
import Frame, { Chip } from '../ui/frame.jsx'
import { ActionButton, ConfirmButton, GameDialog } from './panel-ui.jsx'
import SkillsView from './skills-view.jsx'
import TalentCanvas, { BRANCH_COLORS } from './talent-canvas.jsx'
const VIEWS = ['talents', 'skills']
const BRANCHES = ['logica', 'sintaxe', 'algoritmos']
const NODE_BY_ID = new Map(TALENTS.nodes.map((node) => [node.id, node]))
// Before the View carried branch counts: every requirement counts as unmet.
const NO_BRANCH = {}

// Where a node sits, for nodes whose name and kind repeat (many small nodes share stats): how many
// steps past the nearest named node (root, notable, keystone or bridge), and whether it is on a side path.
const PARENT = new Map()
for (const [from, to] of TALENTS.edges) if (!PARENT.has(to)) PARENT.set(to, from)
const SAME_NAME = new Map()
const nameKey = (node) => (node.kind === 'small' && node.branch !== 'bridge' ? `${node.branch}:${JSON.stringify(node.stats)}` : node.id)
for (const node of TALENTS.nodes) SAME_NAME.set(nameKey(node), (SAME_NAME.get(nameKey(node)) ?? 0) + 1)
function placeOf(node) {
  if (SAME_NAME.get(nameKey(node)) < 2) return null
  let steps = 0
  let at = node
  do {
    at = NODE_BY_ID.get(PARENT.get(at.id))
    steps++
  } while (at.kind === 'small' && at.branch !== 'bridge')
  return { steps, anchor: at, side: /-f\d+-/.test(node.id) }
}

// What a keystone's effect does, one line each; down lines are the price.
const EFFECT_LINES = {
  bruteForce: [['game.keystone.bruteForce', 'down']],
  strongTyping: [['game.keystone.strongTyping', 'up']],
  recursion: [
    ['game.keystone.recursion', 'up'],
    ['game.keystone.recursionCost', 'down'],
  ],
}
const EFFECT_VARS = { recursion: { chance: Math.round(CHANCE.recursion * 100) } }

// The queue as it still stands on top of the allocated nodes: in order, each one that can still be
// taken. Removing a node drops the queued nodes that hung on it.
function settle(allocated, queue, free, branch) {
  const have = [...allocated]
  const kept = []
  for (const id of queue) {
    if (canAllocate(have, id, { free: free - kept.length, branch }).ok) {
      kept.push(id)
      have.push(id)
    }
  }
  return kept
}

// Labels for talent nodes. Small nodes and bridges are named by their stats.
function useTalentText() {
  const text = useItemText()
  return useMemo(() => {
    const { t, locale } = text
    const branchName = (branch) => t(`game.branch.${branch}`)
    const name = (node) => (node.kind === 'small' ? capitalize(text.statsLine(node.stats), locale) : t(`game.talent.${node.id}`))
    const kind = (node) => {
      if (node.kind === 'root') return t('game.tree.kind.root')
      if (node.branch === 'bridge') return t('game.tree.kind.bridge')
      return t(`game.tree.kind.${node.kind}`, { branch: branchName(node.branch) })
    }
    // The hidden list's label: unique even when two small nodes give the same bonus.
    const listLabel = (node, state) => {
      const place = placeOf(node)
      const vars = { name: name(node), kind: kind(node), state: t(`game.tree.state.${state}`) }
      if (!place) return t('game.tree.node', vars)
      const where = t(place.side ? 'game.tree.where.side' : 'game.tree.where.main', { count: place.steps, anchor: name(place.anchor) })
      return t('game.tree.nodeWhere', { ...vars, where })
    }
    const lines = (node) => [
      ...Object.entries(node.stats ?? {}).map(([stat, value]) => ({ text: text.statLine(stat, value), trend: value < 0 ? 'down' : 'up' })),
      ...(EFFECT_LINES[node.effect] ?? []).map(([key, trend]) => ({ text: t(key, EFFECT_VARS[node.effect]), trend })),
    ]
    // "Precisa: 40 acertos em questões de Algoritmos (12 de 40)".
    const requirement = (node, branch) => {
      if (!node.requires) return null
      const { correct, branch: id } = node.requires
      const vars = { correct: text.number(correct), branch: branchName(id) }
      const have = branch?.[id]
      return typeof have === 'number'
        ? t('game.tree.requiresProgress', { ...vars, have: text.number(Math.min(have, correct)) })
        : t('game.tree.requires', vars)
    }
    // A refusal reason. With the node and the branch counts, a requirement says how many answers are missing.
    const why = (reason, node, branch) => {
      if (reason === 'requirement' && node?.requires && typeof branch?.[node.requires.branch] === 'number') {
        const left = node.requires.correct - branch[node.requires.branch]
        return t('game.talentWhy.requirementLeft', { count: left, branch: branchName(node.requires.branch) })
      }
      return t(`game.talentWhy.${reason}`, { count: MAX_KEYSTONES })
    }
    return { ...text, branchName, name, kind, listLabel, lines, requirement, why }
  }, [text])
}

// The Árvore tab: Talentos (the tree) and Habilidades (skills and loadout).
// Props: the panel's shared { view, actions, runner }; start: the first view ('talents' | 'skills').
export default function TreeTab({ view, actions, runner, start = 'talents' }) {
  const text = useTalentText()
  const { t } = text
  const [mode, setMode] = useState(VIEWS.includes(start) ? start : 'talents')
  return (
    <>
      <fieldset className="m-0 grid grid-cols-2 gap-1 border-0 p-0">
        <legend className="sr-only">{t('game.tree.views')}</legend>
        {VIEWS.map((id) => {
          const on = mode === id
          return (
            <Frame
              as="button"
              key={id}
              type="button"
              tone={on ? 'raised' : 'inset'}
              aria-pressed={on}
              onClick={() => setMode(id)}
              className={`min-h-11 cursor-pointer px-2 pb-1.5 pt-2 font-pixel text-[10px] leading-tight ${on ? 'text-white' : 'text-[#a89fd0] hover:text-[#e9e4ff]'}`}
            >
              {t(`game.tree.${id}`)}
              {on && <i aria-hidden="true" className="absolute inset-x-1 bottom-1 block h-0.5 bg-[#f2c14e]" />}
            </Frame>
          )
        })}
      </fieldset>
      {mode === 'talents' ? <TalentsView view={view} actions={actions} runner={runner} text={text} /> : <SkillsView view={view} actions={actions} runner={runner} />}
    </>
  )
}

function TalentsView({ view, actions, runner, text }) {
  const { t } = text
  const titleId = useId()
  const inlineCard = useRef(null)
  const dialogCard = useRef(null)
  const allocated = view.hero.talents
  const free = view.talentPoints?.free ?? 0
  const spent = view.talentPoints?.spent ?? 0
  const branch = view.study?.branch ?? NO_BRANCH
  const [rawQueue, setQueue] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [focusedId, setFocusedId] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const queue = useMemo(() => settle(allocated, rawQueue, free, branch), [allocated, rawQueue, free, branch])
  const owned = useMemo(() => new Set(['root', ...allocated]), [allocated])
  const queued = useMemo(() => new Set(queue), [queue])
  const left = free - queue.length
  const verdicts = useMemo(() => {
    const have = [...allocated, ...queue]
    return new Map(TALENTS.nodes.map((node) => [node.id, canAllocate(have, node.id, { free: left, branch })]))
  }, [allocated, queue, left, branch])
  const open = useMemo(() => new Set(TALENTS.nodes.filter((node) => verdicts.get(node.id).ok).map((node) => node.id)), [verdicts])
  const labels = useMemo(() => Object.fromEntries(BRANCHES.map((b) => [b, { name: text.branchName(b), sub: t(`game.branchSub.${b}`) }])), [text, t])

  const stateOf = (id) => (owned.has(id) ? 'owned' : queued.has(id) ? 'queued' : open.has(id) ? 'open' : 'locked')
  const selected = NODE_BY_ID.get(selectedId) ?? null

  // A refusal from the server names canAllocate's reason; say that instead of the generic line.
  const withReason = (call) => () =>
    call().catch((err) => {
      if (err?.reason) err.message = text.why(err.reason)
      throw err
    })
  const confirm = () => {
    const count = queue.length
    runner
      .run(
        withReason(() => actions.allocateTalents(queue)),
        () => t('game.tree.allocated', { count }),
      )
      .then((done) => done && setQueue([]))
  }
  const respecCost = RESPEC_GOLD_PER_POINT * spent
  const respecWhy = spent === 0 ? t('game.why.nothingToRespec') : view.hero.gold < respecCost ? t('game.why.gold') : null
  const respec = () =>
    runner.run(() => actions.respecTalents(), () => t('game.tree.respecDone')).then((done) => done && setQueue([]))

  // The pieces shown both in the tab and in the expanded dialog.
  const canvas = (
    <Frame tone="inset" className="p-1">
      <TalentCanvas owned={owned} queued={queued} open={open} selected={focusedId ?? selectedId} labels={labels} onSelect={setSelectedId} />
    </Frame>
  )
  const nodeList = (cardRef) => (
    <ul aria-label={t('game.tree.list')} className="sr-only">
      {TALENTS.nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            aria-current={node.id === selectedId ? 'true' : undefined}
            onFocus={() => setFocusedId(node.id)}
            onBlur={() => setFocusedId(null)}
            onClick={() => {
              setSelectedId(node.id)
              // The card says what the node gives; move there so it is read next.
              requestAnimationFrame(() => cardRef.current?.focus())
            }}
          >
            {text.listLabel(node, stateOf(node.id))}
          </button>
        </li>
      ))}
    </ul>
  )
  const card = (cardRef) =>
    selected ? (
      <TalentCard
        key={selected.id}
        node={selected}
        state={stateOf(selected.id)}
        why={verdicts.get(selected.id).ok ? null : text.why(verdicts.get(selected.id).reason, selected, branch)}
        requirement={text.requirement(selected, view.study?.branch)}
        busy={runner.busy}
        text={text}
        headingRef={cardRef}
        onTake={() => setQueue([...queue, selected.id])}
        onUnqueue={() => setQueue(queue.filter((id) => id !== selected.id))}
      />
    ) : (
      <p className="m-0 text-[11px] text-[#a89fd0]">{t('game.tree.pick')}</p>
    )
  const queueBar =
    queue.length > 0 ? (
      <Frame as="section" aria-label={t('game.tree.queue', { count: queue.length })} className="flex flex-col gap-2 p-2.5">
        <p className="m-0 font-pixel text-[10px] text-[#7fffe9]">{t('game.tree.queue', { count: queue.length })}</p>
        <span className="flex flex-wrap gap-1.5">
          <ActionButton tone="gold" busy={runner.busy} onClick={confirm}>
            {t('game.tree.confirm', { count: queue.length })}
          </ActionButton>
          <ActionButton busy={runner.busy} onClick={() => setQueue([])}>
            {t('game.tree.clear')}
          </ActionButton>
        </span>
      </Frame>
    ) : null
  const freeLine = (
    <span className="flex items-center gap-1.5">
      <span className="font-pixel text-[10px] text-[#e9e4ff]">{t('game.tree.free')}</span>
      <Chip tone="gold" className="text-[10px]">
        {text.number(left)}
      </Chip>
    </span>
  )

  return (
    <>
      <div className="flex flex-col gap-1 text-[11px]">
        <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1">
          {freeLine}
          <span className="text-[#a89fd0]">{t('game.tree.respecRate', { gold: text.number(RESPEC_GOLD_PER_POINT) })}</span>
        </p>
        <small className="text-[10px] text-[#a89fd0]">{t('game.tree.hint')}</small>
      </div>

      {expanded ? null : canvas}
      <span>
        <ActionButton onClick={() => setExpanded(true)}>{t('game.tree.expand')}</ActionButton>
      </span>
      {nodeList(inlineCard)}

      <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[10px] text-[#a89fd0]">
        <Legend shape="rounded-full size-2.5" color="#4a4266">
          {t('game.tree.legend.small')}
        </Legend>
        <Legend shape="rounded-full size-3.5" color="#4a4266">
          {t('game.tree.legend.notable')}
        </Legend>
        <Legend shape="size-3 rotate-45" color="#4a4266">
          {t('game.tree.legend.keystone')}
        </Legend>
        <Legend shape="rounded-full size-2.5 shadow-[0_0_6px_#fff]" color="#ffffff">
          {t('game.tree.legend.open')}
        </Legend>
        <Legend shape="rounded-full size-2.5" color="#7fffe9">
          {t('game.tree.legend.queued')}
        </Legend>
      </ul>

      {card(inlineCard)}
      {queueBar}

      <span>
        <ConfirmButton
          busy={runner.busy}
          why={respecWhy}
          confirmLabel={t('game.tree.respecYes', { gold: text.number(respecCost) })}
          cancelLabel={t('game.act.cancel')}
          onConfirm={respec}
        >
          {t('game.tree.respec', { gold: text.number(respecCost) })}
        </ConfirmButton>
      </span>

      {expanded && (
        <GameDialog titleId={titleId} title={t('game.tree.title')} closeLabel={t('game.tree.close')} onClose={() => setExpanded(false)}>
          <p className="m-0 text-[11px]">{freeLine}</p>
          {canvas}
          {nodeList(dialogCard)}
          <p role="status" className="m-0 min-h-4 text-[11px] text-[#6fe39a]">
            {runner.notice?.kind === 'ok' ? runner.notice.text : ''}
          </p>
          <p role="alert" className="m-0 text-[11px] text-[#ff9aa6]">
            {runner.notice?.kind === 'error' ? runner.notice.text : ''}
          </p>
          <div className="grid items-start gap-2 sm:grid-cols-2">
            {card(dialogCard)}
            {queueBar}
          </div>
        </GameDialog>
      )}
    </>
  )
}

function Legend({ shape, color, children }) {
  return (
    <li className="flex items-center gap-1.5">
      <i aria-hidden="true" className={`inline-block border-2 ${shape}`} style={{ borderColor: color }} />
      {children}
    </li>
  )
}

// The selected node: name, kind, what it gives, its requirement and Take / Remove from queue.
function TalentCard({ node, state, why, requirement, busy, text, headingRef, onTake, onUnqueue }) {
  const { t } = text
  const titleId = useId()
  const color = BRANCH_COLORS[node.branch]
  return (
    <Frame
      as="section"
      aria-labelledby={titleId}
      className="p-2.5"
      style={{ '--f-hi': color, '--f-lo': `color-mix(in srgb, ${color} 40%, #0a0818)` }}
    >
      <div className="mb-2 flex items-center gap-2 border-b-2 border-[#0a0818] pb-2 shadow-[0_2px_0_#3e3170]">
        <GameIcon name={node.icon} size={node.kind === 'keystone' ? 2 : 1} />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className="m-0 font-pixel text-[12px] font-normal leading-tight text-white focus-visible:outline-2 focus-visible:outline-[#f2c14e]">
            {text.name(node)}
          </h3>
          <small className="text-[#a89fd0]">{text.kind(node)}</small>
        </div>
      </div>
      {node.kind !== 'root' && (
        <ul className="m-0 mb-1.5 pl-3.5 text-[#8fb8ff]">
          {text.lines(node).map((line) => (
            <li key={line.text} data-trend={line.trend} className={line.trend === 'down' ? 'text-[#ff9aa6]' : undefined}>
              {line.text}
            </li>
          ))}
        </ul>
      )}
      {requirement && <p className="m-0 mb-1.5 text-[#a89fd0]">{requirement}</p>}
      {state === 'owned' && <p className="m-0 text-[#6fe39a]">{t('game.tree.have')}</p>}
      {state === 'queued' && (
        <span className="flex flex-col gap-1">
          <small className="text-[#7fffe9]">{t('game.tree.inQueue')}</small>
          <span>
            <ActionButton busy={busy} onClick={onUnqueue}>
              {t('game.tree.unqueue')}
            </ActionButton>
          </span>
        </span>
      )}
      {(state === 'open' || state === 'locked') && (
        <ActionButton tone="gold" busy={busy} why={why} onClick={onTake}>
          {t('game.tree.take')}
        </ActionButton>
      )}
    </Frame>
  )
}
