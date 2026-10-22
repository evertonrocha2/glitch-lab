import { translate } from './I18nProvider.jsx'
import SERVER from './messages/server.js'

// The API answers in English ({ message }). This turns a message into the reader's language by
// finding which English text in messages/server.js it is: an exact match, or a template whose
// {placeholders} are filled with numbers or words. Anything unknown comes back as it was.

const PLACEHOLDER = /\{(\w+)\}/g
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Words that fill a placeholder and have their own translation.
const WORDS = { what: 'server.what.', label: 'server.linkLabel.' }
const isMessage = (key) => !key.startsWith('server.what.') && !key.startsWith('server.linkLabel.')

const EXACT = new Map()
const TEMPLATES = []
for (const [key, text] of Object.entries(SERVER.en)) {
  if (!isMessage(key)) continue
  // split with a capture group: literal, name, literal, name, ..., literal
  const pieces = text.split(PLACEHOLDER)
  if (pieces.length === 1) {
    EXACT.set(text, key)
    continue
  }
  const names = pieces.filter((_, index) => index % 2 === 1)
  // {problem} is a whole sentence at the end; every other value is a short word or number.
  const source = pieces.map((piece, index) => (index % 2 === 0 ? escapeRegex(piece) : piece === 'problem' ? '(.+)' : '(.+?)')).join('')
  TEMPLATES.push({ key, names, pattern: new RegExp(`^${source}$`), literal: text.replace(PLACEHOLDER, '').length })
}
// The most specific template first, so a longer fixed text wins over a looser one.
TEMPLATES.sort((a, b) => b.literal - a.literal)

function fillValue(name, value, locale) {
  if (name === 'problem') return translateServerMessage(value, locale)
  const prefix = WORDS[name]
  if (prefix && SERVER.en[prefix + value] !== undefined) return translate(locale, prefix + value)
  return value
}

export function translateServerMessage(message, locale) {
  if (typeof message !== 'string' || !message || locale === 'en') return message
  const exact = EXACT.get(message)
  if (exact) return translate(locale, exact)
  for (const { key, names, pattern } of TEMPLATES) {
    const match = pattern.exec(message)
    if (!match) continue
    const vars = Object.fromEntries(names.map((name, index) => [name, fillValue(name, match[index + 1], locale)]))
    return translate(locale, key, vars)
  }
  return message
}
