// Embed mode: a signed-in page shown inside the game's study window (an iframe of this same app).
// There AppShell renders the page alone, without the header, nav, study timer and corner widgets.
//
// The window loads its page with ?embed=1 and names its frame STUDY_FRAME_NAME. A link followed
// inside the window drops the query, but a frame keeps its name across every page it loads, so the
// page stays embedded until the window closes. Any other frame or tab is never embedded.
//
// Embed mode is cosmetic only: it hides the shell around the page and never skips RequireAuth, a
// guard or a confirmation. window.name is needed (the query alone is lost on the first link), and it
// is safe: vercel.json sends frame-ancestors 'self' and X-Frame-Options SAMEORIGIN, so no other site
// can frame these pages, and a top-level tab given that name by another site only loses its header.
export const STUDY_FRAME_NAME = 'studyquest-study-window'

// search: a location's query string ("?embed=1"). Reading window.name can't fail in this app (the
// frame is same-origin), but a blocked read just means "not embedded".
export function isEmbedded(search = '') {
  if (new URLSearchParams(search).get('embed') === '1') return true
  try {
    return window.name === STUDY_FRAME_NAME
  } catch {
    return false
  }
}

// A study link with embed=1 added (once), keeping the query it already has.
export function withEmbed(href) {
  const [path, query = ''] = href.split('?')
  const params = new URLSearchParams(query)
  params.set('embed', '1')
  return `${path}?${params.toString()}`
}
