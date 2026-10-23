import { useCallback, useEffect, useRef, useState } from 'react'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import PersonCard from '../../components/profile/person-card/person-card.jsx'
import PublicHeader from '../../components/layout/public-header/public-header.jsx'
import { searchProfiles } from '../../lib/api.js'
import { useT } from '../../lib/i18n/I18nProvider.jsx'

const SEARCH_MAX = 40

// "Find people": search public profiles by handle or name. Works signed out.
export default function PeoplePage() {
  const t = useT()
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ status: 'loading' })
  // Only the latest search may fill the list, even if an older one answers last.
  const latest = useRef(0)

  const run = useCallback(async (text) => {
    const call = ++latest.current
    setState((current) => ({ ...current, status: 'loading' }))
    try {
      const people = await searchProfiles(text)
      if (call === latest.current) setState({ status: 'ready', people, searched: text })
    } catch (err) {
      if (call === latest.current) setState({ status: 'error', message: err.message })
    }
  }, [])

  useEffect(() => {
    run('')
  }, [run])

  function submit(event) {
    event.preventDefault()
    run(query.trim())
  }

  return (
    <div className="min-h-screen bg-mist">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        <p className="font-label text-xs text-secondary">
          {t('landing.people.kicker')}
          <span className="motion-safe:animate-caret">_</span>
        </p>
        <h1 className="mt-3 font-pixel text-3xl font-bold text-ink sm:text-4xl">{t('landing.people.title')}</h1>
        <p className="mt-2 max-w-xl text-muted">{t('landing.people.body')}</p>

        <form role="search" onSubmit={submit} className="mt-8 flex max-w-xl flex-wrap gap-2">
          <input
            type="search"
            value={query}
            maxLength={SEARCH_MAX}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('landing.people.searchLabel')}
            placeholder={t('landing.people.placeholder')}
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 basis-48 border-2 border-ink bg-white px-3 py-2.5 text-ink placeholder:text-muted/70 focus:outline-none focus-visible:shadow-pixel"
          />
          <PixelButton type="submit">{t('landing.people.search')}</PixelButton>
        </form>

        <div className="mt-10">
          {state.status === 'error' && <ErrorNotice message={state.message} />}
          {state.status === 'loading' && !state.people && (
            <p role="status" className="font-label text-xs text-muted">
              {t('landing.people.loading')}
            </p>
          )}
          {state.people?.length === 0 && <p className="text-muted">{t('landing.people.none')}</p>}
          {state.people?.length > 0 && (
            <>
              <p className="mb-4 font-label text-[10px] text-muted">
                {state.searched ? t('landing.people.matches', { query: state.searched }) : t('landing.people.newest')}
              </p>
              <ul aria-label={t('landing.people.list')} aria-busy={state.status === 'loading'} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {state.people.map((person) => (
                  <li key={person.handle}>
                    <PersonCard person={person} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
