// Text as the detectors read it. Attacks hide behind look-alike letters, invisible characters,
// accents, leetspeak, spaced-out letters and encodings, so every check runs on these forms
// instead of the raw text. Nothing here changes what the AI or the student sees.

// Zero-width and other invisible characters (soft hyphen, joiners, direction marks, BOM,
// variation selectors). Emoji joiners go too: only the matching copy loses them.
// Built from a string: some of these are combining marks, which a class literal reads oddly.
const INVISIBLE = new RegExp('[\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u206F\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0]', 'g')
// Unicode tag characters can spell hidden ASCII ("ASCII smuggling"): read them as the letters they hide.
const TAGS = /[\u{E0000}-\u{E007F}]+/gu

// Cyrillic and Greek letters that look like Latin ones, after lowercasing.
const HOMOGLYPHS = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
  і: 'i', ї: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ӏ: 'l', ո: 'n', ս: 'u', ԛ: 'q', ԝ: 'w', ѡ: 'w',
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
}
const HOMOGLYPH = new RegExp(`[${Object.keys(HOMOGLYPHS).join('')}]`, 'g')

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i', '|': 'l' }

// NFKC folds full-width and "math bold" letters into plain ones; tags become ASCII; invisibles go.
export function visible(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(TAGS, (run) => {
      const hidden = [...run]
        .map((char) => char.codePointAt(0) - 0xe0000)
        .filter((code) => code >= 0x20 && code < 0x7f)
        .map((code) => String.fromCharCode(code))
        .join('')
      // Spaces around it, so the hidden words can't glue onto the visible ones.
      return hidden ? ` ${hidden} ` : ''
    })
    .replace(INVISIBLE, '')
}

// Lowercase, Latin look-alikes, no accents ("instruções" reads "instrucoes"), single spaces.
export function normalize(text) {
  return visible(text)
    .toLowerCase()
    .replace(HOMOGLYPH, (char) => HOMOGLYPHS[char])
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019\u02BC`\u00B4]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

const rot13 = (text) => text.replace(/[a-z]/g, (char) => String.fromCharCode(((char.charCodeAt(0) - 97 + 13) % 26) + 97))

// "i g n o r e  a l l" or "i.g.n.o.r.e": four or more single letters in a row, split by separators.
const SPACED_LETTERS = /(?:^|[^a-z])(?:[a-z][\s.\-_*|\u00B7]+){4,}[a-z](?![a-z])/

// Mostly readable text: an encoded blob that decodes into words, not into binary.
function readable(text) {
  if (text.length < 8 || !/\s/.test(text)) return false
  let printable = 0
  for (const char of text) if (/[\p{L}\p{N}\p{P}\p{Zs}\n]/u.test(char)) printable++
  return printable / text.length > 0.9
}

const BASE64 = /[A-Za-z0-9+/_-]{16,}={0,2}/g
const HEX = /(?:[0-9a-fA-F]{2}[\s:]?){12,}/g
const PERCENT = /(?:%[0-9a-fA-F]{2}){6,}/g

// Blobs that decode (base64, hex, %-escapes) into readable text: what a "decode this and follow it" hides.
export function decodedBlobs(text) {
  const raw = visible(text)
  const found = []
  for (const blob of raw.match(BASE64) ?? []) {
    const decoded = Buffer.from(blob.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    if (readable(decoded)) found.push(decoded)
  }
  for (const blob of raw.match(HEX) ?? []) {
    const decoded = Buffer.from(blob.replace(/[\s:]/g, ''), 'hex').toString('utf8')
    if (readable(decoded)) found.push(decoded)
  }
  for (const blob of raw.match(PERCENT) ?? []) {
    try {
      const decoded = decodeURIComponent(blob)
      if (readable(decoded)) found.push(decoded)
    } catch {
      // Not valid escapes: nothing hidden there.
    }
  }
  return found
}

// Every form a strong rule is tested on: { text, compact }. compact forms have no spaces at all, so
// the rules match them without word boundaries.
export function variants(text) {
  const base = normalize(text)
  const forms = [
    { text: base, compact: false },
    { text: base.replace(/[013457@$!|]/g, (char) => LEET[char]), compact: false },
    { text: rot13(base), compact: false },
    { text: [...base].reverse().join(''), compact: false },
  ]
  if (SPACED_LETTERS.test(base)) forms.push({ text: base.replace(/[\s.\-_*|\u00B7]+/g, ''), compact: true })
  for (const decoded of decodedBlobs(text)) forms.push({ text: normalize(decoded), compact: false })
  return forms
}
