import PixelButton from '../../components/ui/pixel-button/pixel-button.jsx'
import { useI18n } from '../../lib/i18n/I18nProvider.jsx'

// Its own copy instead of the shared catalog, which ships whole: this way the words leave the
// production bundle together with the button.
const COPY = {
  en: { pitch: 'Trying it locally? Skip the sign up.', button: 'Use demo account' },
  'pt-BR': { pitch: 'Testando localmente? Pule o cadastro.', button: 'Usar conta demo' },
}

// Shown by the login page only when the demo login is on (local development).
export default function DemoLogin({ onClick, disabled }) {
  const { locale } = useI18n()
  const copy = COPY[locale] ?? COPY.en
  return (
    <div className="border-t-2 border-dashed border-line pt-5">
      <p className="mb-3 text-sm text-muted">{copy.pitch}</p>
      <PixelButton variant="secondary" onClick={onClick} disabled={disabled}>
        {copy.button}
      </PixelButton>
    </div>
  )
}
