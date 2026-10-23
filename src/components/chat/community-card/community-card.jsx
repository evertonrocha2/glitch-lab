import { Link } from 'react-router'
import { useT } from '../../../lib/i18n/I18nProvider.jsx'
import CommunityBadge from '../community-badge/community-badge.jsx'

export function TopicChips({ topics, className = '' }) {
  const t = useT()
  if (!topics?.length) return null
  return (
    <ul aria-label={t('chat.communities.topics')} className={`flex flex-wrap gap-1.5 ${className}`}>
      {topics.map((topic) => (
        <li key={topic} className="border-2 border-ink bg-mist px-1.5 py-0.5 font-label text-[10px] text-ink">
          {t(`chat.topic.${topic}`)}
        </li>
      ))}
    </ul>
  )
}

// One community in a list: its tile, name, description, topics and member count.
export default function CommunityCard({ community }) {
  const t = useT()
  return (
    <article className="flex w-full flex-col border-2 border-ink bg-white p-4 shadow-pixel-ink">
      <div className="flex items-start gap-3">
        <CommunityBadge color={community.color} icon={community.icon} className="size-12" />
        <div className="min-w-0 flex-1">
          <h3 className="font-pixel text-lg leading-tight font-bold wrap-break-word text-ink">
            <Link to={`/communities/${community.slug}`} className="hover:text-primary focus-visible:text-primary">
              {community.name}
            </Link>
          </h3>
          <p className="mt-1 font-label text-[10px] text-muted">
            {t('chat.communities.members', { count: community.memberCount })}
            {community.joined && <span className="ml-2 bg-secondary px-1 py-0.5 text-white">{t('chat.communities.joined')}</span>}
          </p>
        </div>
      </div>
      {community.description && <p className="mt-3 line-clamp-2 text-sm wrap-break-word text-muted">{community.description}</p>}
      <TopicChips topics={community.topics} className="mt-auto pt-3" />
    </article>
  )
}
