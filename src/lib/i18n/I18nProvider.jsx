import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { MESSAGES } from './catalog.js'

// The app speaks English and Brazilian Portuguese. Every string goes through t(key, vars); a key
// missing in Portuguese falls back to English, and a key missing everywhere shows the key itself.
export const LOCALES = ['en', 'pt-BR']
export const DEFAULT_LOCALE = 'en'
const KEY = 'gd:locale'

// The language the rest of the app reads outside React (the API client sends it to the server).
let current = DEFAULT_LOCALE
export const currentLocale = () => current
// Tests reset this between cases, so one test's language never leaks into the next.
export const resetCurrentLocale = () => {
  current = DEFAULT_LOCALE
}

export function initialLocale() {
  try {
    const saved = localStorage.getItem(KEY)
    if (LOCALES.includes(saved)) return saved
  } catch {
    // Storage blocked: fall through to the browser's language.
  }
  const browser = globalThis.navigator?.language ?? ''
  return browser.toLowerCase().startsWith('pt') ? 'pt-BR' : DEFAULT_LOCALE
}

// One PluralRules per language, made on first use (building one is the slow part).
const pluralRules = new Map()
function pluralRule(locale) {
  if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(locale))
  return pluralRules.get(locale)
}

// Intl calls 0 singular in Portuguese ("0 curtida"), but people say "0 curtidas": zero takes the plural
// form, or its own `zero` message when one exists ("Nenhum caso ainda").
function pluralForm(message, locale, count) {
  if (count === 0 && message.zero !== undefined) return message.zero
  const form = count === 0 && locale.startsWith('pt') ? 'other' : pluralRule(locale).select(count)
  return message[form] ?? message.other
}

// "{count} cases" -> "3 cases". A message can also be { one, other } and picks by vars.count.
export function translate(locale, key, vars = {}) {
  let message = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key]
  if (message === undefined) return key
  if (typeof message === 'object') message = pluralForm(message, locale, vars.count ?? 0)
  return message.replace(/\{(\w+)\}/g, (whole, name) => (vars[name] === undefined ? whole : String(vars[name])))
}

const I18nContext = createContext(null)

export function I18nProvider({ children, locale: forced }) {
  const [locale, setLocaleState] = useState(() => forced ?? initialLocale())
  current = locale

  useEffect(() => {
    current = locale
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice lasts until the page reloads.
    }
    current = next
    setLocaleState(next)
  }, [])

  const t = useCallback((key, vars) => translate(locale, key, vars), [locale])
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// { locale, setLocale, t }. Outside a provider (a component rendered alone in a test) it speaks English.
export function useI18n() {
  return useContext(I18nContext) ?? { locale: DEFAULT_LOCALE, setLocale: () => {}, t: (key, vars) => translate(DEFAULT_LOCALE, key, vars) }
}

export const useT = () => useI18n().t
