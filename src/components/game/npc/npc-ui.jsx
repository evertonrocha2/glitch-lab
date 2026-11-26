import GameIcon from '../icons/game-icon.jsx'
import { useStudyWindow } from '../study-window/study-window-provider.jsx'
import Frame from '../ui/frame.jsx'

// Small pieces the keepers' views share.

const BUTTON =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1 px-3 pb-1.5 pt-2 font-pixel text-[10px] leading-tight text-[#e8eaee] no-underline hover:text-white'

// A price as the shops show it: the currency icon and the amount, in pixel type. The accessible
// words live on the button around it, so this part is hidden from screen readers.
export function Price({ icon, amount }) {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1">
      <GameIcon name={icon} size={1} />
      {amount}
    </span>
  )
}

// A raised link-button to where a quest gets done: the study window when the page has one (the game
// stays in sight), a plain link otherwise; or a callback (onClick) for a place inside the panel.
export function GoButton({ href, onClick, children }) {
  const studyWindow = useStudyWindow()
  if (onClick) {
    return (
      <Frame as="button" type="button" tone="raised" onClick={onClick} className={BUTTON}>
        {children}
      </Frame>
    )
  }
  if (studyWindow) {
    return (
      <Frame as="button" type="button" tone="raised" onClick={() => studyWindow.open(href)} className={BUTTON}>
        {children}
      </Frame>
    )
  }
  return (
    <Frame as="a" href={href} tone="raised" className={BUTTON}>
      {children}
    </Frame>
  )
}

// A line that warns before something is lost (socketed gems on a sale): a dark ember box, not an alert.
export function Warning({ children }) {
  return (
    <p className="m-0 border-2 border-[#0e1116] bg-[#2e1d16] px-2 py-1.5 text-[11px] leading-snug text-[#ffc9a8] shadow-[inset_2px_2px_0_#5a3322]">
      <span aria-hidden="true" className="mr-1 font-pixel text-[#e07a45]">
        !
      </span>
      {children}
    </p>
  )
}
