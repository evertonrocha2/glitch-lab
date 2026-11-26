import { useId, useMemo } from 'react'
import { zoneDef } from '../../../../shared/game/zones.js'
import GameIcon from '../icons/game-icon.jsx'
import { ActionButton } from '../panel/panel-ui.jsx'
import Bar from '../ui/bar.jsx'
import Frame, { Chip, SectionTitle } from '../ui/frame.jsx'
import { GoButton } from './npc-ui.jsx'

const ICONS = { hunt: 'sword', acertos: 'book', boss: 'skull', daily: 'scroll', duel: 'honor' }
// Where each quest gets done: the study pages (in the study window when the page has one), or the
// World tab for the hunts and bosses.
const GO = {
  acertos: { label: 'gameNpc.go.study' },
  daily: { label: 'gameNpc.go.daily', href: '/daily' },
  duel: { label: 'gameNpc.go.duel', href: '/duel' },
  hunt: { label: 'gameNpc.go.world', tab: 'world' },
  boss: { label: 'gameNpc.go.world', tab: 'world' },
}
const DONE = '#6fe39a'
const GOING = '#5b8fc7'

// The Quadro de missões: today's quests with progress, rewards (XP already at the study multiplier),
// Claim for the done ones, the all-done bonus chest, and a way to where each quest gets done.
export default function QuestsView({ view, actions, runner, text, onTab, studyHref }) {
  const { t, locale } = text
  const titleId = useId()
  const { quests, bonus } = view.npc.quests
  const mult = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [locale])

  const titleOf = (quest) => {
    if (quest.kind !== 'hunt') return t(`gameNpc.quest.${quest.kind}`, { target: text.number(quest.target) })
    const zone = zoneDef(quest.where?.world, quest.where?.zone)
    const place = zone ? `${t(`world.name.${quest.where.world}`)}, ${t(`game.zone.${zone.name}`)}` : t(`world.name.${quest.where?.world}`)
    return t('gameNpc.quest.hunt', { target: text.number(quest.target), zone: place })
  }
  const claim = (quest) =>
    runner.run(
      () => actions.claimQuest(quest.id),
      (result) => {
        const got = result?.quest ?? { reward: quest.reward, chests: 0 }
        const line = t('gameNpc.quest.got', { gold: text.number(got.reward.gold), xp: text.number(got.reward.xp), fragments: text.number(got.reward.fragments) })
        return got.chests > 0 ? `${line}. ${t('gameNpc.quest.gotAll', { count: got.chests })}` : line
      },
    )
  const goOf = (quest) => {
    const go = GO[quest.kind]
    if (!go) return null
    if (go.tab) return onTab ? <GoButton onClick={() => onTab(go.tab)}>{t(go.label)}</GoButton> : null
    return <GoButton href={go.href ?? studyHref ?? '/daily'}>{t(go.label)}</GoButton>
  }

  return (
    <Frame as="section" aria-labelledby={titleId} className="flex flex-col gap-2 p-2.5" style={{ '--f-hi': '#6b604a' }}>
      <SectionTitle id={titleId} level={4}>
        {t('gameNpc.quests.title')}
      </SectionTitle>
      <p className="m-0 -mt-1 text-[11px] leading-snug text-[#b0b6c1]">
        <span>{t('gameNpc.quest.xpNote', { mult: mult.format(view.study?.xpMultiplier ?? 1) })}</span> <span>{t('gameNpc.quest.resets')}</span>
      </p>
      <ul aria-labelledby={titleId} className="m-0 flex list-none flex-col gap-2 p-0">
        {quests.map((quest) => {
          const title = titleOf(quest)
          const ready = quest.done && !quest.collected
          return (
            <li
              key={quest.id}
              aria-label={title}
              data-state={quest.collected ? 'collected' : ready ? 'ready' : 'open'}
              className={`flex flex-col gap-1.5 border-2 p-2 ${ready ? 'border-[#9a6a1c] bg-[#2a2619]' : 'border-[#0e1116] bg-[#1b2029]'} ${quest.collected ? 'opacity-70' : ''}`}
            >
              <span className="flex items-start gap-2">
                <GameIcon name={ICONS[quest.kind] ?? 'scroll'} size={2} className="shrink-0" />
                <b className="min-w-0 flex-1 pt-0.5 text-[11px] font-bold leading-snug text-[#efe3c2]">{title}</b>
                {quest.collected && <Chip tone="ok">{t('gameNpc.quest.collected')}</Chip>}
              </span>
              <Bar
                value={quest.progress}
                max={quest.target}
                label={title}
                text={`${text.number(quest.progress)} / ${text.number(quest.target)}`}
                color={quest.done ? DONE : GOING}
                className="h-4"
              />
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className="flex flex-wrap items-center gap-2 text-[11px] text-white">
                  <span className="sr-only">{t('gameNpc.quest.reward')}</span>
                  <span className="inline-flex items-center gap-1">
                    <GameIcon name="coins" size={1} label={t('game.cur.gold')} />+{text.number(quest.reward.gold)}
                  </span>
                  <b className="font-pixel text-[10px] font-normal text-[#9ec3ea]">{t('gameNpc.quest.xp', { xp: text.number(quest.reward.xp) })}</b>
                  <span className="inline-flex items-center gap-1">
                    <GameIcon name="fragment" size={1} label={t('game.cur.fragments')} />+{text.number(quest.reward.fragments)}
                  </span>
                </span>
                <span className="ml-auto flex gap-1.5">
                  {ready && (
                    <ActionButton tone="gold" busy={runner.busy} onClick={() => claim(quest)}>
                      {t('gameNpc.quest.claim')}
                    </ActionButton>
                  )}
                  {!quest.done && goOf(quest)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className={`m-0 flex items-center gap-2 border-t-2 border-[#0e1116] pt-2 text-[11px] shadow-[inset_0_2px_0_#2c3340] ${bonus.collected ? 'text-[#6fe39a]' : 'text-[#efe3c2]'}`}>
        <GameIcon name="chest" size={1} />
        {bonus.collected
          ? t('gameNpc.quest.bonusDone')
          : t('gameNpc.quest.bonus', { count: quests.length, chests: t('gameNpc.quest.chests', { count: bonus.chests }) })}
      </p>
    </Frame>
  )
}
