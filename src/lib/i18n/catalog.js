// Every file in ./messages exports { en: {...}, 'pt-BR': {...} } for one area of the app.
// They are merged here, so each area keeps its own strings and nobody edits a shared list.
const files = import.meta.glob('./messages/*.js', { eager: true })

export const MESSAGES = { en: {}, 'pt-BR': {} }
for (const module of Object.values(files)) {
  for (const locale of Object.keys(MESSAGES)) Object.assign(MESSAGES[locale], module.default?.[locale] ?? {})
}
