// The reader's language, from the Accept-Language header the app sends with every call.
// Only English and Brazilian Portuguese exist; anything else is English.
export const LOCALES = ['en', 'pt-BR']

export function localeOf(acceptLanguage) {
  const header = typeof acceptLanguage === 'string' ? acceptLanguage : ''
  return /^pt(?![a-z])/i.test(header.trim()) ? 'pt-BR' : 'en'
}

// One line for an AI prompt: what language to write the student-facing text in. Code, error
// messages and identifiers stay as the language prints them.
export function languageRule(locale) {
  return locale === 'pt-BR'
    ? 'Write every explanation, hint, feedback and title in Brazilian Portuguese (pt-BR). Keep code, error messages and identifiers exactly as the programming language prints them.'
    : 'Write in plain, simple English.'
}
