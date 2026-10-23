// Profile rules shared by the API (which enforces them) and the editor (which hints at them).
export const PROFILE_LIMITS = {
  handleMin: 3,
  handleMax: 20,
  displayName: 40,
  bio: 160,
  seed: 40,
  featured: 3,
  // "About you": short single lines, a few chips, and links.
  headline: 80,
  university: 80,
  course: 80,
  work: 80,
  location: 60,
  languages: 8,
  link: 200,
}

// Purple, blue and gray only, like the rest of Pixel Lab. The first one is the default.
export const AVATAR_COLORS = [
  { id: 'violet', name: 'Violet' },
  { id: 'cobalt', name: 'Cobalt' },
  { id: 'grape', name: 'Grape' },
  { id: 'sky', name: 'Sky' },
  { id: 'ink', name: 'Ink' },
]

const HANDLE_CHARS = /^[a-z0-9_-]+$/

// Handles are shown as @handle, so a leading @ (typed or pasted from a link) is dropped.
export const normalizeHandle = (value) => value.trim().replace(/^@+/, '').toLowerCase()

// A message saying what's wrong with the handle, or null when it's fine.
export function handleProblem(handle) {
  if (handle.length < PROFILE_LIMITS.handleMin) return `Use at least ${PROFILE_LIMITS.handleMin} characters.`
  if (handle.length > PROFILE_LIMITS.handleMax) return `Use up to ${PROFILE_LIMITS.handleMax} characters.`
  if (!HANDLE_CHARS.test(handle)) return 'Use only lowercase letters, numbers, _ and -.'
  return null
}

// The name shown until the person picks one: the part of their email before the @.
export function defaultDisplayName({ email, isDemo }) {
  if (isDemo) return 'Demo Dev'
  const name = (email ?? '').split('@')[0].trim()
  return name ? name.slice(0, PROFILE_LIMITS.displayName) : 'Player'
}

// "About you": what someone does, the languages they write and what they are open to.
export const ROLES = [
  { id: 'student', label: 'Student' },
  { id: 'developer', label: 'Developer' },
  { id: 'career-changer', label: 'Career changer' },
  { id: 'teacher', label: 'Teacher' },
  { id: 'other', label: 'Other' },
]

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'go', label: 'Go' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'rust', label: 'Rust' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'sql', label: 'SQL' },
]

export const OPEN_TO = [
  { id: 'study-buddies', label: 'Study buddies' },
  { id: 'mentoring', label: 'Mentoring' },
  { id: 'internships', label: 'Internships' },
  { id: 'jobs', label: 'Jobs' },
]

// Which site each link may point to. The website can be any https address.
export const LINKS = [
  { id: 'github', label: 'GitHub', site: 'github.com' },
  { id: 'linkedin', label: 'LinkedIn', site: 'linkedin.com' },
  { id: 'website', label: 'Website', site: null },
]

export const labelOf = (list, id) => list.find((item) => item.id === id)?.label ?? id

// A message saying what's wrong with the link, or null when it's fine.
export function linkProblem(kind, value) {
  if (value.length > PROFILE_LIMITS.link) return `Use a shorter link (up to ${PROFILE_LIMITS.link} characters).`
  let url = null
  try {
    url = new URL(value)
  } catch {
    // Not a URL at all: same message as a wrong one.
  }
  // A real https address with a dotted host, and no name or password inside it.
  if (!url || url.protocol !== 'https:' || !url.hostname.includes('.') || url.username || url.password) {
    return 'Use a full https:// link.'
  }
  const site = LINKS.find((link) => link.id === kind)?.site
  if (site && url.hostname !== site && !url.hostname.endsWith(`.${site}`)) return `Use a ${site} link.`
  return null
}
