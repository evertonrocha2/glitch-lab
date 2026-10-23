import { useState } from 'react'
import { youtubeId } from '../../../shared/events.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useFormat } from '../../lib/i18n/format.js'
import AuthorChip from '../community/AuthorChip.jsx'
import EventIcon from './EventIcon.jsx'
import Medal from './Medal.jsx'

const LINKS = [
  { field: 'repoUrl', kind: 'repo', icon: 'code' },
  { field: 'videoUrl', kind: 'video', icon: 'play' },
  { field: 'demoUrl', kind: 'demo', icon: 'globe' },
]

// The site a link goes to, shown so nobody clicks blind.
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// A link to somewhere else: always a new tab, never passing our page along, never vouched for.
function LinkCard({ url, kind, icon }) {
  const t = useT()
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="group flex min-w-0 items-center gap-2 border-2 border-ink bg-white px-2.5 py-1.5 text-ink transition-colors hover:bg-primary-soft"
    >
      <EventIcon name={icon} className="size-3.5 text-primary" />
      <span className="font-label text-xs">{t(`events.link.${kind}`)}</span>
      <span className="min-w-0 truncate font-mono text-[11px] text-muted">{hostOf(url)}</span>
      <span className="sr-only">{t('events.link.newTab')}</span>
      <EventIcon name="arrow" className="ml-auto size-3 text-muted group-hover:text-primary" />
    </a>
  )
}

// YouTube only, through its no-cookie player, and only after a click: nothing loads from YouTube
// until the reader asks. The sandbox keeps the player from opening popups or navigating the page.
function VideoEmbed({ id, title }) {
  const t = useT()
  const [playing, setPlaying] = useState(false)
  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="relative grid aspect-video w-full place-items-center overflow-hidden border-2 border-ink bg-secondary-soft text-ink hover:bg-primary-soft"
      >
        <span aria-hidden="true" className="dither-secondary absolute inset-0 opacity-20" />
        <span className="relative flex items-center gap-2 border-2 border-ink bg-white px-3 py-2 font-label text-xs shadow-pixel">
          <EventIcon name="play" className="size-4 text-primary" />
          {t('events.video.play')}
        </span>
      </button>
    )
  }
  return (
    <iframe
      src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
      title={t('events.video.title', { title })}
      sandbox="allow-scripts allow-same-origin allow-presentation"
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      loading="lazy"
      className="aspect-video w-full border-2 border-ink bg-ink"
    />
  )
}

// One entry in the gallery: rank, medal, author, description, links and the vote button.
// canVote: voting is open for this viewer (not their own entry). onVote: signed out sends them to sign in.
export default function EntryCard({ entry, voted, canVote, busy, onVote }) {
  const t = useT()
  const { timeAgo } = useFormat()
  const video = youtubeId(entry.videoUrl)
  return (
    <article
      aria-label={entry.title}
      className={`flex w-full min-w-0 flex-col border-2 border-ink bg-white p-4 sm:p-5 ${entry.place ? 'shadow-pixel' : entry.mine ? 'shadow-pixel-secondary' : 'shadow-pixel-muted'}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid min-w-9 place-items-center border-2 border-ink bg-mist px-1 py-0.5 font-pixel text-sm font-bold text-ink" title={t('events.entry.rank', { rank: entry.rank })}>
          <span className="sr-only">{t('events.entry.rank', { rank: entry.rank })}</span>
          <span aria-hidden="true">#{entry.rank}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-pixel text-lg font-bold leading-tight text-ink">{entry.title}</h3>
          <div className="mt-2">
            <AuthorChip author={entry.author} meta={timeAgo(entry.createdAt)} size="size-6" />
          </div>
        </div>
        {entry.place && <Medal place={entry.place} className="size-9" />}
        {entry.mine && !entry.place && <span className="bg-secondary px-1.5 py-0.5 font-label text-[10px] text-white">{t('events.entry.yours')}</span>}
      </div>

      {entry.description && <p className="mt-3 whitespace-pre-line break-words text-sm text-ink/85">{entry.description}</p>}
      {video && (
        <div className="mt-3">
          <VideoEmbed id={video} title={entry.title} />
        </div>
      )}

      <span aria-hidden="true" className="min-h-3 flex-1" />
      <div className="mt-3 grid gap-2">
        {LINKS.filter(({ field }) => entry[field]).map(({ field, kind, icon }) => (
          <LinkCard key={field} url={entry[field]} kind={kind} icon={icon} />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-dashed border-line pt-3">
        <span className="font-label text-xs text-ink">{t('events.entry.votes', { count: entry.votes })}</span>
        {!entry.mine && (
          <button
            type="button"
            aria-pressed={voted}
            aria-label={t('events.entry.voteLabel', { label: voted ? t('events.entry.voted') : t('events.entry.vote'), title: entry.title, count: entry.votes })}
            disabled={!canVote || busy}
            onClick={onVote}
            className={`flex items-center gap-2 border-2 border-ink px-3 py-1.5 font-label text-xs transition-[translate,box-shadow] duration-100 active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60 ${
              voted ? 'bg-primary text-white shadow-pixel-ink' : 'bg-white text-ink hover:bg-mist'
            }`}
          >
            <EventIcon name="vote" className="size-3.5" />
            {voted ? t('events.entry.voted') : t('events.entry.vote')}
          </button>
        )}
      </div>
    </article>
  )
}
