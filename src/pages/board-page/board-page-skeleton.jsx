import { COLUMNS } from '../../components/board/board/board.jsx'
import CaseCardSkeleton from '../../components/board/case-card/case-card-skeleton.jsx'
import Skeleton, { Bone, Line } from '../../components/ui/skeleton/skeleton.jsx'
import StepIcon from '../../components/ui/step-icon/step-icon.jsx'
import { useT } from '../../lib/i18n/I18nProvider.jsx'
import { useLabels } from '../../lib/i18n/labels.js'

// Cards drawn in each column while loading.
const CARDS = { new: 2, training: 1, solved: 1 }

// The board while the cases load: the stats strip, then the three columns with their real
// headers and gray cards, in the board's own grid.
export default function BoardPageSkeleton() {
  const t = useT()
  const labels = useLabels()
  return (
    <Skeleton label={t('board.page.loading')}>
      <div className="mb-8 grid grid-cols-3 gap-[2px] border-2 border-ink bg-ink shadow-pixel-ink sm:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
        {[1, 2, 3].map((slot) => (
          <div key={slot} className="bg-white px-4 py-3">
            <Line className="font-label text-xs leading-6" width="w-16" />
            <Line className="mt-1 pt-1 font-pixel text-[28px] font-bold leading-none" width="w-10" />
          </div>
        ))}
        <div className="col-span-3 bg-primary-soft px-4 py-3 sm:col-span-1">
          <Line className="font-label text-xs leading-6" width="w-20" />
          <Line className="mt-1 text-lg font-semibold" width="w-2/5" />
          <Line className="text-sm leading-6" width="w-3/5" />
        </div>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-3">
        {COLUMNS.map((column) => (
          <section key={column.status} className={`border-2 border-ink bg-white ${column.shadow}`}>
            <header className={`flex items-start justify-between gap-3 border-b-2 border-ink px-4 py-3 ${column.head}`}>
              <div>
                <h2 className={`flex items-center gap-2 font-label text-sm ${column.tone}`}>
                  <StepIcon kind={column.icon} className="h-4 w-auto" />
                  {labels.status(column.status)}
                </h2>
                <p className="mt-1 text-sm text-muted">{t(`board.column.${column.status}.hint`)}</p>
              </div>
              <span className="grid h-9 min-w-11 place-items-center border-2 border-ink bg-white px-1.5">
                <Bone className="h-4 w-5" />
              </span>
            </header>
            <ul className="space-y-3 p-3">
              {Array.from({ length: CARDS[column.status] }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative cards
                <li key={index}>
                  <CaseCardSkeleton />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Skeleton>
  )
}
