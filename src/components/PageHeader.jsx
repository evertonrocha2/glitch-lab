// The top of every signed-in page: a terminal-style kicker, the title, one line on what the page is
// for, and the page's main actions. On desktop the actions sit on the right, level with the last
// line of text; on phones they drop below it. Pages put their content 8 units (mt-8) under it.
export default function PageHeader({ kicker, title, lead, actions, children, className = '' }) {
  // Some kickers come with their own "> " and some don't: draw it once, the same way everywhere.
  const prompt = typeof kicker === 'string' ? kicker.replace(/^>\s*/, '').replace(/_$/, '') : kicker
  return (
    <div className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        {kicker && (
          <p className="font-label text-xs text-secondary">
            &gt; {prompt}
            <span className="motion-safe:animate-caret">_</span>
          </p>
        )}
        <h1 className="mt-3 break-words font-pixel text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
        {lead && <p className="mt-2 max-w-2xl text-muted">{lead}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  )
}
