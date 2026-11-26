// The kicker, title and lead every landing section opens with.
export default function SectionHead({ id, kicker, title, body, className = '' }) {
  return (
    <div className={`max-w-2xl ${className}`}>
      <p className="lp-eyebrow">{kicker}</p>
      <h2 id={id} className="font-pixel text-[2rem] leading-[1.04] text-(--lp-text) sm:text-[2.6rem] lg:text-[3.1rem]">
        {title}
      </h2>
      {body && <p className="mt-4 max-w-[56ch] text-lg leading-relaxed text-(--lp-muted)">{body}</p>}
    </div>
  )
}

// The page column: 1200px wide with a 16px gutter on phones.
export const WRAP = 'mx-auto w-full max-w-[1248px] px-4 sm:px-6'
