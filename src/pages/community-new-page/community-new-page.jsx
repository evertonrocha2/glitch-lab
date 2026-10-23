import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { COMMUNITY_COLORS, COMMUNITY_ICONS, COMMUNITY_TOPICS, MESSAGE_LIMITS } from '../../../shared/messages.js'
import CommunityBadge, { PixelIcon } from '../../components/chat/community-badge/community-badge.jsx'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PixelCard from '../../components/ui/pixel-card/pixel-card.jsx'
import { AVATAR_STYLES } from '../../components/ui/pixel-avatar/pixel-avatar.jsx'
import { createCommunity } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const LABEL = 'font-label text-xs text-ink'
const INPUT = 'w-full border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel'
const { nameMin, nameMax, description: DESCRIPTION, topics: MAX_TOPICS } = MESSAGE_LIMITS

// "Create community": a name, a short description, up to 3 topics, and a pixel color and icon.
export default function CommunityNewPage() {
  const { user, getToken } = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const [draft, setDraft] = useState({ name: '', description: '', topics: [], color: COMMUNITY_COLORS[0], icon: COMMUNITY_ICONS[0] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const change = (patch) => setDraft((current) => ({ ...current, ...patch }))
  const name = draft.name.trim()
  const nameOk = name.length >= nameMin && name.length <= nameMax

  function toggleTopic(topic) {
    const has = draft.topics.includes(topic)
    if (!has && draft.topics.length >= MAX_TOPICS) return
    change({ topics: has ? draft.topics.filter((item) => item !== topic) : [...draft.topics, topic] })
  }

  async function save(event) {
    event.preventDefault()
    if (!nameOk || saving) return
    setSaving(true)
    setMessage(null)
    try {
      const created = await createCommunity({ ...draft, name, description: draft.description.trim() }, await getToken())
      navigate(`/communities/${created.slug}`)
    } catch (err) {
      setMessage(err.message)
      setSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        kicker={t('chat.create.kicker')}
        title={t('chat.create.title')}
        lead={t('chat.create.lead')}
        actions={
          <PixelButton as={Link} to="/communities" variant="ghost" className="px-4 py-3">
            {t('chat.create.back')}
          </PixelButton>
        }
      />

      {user.isDemo ? (
        <p role="status" className="mt-8 border-2 border-ink bg-secondary-soft px-4 py-3 text-sm text-ink">
          {t('chat.create.demo')}
        </p>
      ) : (
        <PixelCard tone="secondary" as="form" onSubmit={save} className="mt-8 max-w-2xl space-y-6 p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <CommunityBadge color={draft.color} icon={draft.icon} className="size-16" />
            <p className="min-w-0 font-pixel text-xl font-bold wrap-break-word text-ink">{name || t('chat.create.previewName')}</p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="community-name" className={LABEL}>
                {t('chat.create.name')}
              </label>
              <span className="font-label text-[10px] text-muted">
                {draft.name.length}/{nameMax}
              </span>
            </div>
            <input
              id="community-name"
              value={draft.name}
              maxLength={nameMax}
              required
              placeholder={t('chat.create.namePlaceholder')}
              onChange={(event) => change({ name: event.target.value })}
              aria-describedby="community-name-hint"
              className={`mt-2 ${INPUT}`}
            />
            <p id="community-name-hint" className="mt-1 text-xs text-muted">
              {t('chat.create.nameHint', { min: nameMin, max: nameMax })}
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="community-description" className={LABEL}>
                {t('chat.create.description')}
              </label>
              <span className="font-label text-[10px] text-muted">
                {draft.description.length}/{DESCRIPTION}
              </span>
            </div>
            <textarea
              id="community-description"
              rows={3}
              value={draft.description}
              maxLength={DESCRIPTION}
              placeholder={t('chat.create.descriptionPlaceholder')}
              onChange={(event) => change({ description: event.target.value })}
              className={`mt-2 resize-none ${INPUT}`}
            />
          </div>

          <fieldset>
            <legend className={LABEL}>{t('chat.create.topics', { max: MAX_TOPICS })}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMUNITY_TOPICS.map((topic) => {
                const on = draft.topics.includes(topic)
                return (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && draft.topics.length >= MAX_TOPICS}
                    onClick={() => toggleTopic(topic)}
                    className={`min-h-10 border-2 border-ink px-3 font-label text-xs disabled:cursor-not-allowed disabled:border-ink/30 disabled:text-muted ${on ? 'bg-primary text-white' : 'bg-white text-ink hover:bg-mist'}`}
                  >
                    {t(`chat.topic.${topic}`)}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={LABEL}>{t('chat.create.color')}</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {COMMUNITY_COLORS.map((color) => (
                <label key={color} className="relative grid size-10 cursor-pointer place-items-center">
                  <input type="radio" name="community-color" value={color} checked={draft.color === color} onChange={() => change({ color })} className="peer sr-only" />
                  <span className="sr-only">{t(`chat.color.${color}`)}</span>
                  <span
                    aria-hidden="true"
                    className={`size-8 border-2 border-ink ${AVATAR_STYLES[color].swatch} peer-checked:shadow-[3px_3px_0_var(--color-ink)] peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline-primary peer-focus-visible:outline-2 peer-focus-visible:outline-secondary`}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={LABEL}>{t('chat.create.icon')}</legend>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {COMMUNITY_ICONS.map((icon) => (
                <label key={icon} className="cursor-pointer">
                  <input type="radio" name="community-icon" value={icon} checked={draft.icon === icon} onChange={() => change({ icon })} className="peer sr-only" />
                  <span className="sr-only">{t(`chat.icon.${icon}`)}</span>
                  <span
                    aria-hidden="true"
                    className="grid h-12 place-items-center border-2 border-ink bg-white fill-ink peer-checked:bg-primary peer-checked:fill-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-secondary"
                  >
                    <PixelIcon name={icon} className="size-6" />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {message && <ErrorNotice message={message} />}

          <div className="flex flex-wrap items-center gap-4">
            <PixelButton type="submit" disabled={!nameOk || saving}>
              {saving ? t('chat.create.saving') : t('chat.create.save')}
            </PixelButton>
            <span className="text-xs text-muted">{t('chat.create.limit', { max: MESSAGE_LIMITS.ownedCommunities })}</span>
          </div>
        </PixelCard>
      )}
    </AppShell>
  )
}
