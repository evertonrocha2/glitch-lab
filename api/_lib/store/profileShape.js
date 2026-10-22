// The public-facing profile shape, built the same way by every store (main and community).
// Accounts made before a field existed simply don't have it yet, so every field has a default.

// Local JSON store: fields sit on the user object in camelCase.
export const profileFromUser = (user) =>
  structuredClone({
    handle: user.handle ?? null,
    displayName: user.displayName ?? null,
    bio: user.bio ?? '',
    avatar: user.avatar ?? null,
    featuredBadges: user.featuredBadges ?? [],
    isPublic: user.isPublic ?? false,
    role: user.role ?? null,
    headline: user.headline ?? '',
    university: user.university ?? '',
    course: user.course ?? '',
    work: user.work ?? '',
    location: user.location ?? '',
    languages: user.languages ?? [],
    links: user.links ?? {},
    openTo: user.openTo ?? [],
    createdAt: user.createdAt,
  })

// Supabase: snake_case columns on public.users.
export const profileFromRow = (row) =>
  row && {
    handle: row.handle ?? null,
    displayName: row.display_name ?? null,
    bio: row.bio ?? '',
    avatar: row.avatar ?? null,
    featuredBadges: row.featured_badges ?? [],
    isPublic: row.is_public ?? false,
    role: row.role ?? null,
    headline: row.headline ?? '',
    university: row.university ?? '',
    course: row.course ?? '',
    work: row.work ?? '',
    location: row.location ?? '',
    languages: row.languages ?? [],
    links: row.links ?? {},
    openTo: row.open_to ?? [],
    createdAt: row.created_at,
  }

export const PROFILE_COLUMNS =
  'id, handle, display_name, bio, avatar, featured_badges, is_public, role, headline, university, course, work, location, languages, links, open_to, created_at'
