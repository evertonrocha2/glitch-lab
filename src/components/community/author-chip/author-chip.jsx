import { Link } from 'react-router'
import PixelAvatar from '../../ui/pixel-avatar/pixel-avatar.jsx'

// Avatar, name and handle of whoever wrote an article or comment. Only public profiles link anywhere.
export default function AuthorChip({ author, meta, size = 'size-8' }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <PixelAvatar seed={author.avatar.seed} color={author.avatar.color} className={size} />
      <span className="min-w-0 leading-tight">
        {author.isPublic ? (
          <Link to={`/u/${author.handle}`} className="block truncate font-semibold text-ink hover:text-primary hover:underline">
            {author.name}
          </Link>
        ) : (
          <span className="block truncate font-semibold text-ink">{author.name}</span>
        )}
        <span className="block truncate text-xs text-muted">
          {author.handle && <span className="font-label text-[10px] text-secondary">@{author.handle}</span>}
          {author.handle && meta && ' · '}
          {meta}
        </span>
      </span>
    </span>
  )
}
