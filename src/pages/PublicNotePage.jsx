import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import ErrorNotice from '../components/ErrorNotice.jsx'
import PublicNoteBody from '../components/notes/PublicNoteBody.jsx'
import PixelBug from '../components/pixel/PixelBug.jsx'
import PixelCard from '../components/pixel/PixelCard.jsx'
import PersonCard from '../components/profile/PersonCard.jsx'
import PublicHeader from '../components/profile/PublicHeader.jsx'
import { getPublicNote } from '../lib/api.js'

const longDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function NotShared() {
  return (
    <PixelCard tone="muted" className="mx-auto max-w-lg p-8 text-center">
      <PixelBug className="mx-auto h-12 w-auto" />
      <h1 className="mt-6 font-pixel text-3xl font-bold text-ink">This note is not shared</h1>
      <p className="mt-3 text-muted">It may be private, or the link may have a typo.</p>
    </PixelCard>
  )
}

// One note a detective shared on their profile. Read-only, works signed out.
export default function PublicNotePage() {
  const { handle, id } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    getPublicNote(handle, id)
      .then((shared) => live && setState(shared ? { status: 'ready', ...shared } : { status: 'missing' }))
      .catch((err) => live && setState({ status: 'error', message: err.message }))
    return () => {
      live = false
    }
  }, [handle, id])

  const { note, author } = state
  const cases = note?.blocks.filter((block) => block.type === 'case').length ?? 0

  return (
    <div className="min-h-screen bg-mist">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-5 pt-8 pb-20 sm:px-8 sm:pt-12">
        <Link to={`/u/${handle}`} className="inline-block break-all font-label text-xs text-ink hover:text-primary">
          &lt; Back to @{handle}
        </Link>

        <div className="mt-6">
          {state.status === 'loading' && (
            <p role="status" className="font-label text-xs text-muted">
              Opening the note...
            </p>
          )}
          {state.status === 'error' && <ErrorNotice message={state.message} />}
          {state.status === 'missing' && <NotShared />}
        </div>

        {note && (
          <>
            <p className="font-label text-xs text-secondary">
              &gt; shared note<span className="motion-safe:animate-caret">_</span>
            </p>
            <PixelCard as="article" className="mt-4 p-5 sm:p-10">
              <h1 className="font-pixel text-3xl leading-[1.1] font-bold wrap-break-word text-ink sm:text-[40px]">{note.title || 'Untitled'}</h1>
              <p className="mt-3 font-label text-[10px] text-muted">
                Updated {longDate(note.updatedAt)}
                {cases ? ` · ${cases} ${cases === 1 ? 'case' : 'cases'}` : ''}
              </p>
              <div aria-hidden="true" className="mt-6 mb-6 h-0.5 bg-ink" />
              <PublicNoteBody blocks={note.blocks} />
            </PixelCard>

            <section aria-labelledby="author-title" className="mt-10 max-w-md">
              <h2 id="author-title" className="mb-3 font-label text-xs text-primary">
                Written by
              </h2>
              <PersonCard person={author} headingLevel={3} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
