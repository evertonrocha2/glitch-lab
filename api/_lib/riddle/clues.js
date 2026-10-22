import { LANGUAGES } from '../../../shared/riddle/languages.js'

// What would give a Glitchdle answer away: the language's name, its file extension, or a tool
// named after it (rustc, javac...). Checked on every AI error message and on the samples (tests).

// Tool and ecosystem names that say the language as plainly as its name does.
export const GIVEAWAYS = {
  javascript: ['node.js', 'nodejs', 'npm'],
  typescript: ['tsc', 'tsconfig'],
  python: ['pip', 'cpython', 'pypi'],
  java: ['javac', 'jvm', 'jdk'],
  c: ['gcc'],
  cpp: ['g++', 'clang++'],
  csharp: ['csc', 'dotnet', '.net'],
  go: ['golang', 'go:', 'go build', 'go run'],
  rust: ['rustc', 'cargo'],
  ruby: ['irb', 'rubygems', 'bundler'],
  php: [],
  swift: ['swiftc', 'xcode'],
  kotlin: ['kotlinc'],
  scala: ['scalac', 'sbt'],
  haskell: ['ghc', 'ghci', 'cabal'],
  elixir: ['iex', 'mix'],
  erlang: ['erlc'],
  clojure: ['lein', 'leiningen'],
  lua: ['luajit'],
  perl: ['cpan'],
  r: ['Rscript', 'CRAN'],
  dart: ['flutter'],
  julia: [],
  ocaml: ['ocamlc', 'dune', 'utop'],
  fsharp: ['fsc', 'fsi', 'dotnet'],
  zig: [],
  nim: ['nimble'],
  crystal: [],
  groovy: ['groovyc', 'gradle'],
  'objective-c': ['objc', 'obj-c'],
  vbnet: ['visual basic', 'vb.net', 'vbc'],
  fortran: ['gfortran'],
  cobol: ['gnucobol', 'cobc'],
  prolog: ['swipl'],
  sql: ['postgres', 'postgresql', 'mysql', 'sqlite'],
  bash: ['zsh'],
  elm: [],
  coffeescript: ['coffee'],
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// A whole word: no letter right before or after (digits and punctuation are fine, so "python3" counts).
const word = (term, flags) => new RegExp(`(?<![A-Za-z])${escape(term)}(?![A-Za-z])`, flags)

// Names of one or two characters (C, R, Go, C#, F#) only count with their capitals: "go" and "r"
// are everyday words. Longer names count in any case.
const nameRule = (name) => word(name, name.length <= 2 ? 'u' : 'iu')

// Other languages' names (4+ letters) don't belong in a riddle either: they confuse more than help.
const OTHER_NAMES = LANGUAGES.filter((item) => item.name.length >= 4)

// The first thing in `text` that names or points at `language`, or null when it's clean.
export function giveawayIn(text, language) {
  if (nameRule(language.name).test(text)) return language.name
  // An extension follows a file name, so only its end needs a boundary: "main.py" counts.
  if (new RegExp(`${escape(language.extension)}(?![A-Za-z])`, 'i').test(text)) return language.extension
  for (const term of GIVEAWAYS[language.id] ?? []) if (word(term, 'iu').test(text)) return term
  // Aliases name the language too (rails, phoenix, tsql...); very short ones would match by chance.
  for (const alias of language.aliases ?? []) if (alias.length >= 3 && word(alias, 'iu').test(text)) return alias
  for (const other of OTHER_NAMES) if (other.id !== language.id && word(other.name, 'iu').test(text)) return other.name
  return null
}

export const MAX_ERROR_CHARS = 280
export const MAX_ERROR_LINES = 6

// Why an error message can't be used for `language`, or null when it can.
export function errorProblem(text, language) {
  if (typeof text !== 'string' || text.trim().length < 12) return 'too short'
  if (text.length > MAX_ERROR_CHARS) return 'too long'
  if (text.split('\n').length > MAX_ERROR_LINES) return 'too many lines'
  if (text.includes('```')) return 'not plain text'
  const giveaway = giveawayIn(text, language)
  return giveaway ? `names ${giveaway}` : null
}

export const MIN_SNIPPET_LINES = 4
export const MAX_SNIPPET_LINES = 12
export const MAX_SNIPPET_LINE_CHARS = 90

// Why a snippet can't be used for `language`, or null when it can.
export function snippetProblem(code, language) {
  if (typeof code !== 'string') return 'missing'
  const lines = code.replace(/\s+$/, '').split('\n')
  if (lines.filter((line) => line.trim()).length < MIN_SNIPPET_LINES) return 'too short'
  if (lines.length > MAX_SNIPPET_LINES) return 'too many lines'
  if (lines.some((line) => line.length > MAX_SNIPPET_LINE_CHARS)) return 'lines too long'
  if (code.includes('```')) return 'not plain code'
  const giveaway = giveawayIn(code, language)
  return giveaway ? `names ${giveaway}` : null
}
