import { SPECIALISTS, SUGGESTIONS } from '../../../shared/assistant.js'
import { translate } from '../../lib/i18n/I18nProvider.jsx'

// The assistant's words in the reader's language. The server and shared/assistant.js speak English,
// so names, steps and suggestion chips are matched by id (or by their English text) and translated here.

const known = (id) => SPECIALISTS.some((item) => item.id === id)
const english = (key, vars) => translate('en', key, vars)

export const specialistLabel = (t, id) => (known(id) ? t(`app.assistant.specialist.${id}`) : t('app.assistant.fallbackName'))

const doing = (t, id) => t('app.assistant.step.doing', { name: specialistLabel(t, id), doing: t(`app.assistant.doing.${id}`) })

// The starter questions for a page kind, in the reader's language. Asked as shown, so the AI answers in kind.
export const suggestionsFor = (t, kind) =>
  (SUGGESTIONS[kind] ?? SUGGESTIONS.other).map((text, index) => {
    const key = `app.assistant.suggest.${kind}.${index}`
    const translated = t(key)
    return translated === key ? text : translated
  })

// Steps the panel guesses while it waits.
export const routingStep = (t) => t('app.assistant.step.routing')
export const writingStep = (t) => t('app.assistant.step.writing')
export const workingStep = doing

// A step the server sent ("Board analyst is looking at your cases"), translated when it is one we know.
export function stepLabel(t, step) {
  for (const key of ['routing', 'fallback', 'writing', 'merging']) {
    if (step === english(`app.assistant.step.${key}`)) return t(`app.assistant.step.${key}`)
  }
  for (const { id } of SPECIALISTS) {
    const name = english(`app.assistant.specialist.${id}`)
    if (step === english('app.assistant.step.doing', { name, doing: english(`app.assistant.doing.${id}`) })) return doing(t, id)
    if (step === english('app.assistant.step.failed', { name })) return t('app.assistant.step.failed', { name: specialistLabel(t, id) })
  }
  return step
}

// An action button: the server's default English label is translated; a label the AI wrote stays as written.
export function actionLabel(t, action) {
  const key = `app.assistant.action.${action.type}`
  if (!action.label || action.label === english(key)) {
    const translated = t(key)
    return translated === key ? action.label : translated
  }
  return action.label
}
