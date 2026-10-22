import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { BADGES } from '../../shared/badges.js'
import { AVATAR_COLORS, handleProblem, LANGUAGES, LINKS, linkProblem, OPEN_TO, PROFILE_LIMITS, ROLES } from '../../shared/profile.js'
import AppShell from '../components/AppShell.jsx'
import ErrorNotice from '../components/ErrorNotice.jsx'
import BadgeIcon from '../components/pixel/BadgeIcon.jsx'
import { AVATAR_STYLES } from '../components/pixel/PixelAvatar.jsx'
import PixelButton from '../components/pixel/PixelButton.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import ProfileCard from '../components/profile/ProfileCard.jsx'
import { AuthError, saveProfile } from '../lib/api.js'
import { useAuth } from '../lib/auth/AuthProvider.jsx'
import { loadMyProfile, rememberMyProfile } from '../lib/profile/myProfile.js'

const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const LABEL = 'font-label text-xs text-ink'
const HANDLE_RULES = 'Lowercase letters, numbers, _ and -. 3 to 20 characters.'

const newSeed = () => Math.random().toString(36).slice(2, 10)

// The editable copy of the profile. Featured badges you no longer hold are dropped.
// Links are edited as three text fields, so each is a string here.
const draftFrom = (profile, earned) => ({
  handle: profile.handle ?? '',
  displayName: profile.displayName ?? '',
  bio: profile.bio,
  avatar: profile.avatar,
  featuredBadges: profile.featuredBadges.filter((id) => earned.includes(id)),
  isPublic: profile.isPublic,
  role: profile.role ?? null,
  headline: profile.headline ?? '',
  university: profile.university ?? '',
  course: profile.course ?? '',
  work: profile.work ?? '',
  location: profile.location ?? '',
  languages: profile.languages ?? [],
  links: Object.fromEntries(LINKS.map((link) => [link.id, profile.links?.[link.id] ?? ''])),
  openTo: profile.openTo ?? [],
})

// Only the links that are filled in and pass the check (the preview shows these; the save sends them).
const goodLinks = (links) =>
  Object.fromEntries(
    Object.entries(links)
      .map(([id, url]) => [id, url.trim()])
      .filter(([id, url]) => url && !linkProblem(id, url)),
  )
const linksOk = (links) => Object.entries(links).every(([id, url]) => !url.trim() || !linkProblem(id, url.trim()))

const toggle = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

const ABOUT_TEXT = [
  { field: 'university', label: 'University', placeholder: 'Where you study' },
  { field: 'course', label: 'Course', placeholder: 'Computer Science' },
  { field: 'work', label: 'Job or company', placeholder: 'Intern at a startup' },
  { field: 'location', label: 'Location', placeholder: 'City, country' },
]
const LINK_PLACEHOLDERS = { github: 'https://github.com/you', linkedin: 'https://www.linkedin.com/in/you', website: 'https://your.site' }

function Chips({ label, hint, options, picked, max, onToggle }) {
  const full = max !== undefined && picked.length >= max
  return (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = picked.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onToggle(option.id)}
              className={`border-2 px-2.5 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                on ? 'border-ink bg-primary text-white shadow-pixel-ink' : 'border-line bg-white text-ink hover:border-ink'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// "About you": what you do, where you study or work, your languages, links and what you're open to.
function AboutFields({ draft, change }) {
  return (
    <fieldset aria-labelledby="about-title" className="space-y-5 border-t-2 border-dashed border-line pt-5">
      <div>
        <h2 id="about-title" className="font-pixel text-xl font-bold text-ink">
          About you
        </h2>
        <p className="mt-1 text-sm text-muted">All optional. Shown on your public profile.</p>
      </div>

      <div role="radiogroup" aria-labelledby="role-label">
        <p id="role-label" className={LABEL}>
          What do you do?
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {[...ROLES, { id: null, label: 'Rather not say' }].map((role) => (
            <label key={role.id ?? 'none'} className="cursor-pointer">
              <input
                type="radio"
                name="role"
                checked={draft.role === role.id}
                onChange={() => change({ role: role.id })}
                className="peer sr-only"
              />
              <span className="block border-2 border-line bg-white px-2.5 py-1.5 text-sm text-ink transition-colors peer-checked:border-ink peer-checked:bg-secondary peer-checked:text-white peer-checked:shadow-pixel-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary hover:border-ink">
                {role.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="headline" className={LABEL}>
            Headline
          </label>
          <span className="font-label text-[10px] text-muted">
            {draft.headline.length}/{PROFILE_LIMITS.headline}
          </span>
        </div>
        <input
          id="headline"
          value={draft.headline}
          maxLength={PROFILE_LIMITS.headline}
          placeholder="Learning React at night"
          onChange={(event) => change({ headline: event.target.value })}
          className={`mt-2 ${INPUT}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ABOUT_TEXT.map(({ field, label, placeholder }) => (
          <div key={field} className="min-w-0">
            <label htmlFor={`about-${field}`} className={LABEL}>
              {label}
            </label>
            <input
              id={`about-${field}`}
              value={draft[field]}
              maxLength={PROFILE_LIMITS[field]}
              placeholder={placeholder}
              onChange={(event) => change({ [field]: event.target.value })}
              className={`mt-2 ${INPUT}`}
            />
          </div>
        ))}
      </div>

      <Chips
        label="Languages you write"
        hint={`${draft.languages.length}/${PROFILE_LIMITS.languages} picked`}
        options={LANGUAGES}
        picked={draft.languages}
        max={PROFILE_LIMITS.languages}
        onToggle={(id) => change({ languages: toggle(draft.languages, id) })}
      />

      <Chips label="Open to" options={OPEN_TO} picked={draft.openTo} onToggle={(id) => change({ openTo: toggle(draft.openTo, id) })} />

      <div className="space-y-4">
        {LINKS.map((link) => {
          const value = draft.links[link.id]
          const problem = value.trim() ? linkProblem(link.id, value.trim()) : null
          return (
            <div key={link.id}>
              <label htmlFor={`link-${link.id}`} className={LABEL}>
                {link.label}
              </label>
              <input
                id={`link-${link.id}`}
                type="url"
                inputMode="url"
                autoCapitalize="none"
                spellCheck={false}
                value={value}
                maxLength={PROFILE_LIMITS.link}
                placeholder={LINK_PLACEHOLDERS[link.id]}
                aria-invalid={Boolean(problem)}
                aria-describedby={problem ? `link-${link.id}-hint` : undefined}
                onChange={(event) => change({ links: { ...draft.links, [link.id]: event.target.value } })}
                className={`mt-2 font-mono text-sm ${INPUT}`}
              />
              {problem && (
                <p id={`link-${link.id}-hint`} className="mt-1.5 text-xs text-primary">
                  {problem}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function HandleHint({ handle }) {
  if (!handle) return <p className="mt-1.5 text-xs text-muted">{HANDLE_RULES}</p>
  const problem = handleProblem(handle)
  return problem ? (
    <p className="mt-1.5 text-xs text-primary">{problem}</p>
  ) : (
    <p className="mt-1.5 text-xs text-secondary">Looks good. Your link: /u/{handle}</p>
  )
}

function ColorPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Avatar color" className="flex flex-wrap gap-2">
      {AVATAR_COLORS.map((color) => (
        <label key={color.id} className="cursor-pointer">
          <input
            type="radio"
            name="avatar-color"
            value={color.id}
            checked={value === color.id}
            onChange={() => onChange(color.id)}
            aria-label={color.name}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`block size-9 border-2 border-ink ${AVATAR_STYLES[color.id].swatch} peer-checked:shadow-pixel-ink peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-ink peer-focus-visible:outline-secondary`}
          />
        </label>
      ))}
    </div>
  )
}

function BadgePicker({ earned, picked, onToggle }) {
  const full = picked.length >= PROFILE_LIMITS.featured
  return (
    <fieldset>
      <legend className={LABEL}>Featured badges</legend>
      <p className="mt-1 text-xs text-muted">Pick up to {PROFILE_LIMITS.featured} of the badges you have earned.</p>
      {earned.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Earn a badge to feature it here.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {earned.map((badge) => {
            const on = picked.includes(badge.id)
            return (
              <button
                key={badge.id}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => onToggle(badge.id)}
                className={`flex items-center gap-2 border-2 px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  on ? 'border-ink bg-primary-soft shadow-pixel-ink' : 'border-line bg-white hover:border-ink'
                }`}
              >
                <BadgeIcon id={badge.id} className="size-7 shrink-0" />
                <span className="min-w-0 font-pixel text-sm leading-tight text-ink">{badge.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

function PublicLink({ handle }) {
  const [copied, setCopied] = useState(false)
  const url = `${window.location.origin}/u/${handle}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // No clipboard access: the link is still there to select by hand.
    }
  }

  return (
    <div className="mt-6 border-2 border-ink bg-secondary-soft p-4">
      <label htmlFor="public-link" className={LABEL}>
        Your public link
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input id="public-link" readOnly value={url} onFocus={(event) => event.target.select()} className={`${INPUT} min-w-0 basis-full font-mono text-sm sm:basis-0 sm:flex-1`} />
        <PixelButton variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </PixelButton>
        <PixelButton as={Link} variant="ghost" to={`/u/${handle}`}>
          Open
        </PixelButton>
      </div>
    </div>
  )
}

// Edit how you show up to others, with a live preview of the public card.
export default function ProfilePage() {
  const { user, getToken, signOut } = useAuth()
  const [data, setData] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saved, setSaved] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const userId = user.id

  useEffect(() => {
    let live = true
    loadMyProfile(userId, getToken, { fresh: true })
      .then((loaded) => {
        if (!live) return
        setData(loaded)
        setSaved(loaded.profile)
        setDraft(draftFrom(loaded.profile, loaded.earnedBadges))
      })
      .catch(async (err) => {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else setMessage(err.message)
      })
    return () => {
      live = false
    }
  }, [userId, getToken, signOut])

  function change(fields) {
    setDraft((current) => ({ ...current, ...fields }))
    setStatus('idle')
  }

  function toggleBadge(id) {
    const picked = draft.featuredBadges
    change({ featuredBadges: picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id] })
  }

  async function save(event) {
    event.preventDefault()
    setStatus('saving')
    setMessage('')
    try {
      const profile = await saveProfile({ ...draft, handle: draft.handle || null, links: goodLinks(draft.links) }, await getToken())
      setSaved(profile)
      rememberMyProfile(userId, { ...data, profile })
      setStatus('saved')
    } catch (err) {
      setStatus('idle')
      if (err instanceof AuthError) await signOut()
      else setMessage(err.message)
    }
  }

  const earned = data ? BADGES.filter((badge) => data.earnedBadges.includes(badge.id)) : []
  const handleOk = draft && (!draft.handle || !handleProblem(draft.handle))
  const needsHandle = draft?.isPublic && !draft.handle
  const preview = draft && {
    ...data.progress,
    ...draft,
    displayName: draft.displayName.trim() || draft.handle || 'Detective',
    handle: draft.handle && !handleProblem(draft.handle) ? draft.handle : null,
    links: goodLinks(draft.links),
  }

  return (
    <AppShell>
      <p className="font-label text-xs text-secondary">
        &gt; your badge<span className="motion-safe:animate-caret">_</span>
      </p>
      <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">Your profile</h1>
      <p className="mt-2 text-muted">Pick a name, a pixel face and the badges you are proudest of. Share it when you're ready.</p>
      <Link to="/people" className="mt-3 inline-block font-label text-xs text-secondary underline underline-offset-4 hover:text-primary">
        Find detectives
      </Link>

      {message && (
        <div className="mt-8">
          <ErrorNotice message={message} />
        </div>
      )}

      {!draft ? (
        !message && (
          <p role="status" className="mt-10 font-label text-xs text-muted">
            Loading your profile...
          </p>
        )
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
          <section aria-labelledby="preview-title" className="lg:sticky lg:top-6 lg:order-last">
            <h2 id="preview-title" className="mb-3 font-label text-xs text-primary">
              How others see you
            </h2>
            <ProfileCard profile={preview} headingLevel={3} />
            <p className="mt-3 text-xs text-muted">
              {saved.isPublic && saved.handle ? 'Your profile is public.' : 'Only you can see this until you make it public.'}
            </p>
          </section>

          <PixelCard tone="secondary" as="form" onSubmit={save} className="space-y-6 p-5 sm:p-7">
            <div>
              <label htmlFor="display-name" className={LABEL}>
                Display name
              </label>
              <input
                id="display-name"
                value={draft.displayName}
                placeholder={saved?.suggestedName}
                maxLength={PROFILE_LIMITS.displayName}
                onChange={(event) => change({ displayName: event.target.value })}
                className={`mt-2 ${INPUT}`}
              />
            </div>

            <div>
              <label htmlFor="handle" className={LABEL}>
                Handle
              </label>
              <div className="mt-2 flex items-stretch">
                <span aria-hidden="true" className="grid place-items-center border-2 border-r-0 border-ink bg-mist px-3 font-label text-xs text-muted">
                  @
                </span>
                <input
                  id="handle"
                  value={draft.handle}
                  maxLength={PROFILE_LIMITS.handleMax + 5}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="bug_hunter"
                  onChange={(event) => change({ handle: event.target.value.toLowerCase() })}
                  aria-describedby="handle-hint"
                  aria-invalid={!handleOk}
                  className={`${INPUT} min-w-0 flex-1`}
                />
              </div>
              <div id="handle-hint" aria-live="polite">
                <HandleHint handle={draft.handle} />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="bio" className={LABEL}>
                  Bio
                </label>
                <span className="font-label text-[10px] text-muted">
                  {draft.bio.length}/{PROFILE_LIMITS.bio}
                </span>
              </div>
              <textarea
                id="bio"
                rows={3}
                value={draft.bio}
                maxLength={PROFILE_LIMITS.bio}
                placeholder="What are you learning right now?"
                onChange={(event) => change({ bio: event.target.value })}
                className={`mt-2 resize-none ${INPUT}`}
              />
            </div>

            <AboutFields draft={draft} change={change} />

            <div>
              <p className={LABEL}>Avatar</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <ColorPicker value={draft.avatar.color} onChange={(color) => change({ avatar: { ...draft.avatar, color } })} />
                <PixelButton variant="ghost" onClick={() => change({ avatar: { ...draft.avatar, seed: newSeed() } })}>
                  Shuffle
                </PixelButton>
              </div>
            </div>

            <BadgePicker earned={earned} picked={draft.featuredBadges} onToggle={toggleBadge} />

            <div className="border-t-2 border-dashed border-line pt-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={draft.isPublic}
                  onChange={(event) => change({ isPublic: event.target.checked })}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-label text-xs text-ink">Make my profile public</span>
                  <span className="mt-1 block text-sm text-muted">
                    Anyone with the link sees your name, level, study time and badges. Never your email, cases or notes.
                  </span>
                </span>
              </label>
              {needsHandle && <p className="mt-2 text-xs text-primary">Pick a handle to share your profile.</p>}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <PixelButton type="submit" disabled={status === 'saving' || !handleOk || needsHandle || !linksOk(draft.links)}>
                {status === 'saving' ? 'Saving...' : 'Save profile'}
              </PixelButton>
              <span role="status" className="font-label text-xs text-secondary">
                {status === 'saved' ? 'Saved.' : ''}
              </span>
            </div>

            {saved.isPublic && saved.handle && <PublicLink handle={saved.handle} />}
          </PixelCard>
        </div>
      )}
    </AppShell>
  )
}
