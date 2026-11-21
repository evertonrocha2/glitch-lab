import { useCallback, useEffect, useState } from 'react'
import AppShell from '../../components/layout/app-shell/app-shell.jsx'
import ErrorNotice from '../../components/ui/error-notice/error-notice.jsx'
import PageHeader from '../../components/ui/page-header/page-header.jsx'
import WorldGame from '../../components/world/world-game/world-game.jsx'
import WorldPanel from '../../components/world/world-panel/world-panel.jsx'
import { AuthError, getWorld, saveWorldPosition } from '../../lib/api.js'
import { useAuth } from '../../lib/auth/auth-provider.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useMyProfile } from '../../lib/profile/my-profile.js'
import WorldPageSkeleton from './world-page-skeleton.jsx'

// /mundo: Glitch World. The hero walks the worlds the student's study opened; the server says
// what's open and keeps where the hero stands.
export default function WorldPage() {
  const t = useT()
  const { getToken, signOut } = useAuth()
  const heroColor = useMyProfile()?.profile.avatar?.color ?? 'violet'
  const [state, setState] = useState(null)
  const [world, setWorld] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const data = await getWorld(await getToken())
        if (!live) return
        setState(data)
        setWorld(data.position.world)
      } catch (err) {
        if (!live) return
        if (err instanceof AuthError) await signOut()
        else setMessage(err.message)
      }
    })()
    return () => {
      live = false
    }
  }, [getToken, signOut])

  // A failed save only means the hero may start a few tiles back next time: the game goes on.
  const save = useCallback(async (position, options) => saveWorldPosition(position, await getToken(), options), [getToken])

  return (
    <AppShell>
      <PageHeader kicker={t('world.page.kicker')} title={world ? t(`world.name.${world}`) : t('world.nav')} />
      {message && (
        <div className="mt-6">
          <ErrorNotice message={message} />
        </div>
      )}
      {!state && !message && <WorldPageSkeleton />}
      {state && (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <WorldGame state={state} heroColor={heroColor} onSave={save} onWorldChange={setWorld} />
          <WorldPanel state={state} currentWorld={world} />
        </div>
      )}
    </AppShell>
  )
}
