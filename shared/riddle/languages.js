// Glitchdle's languages and the attributes players compare in Classic mode.
// Public on purpose: the browser uses this list for the guess box and the attribute labels.
// Which language is today's answer lives only on the server (server/modules/glitchdle).
// Error samples and snippets sit apart in samples.js, so they never ship to the browser.
//
// When a classification is debatable we pick the mainstream answer and say why in a comment.
// Players are graded on these values, so change them with care.

import { LANGUAGE_QUESTIONS } from './catalogs/language-questions.js'
import { bucketOf, POPULARITY, POPULARITY_STEPS } from './popularity.js'
import { searchItems } from './search.js'

export const PARADIGMS = ['imperative', 'object-oriented', 'functional', 'concurrent', 'logic', 'declarative']
export const TYPING = ['static', 'dynamic', 'gradual']
export const STRENGTH = ['strong', 'weak']
export const EXECUTION = ['compiled', 'interpreted', 'jit', 'transpiled']
// 'engine': the language has no memory model of its own; the database or shell handles it.
export const MEMORY = ['gc', 'manual', 'ownership', 'arc', 'refcount', 'engine']
export const DOMAINS = [
  'web',
  'backend',
  'mobile',
  'desktop',
  'systems',
  'embedded',
  'data',
  'scientific',
  'games',
  'scripting',
  'enterprise',
  'academic',
  'databases',
  'devops',
  'tooling',
]
export const SYNTAX = ['c-like', 'python-like', 'lisp', 'ml', 'ruby-like', 'basic', 'other']
// What runs the program. 'own-runtime': the language's own VM or JIT runtime (the BEAM, Julia's).
export const RUNTIMES = ['native', 'jvm', 'dotnet', 'js-engine', 'own-runtime', 'interpreter', 'database']
export const YES_NO = ['yes', 'no']
// Close: both run on a virtual machine that compiles while the program runs.
export const RUNTIME_FAMILY = { jvm: 'vm', dotnet: 'vm', 'js-engine': 'vm', 'own-runtime': 'vm' }

// What each value reads like on a cell.
export const LABELS = {
  imperative: 'Imperative',
  'object-oriented': 'OOP',
  functional: 'Functional',
  concurrent: 'Concurrent',
  logic: 'Logic',
  declarative: 'Declarative',
  static: 'Static',
  dynamic: 'Dynamic',
  gradual: 'Gradual',
  strong: 'Strong',
  weak: 'Weak',
  compiled: 'Compiled',
  interpreted: 'Interpreted',
  jit: 'JIT / VM',
  transpiled: 'Transpiled',
  gc: 'Garbage collector',
  manual: 'Manual',
  ownership: 'Ownership',
  arc: 'ARC',
  refcount: 'Ref counting',
  engine: 'Engine handles it',
  web: 'Web',
  backend: 'Backend',
  mobile: 'Mobile',
  desktop: 'Desktop',
  systems: 'Systems',
  embedded: 'Embedded',
  data: 'Data',
  scientific: 'Science',
  games: 'Games',
  scripting: 'Scripting',
  enterprise: 'Enterprise',
  academic: 'Academic',
  databases: 'Databases',
  devops: 'DevOps',
  tooling: 'Tooling',
  'c-like': 'C-like',
  'python-like': 'Python-like',
  lisp: 'Lisp',
  ml: 'ML',
  'ruby-like': 'Ruby-like',
  basic: 'BASIC',
  other: 'Other',
  native: 'Native code',
  jvm: 'JVM',
  dotnet: '.NET',
  'js-engine': 'JS engine',
  'own-runtime': 'Own runtime',
  interpreter: 'Interpreter',
  database: 'Database',
  yes: 'Yes',
  no: 'No',
  niche: 'Under 10k',
  known: '10k to 100k',
  popular: '100k to 1M',
  huge: '1M+',
}

export const label = (value) => LABELS[value] ?? String(value)

// The Classic board's columns, in order.
export const ATTRIBUTES = [
  { key: 'paradigms', name: 'Paradigms', kind: 'set' },
  { key: 'typing', name: 'Typing', kind: 'one' },
  { key: 'strength', name: 'Type strength', kind: 'one' },
  { key: 'execution', name: 'Execution', kind: 'one' },
  { key: 'runtime', name: 'Runs on', kind: 'one', family: RUNTIME_FAMILY, values: RUNTIMES },
  { key: 'memory', name: 'Memory', kind: 'one' },
  { key: 'domains', name: 'Main domains', kind: 'set' },
  { key: 'syntax', name: 'Syntax family', kind: 'one' },
  // Binary and easy to guess: left out of the share grid (shared/riddle/share.js).
  { key: 'indentation', name: 'Significant indentation', kind: 'one', values: YES_NO, share: false },
  { key: 'standard', name: 'ISO or Ecma standard', kind: 'one', values: YES_NO, share: false },
  { key: 'popularity', name: 'SO questions', kind: 'rank', values: POPULARITY },
  { key: 'year', name: 'First appeared', kind: 'year' },
]

// popularity: the Stack Overflow bucket, from the counts scripts/sync-glitchdle.mjs saves.
const lang = (id, name, fields) => ({ id, name, ...fields, popularity: bucketOf(LANGUAGE_QUESTIONS[id], POPULARITY_STEPS.languages) })

export const LANGUAGES = [
  lang('javascript', 'JavaScript', {
    aliases: ['js', 'ecmascript', 'node'],
    year: 1995,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'dynamic',
    strength: 'weak',
    // Every major engine (V8, SpiderMonkey, JavaScriptCore) JIT-compiles it.
    execution: 'jit',
    memory: 'gc',
    domains: ['web', 'backend', 'mobile', 'desktop'],
    syntax: 'c-like',
    extension: '.js',
    runtime: 'js-engine',
    indentation: 'no',
    // ECMA-262 (ECMAScript), also ISO/IEC 16262.
    standard: 'yes',
  }),
  lang('typescript', 'TypeScript', {
    aliases: ['ts'],
    year: 2012,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    // `any` and plain JS files type-check side by side: the textbook gradual type system.
    typing: 'gradual',
    // The checker rejects most of the implicit coercions JavaScript allows.
    strength: 'strong',
    execution: 'transpiled',
    memory: 'gc',
    domains: ['web', 'backend'],
    syntax: 'c-like',
    extension: '.ts',
    // Compiles to JavaScript; Deno and Bun strip the types and hand it to a JS engine too.
    runtime: 'js-engine',
    indentation: 'no',
    standard: 'no',
  }),
  lang('python', 'Python', {
    aliases: ['py', 'python3', 'cpython'],
    year: 1991,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    // Type hints exist, but nothing enforces them at runtime: mainstream "dynamic".
    typing: 'dynamic',
    strength: 'strong',
    // CPython compiles to bytecode and interprets it.
    execution: 'interpreted',
    // CPython counts references with a cycle collector on top; mainstream answer: garbage collected.
    memory: 'gc',
    domains: ['data', 'scientific', 'backend', 'scripting'],
    syntax: 'python-like',
    extension: '.py',
    runtime: 'interpreter',
    indentation: 'yes',
    standard: 'no',
  }),
  lang('java', 'Java', {
    aliases: ['jdk', 'jvm'],
    year: 1995,
    // Lambdas arrived in Java 8, but the language is object-oriented first.
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    strength: 'strong',
    // Bytecode on the JVM, JIT-compiled by HotSpot.
    execution: 'jit',
    memory: 'gc',
    domains: ['enterprise', 'backend', 'mobile'],
    syntax: 'c-like',
    extension: '.java',
    runtime: 'jvm',
    indentation: 'no',
    // Sun left the ISO and Ecma processes in the late 90s: the spec is Oracle's own.
    standard: 'no',
  }),
  lang('c', 'C', {
    aliases: ['ansi c', 'c99', 'c11'],
    year: 1972,
    paradigms: ['imperative'],
    typing: 'static',
    strength: 'weak',
    execution: 'compiled',
    memory: 'manual',
    domains: ['systems', 'embedded'],
    syntax: 'c-like',
    extension: '.c',
    runtime: 'native',
    indentation: 'no',
    // ISO/IEC 9899.
    standard: 'yes',
  }),
  lang('cpp', 'C++', {
    aliases: ['cpp', 'cplusplus', 'c plus plus'],
    year: 1985,
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    // Implicit conversions and C casts are still there: usually listed with C as weak.
    strength: 'weak',
    execution: 'compiled',
    // RAII and smart pointers help, but nothing collects garbage for you.
    memory: 'manual',
    domains: ['systems', 'games', 'desktop'],
    syntax: 'c-like',
    extension: '.cpp',
    runtime: 'native',
    indentation: 'no',
    // ISO/IEC 14882.
    standard: 'yes',
  }),
  lang('csharp', 'C#', {
    aliases: ['c sharp', 'csharp', 'cs', 'dotnet'],
    year: 2000,
    // LINQ and lambdas are there, but classes come first.
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    strength: 'strong',
    // IL code JIT-compiled by the .NET runtime.
    execution: 'jit',
    memory: 'gc',
    domains: ['enterprise', 'games', 'desktop', 'backend'],
    syntax: 'c-like',
    extension: '.cs',
    runtime: 'dotnet',
    indentation: 'no',
    // ECMA-334 and ISO/IEC 23270.
    standard: 'yes',
  }),
  lang('go', 'Go', {
    aliases: ['golang'],
    year: 2009,
    // Goroutines and channels are the language's signature.
    paradigms: ['imperative', 'concurrent'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'gc',
    domains: ['backend', 'devops'],
    syntax: 'c-like',
    extension: '.go',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('rust', 'Rust', {
    aliases: ['rs', 'rustlang'],
    // 1.0 shipped in 2015; earlier releases were pre-stable experiments.
    year: 2015,
    // Traits instead of classes: no object-oriented inheritance. Fearless concurrency is a headline feature.
    paradigms: ['imperative', 'functional', 'concurrent'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'ownership',
    domains: ['systems', 'embedded', 'tooling'],
    syntax: 'c-like',
    extension: '.rs',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('ruby', 'Ruby', {
    aliases: ['rb', 'rails'],
    year: 1995,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'dynamic',
    strength: 'strong',
    // The reference interpreter (CRuby); YJIT is optional.
    execution: 'interpreted',
    memory: 'gc',
    domains: ['web', 'backend', 'scripting'],
    syntax: 'ruby-like',
    extension: '.rb',
    runtime: 'interpreter',
    indentation: 'no',
    // ISO/IEC 30170 (2012), after JIS X 3017.
    standard: 'yes',
  }),
  lang('php', 'PHP', {
    aliases: ['php8'],
    year: 1995,
    paradigms: ['imperative', 'object-oriented'],
    // Type declarations are optional and checked at runtime: mainstream "dynamic".
    typing: 'dynamic',
    strength: 'weak',
    // The Zend engine interprets opcodes; the JIT added in PHP 8 is off by default.
    execution: 'interpreted',
    // Reference counting plus a cycle collector since 5.3, like Python: garbage collected.
    memory: 'gc',
    domains: ['web', 'backend'],
    syntax: 'c-like',
    extension: '.php',
    runtime: 'interpreter',
    indentation: 'no',
    standard: 'no',
  }),
  lang('swift', 'Swift', {
    aliases: ['swiftui'],
    year: 2014,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'arc',
    domains: ['mobile', 'desktop'],
    syntax: 'c-like',
    extension: '.swift',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('kotlin', 'Kotlin', {
    aliases: ['kt'],
    year: 2011,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'static',
    strength: 'strong',
    // Mostly runs on the JVM (Android included); Native and JS targets exist.
    execution: 'jit',
    memory: 'gc',
    domains: ['mobile', 'backend'],
    syntax: 'c-like',
    extension: '.kt',
    // Kotlin/Native and Kotlin/JS exist, but servers and Android (ART, a JVM in all but name) are where it runs.
    runtime: 'jvm',
    indentation: 'no',
    standard: 'no',
  }),
  lang('scala', 'Scala', {
    aliases: ['sc'],
    year: 2004,
    paradigms: ['object-oriented', 'functional'],
    typing: 'static',
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['data', 'backend'],
    // Braces in Scala 2; Scala 3 also allows indentation, but most code is brace-style.
    syntax: 'c-like',
    extension: '.scala',
    runtime: 'jvm',
    // Scala 3 lets you drop braces, but it is optional and every Scala 2 file uses braces.
    indentation: 'no',
    standard: 'no',
  }),
  lang('haskell', 'Haskell', {
    aliases: ['hs', 'ghc'],
    year: 1990,
    paradigms: ['functional'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'gc',
    domains: ['academic', 'backend'],
    syntax: 'ml',
    extension: '.hs',
    // GHC builds native binaries.
    runtime: 'native',
    // The layout rule: braces and semicolons exist but almost nobody writes them.
    indentation: 'yes',
    // The Haskell 2010 Report is the community's own, not ISO or Ecma.
    standard: 'no',
  }),
  lang('elixir', 'Elixir', {
    aliases: ['ex', 'phoenix'],
    year: 2012,
    paradigms: ['functional', 'concurrent'],
    // Gradual set-theoretic types are arriving from 1.17 on; today it is a dynamic language.
    typing: 'dynamic',
    strength: 'strong',
    // BEAM bytecode, JIT-compiled since OTP 24.
    execution: 'jit',
    memory: 'gc',
    domains: ['web', 'backend'],
    syntax: 'ruby-like',
    extension: '.ex',
    // The BEAM, Erlang's virtual machine.
    runtime: 'own-runtime',
    indentation: 'no',
    standard: 'no',
  }),
  lang('erlang', 'Erlang', {
    aliases: ['erl', 'otp', 'beam'],
    year: 1986,
    paradigms: ['functional', 'concurrent'],
    typing: 'dynamic',
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['backend'],
    // Its syntax comes from Prolog: none of the other families.
    syntax: 'other',
    extension: '.erl',
    // The BEAM, its own virtual machine.
    runtime: 'own-runtime',
    indentation: 'no',
    standard: 'no',
  }),
  lang('clojure', 'Clojure', {
    aliases: ['clj', 'cljs'],
    year: 2007,
    paradigms: ['functional'],
    typing: 'dynamic',
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['backend', 'data'],
    syntax: 'lisp',
    extension: '.clj',
    runtime: 'jvm',
    indentation: 'no',
    standard: 'no',
  }),
  lang('lua', 'Lua', {
    aliases: ['luajit'],
    year: 1993,
    // First-class functions and closures; objects only through metatables.
    paradigms: ['imperative', 'functional'],
    typing: 'dynamic',
    // Strings and numbers convert in arithmetic ("10" + 1 is 11): weak.
    strength: 'weak',
    execution: 'interpreted',
    memory: 'gc',
    domains: ['games', 'embedded', 'scripting'],
    // Keyword blocks (then/do/end) from the Pascal and Modula line.
    syntax: 'other',
    extension: '.lua',
    runtime: 'interpreter',
    indentation: 'no',
    standard: 'no',
  }),
  lang('perl', 'Perl', {
    aliases: ['pl', 'perl5'],
    year: 1987,
    paradigms: ['imperative', 'object-oriented'],
    typing: 'dynamic',
    strength: 'weak',
    execution: 'interpreted',
    memory: 'refcount',
    domains: ['scripting', 'web'],
    syntax: 'c-like',
    extension: '.pl',
    runtime: 'interpreter',
    indentation: 'no',
    standard: 'no',
  }),
  lang('r', 'R', {
    aliases: ['rlang', 'r language', 'rstats'],
    year: 1993,
    paradigms: ['imperative', 'functional'],
    typing: 'dynamic',
    // Vectors coerce silently (c(1, "a") is all text, 1 == "1" is TRUE).
    strength: 'weak',
    execution: 'interpreted',
    memory: 'gc',
    domains: ['data', 'scientific'],
    syntax: 'c-like',
    extension: '.R',
    runtime: 'interpreter',
    indentation: 'no',
    standard: 'no',
  }),
  lang('dart', 'Dart', {
    aliases: ['flutter'],
    year: 2011,
    paradigms: ['imperative', 'object-oriented'],
    // Sound static types since Dart 2.
    typing: 'static',
    strength: 'strong',
    // JIT while developing, ahead-of-time compiled for release (Flutter apps).
    execution: 'compiled',
    memory: 'gc',
    domains: ['mobile', 'web'],
    syntax: 'c-like',
    extension: '.dart',
    // Flutter apps and `dart compile exe` ship machine code; the Dart VM is for development.
    runtime: 'native',
    indentation: 'no',
    // ECMA-408.
    standard: 'yes',
  }),
  lang('julia', 'Julia', {
    aliases: ['jl'],
    year: 2012,
    paradigms: ['imperative', 'functional'],
    // Type annotations are optional and drive dispatch, not a static check.
    typing: 'dynamic',
    strength: 'strong',
    // LLVM JIT-compiles each method the first time it runs.
    execution: 'jit',
    memory: 'gc',
    domains: ['scientific', 'data'],
    // MATLAB-like keyword blocks ending in `end`.
    syntax: 'other',
    extension: '.jl',
    // No bytecode VM, but its own runtime JIT-compiles each function on first call: programs need Julia installed.
    runtime: 'own-runtime',
    indentation: 'no',
    standard: 'no',
  }),
  lang('ocaml', 'OCaml', {
    aliases: ['ml', 'caml'],
    year: 1996,
    paradigms: ['functional', 'imperative', 'object-oriented'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'gc',
    // Compilers and dev tools (Flow, Hack, the first Rust compiler) and research.
    domains: ['academic', 'tooling'],
    syntax: 'ml',
    extension: '.ml',
    // ocamlopt (dune's default) builds native code; the bytecode VM is the other option.
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('fsharp', 'F#', {
    aliases: ['f sharp', 'fsharp', 'fs'],
    year: 2005,
    paradigms: ['functional', 'imperative', 'object-oriented'],
    typing: 'static',
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['data', 'backend'],
    syntax: 'ml',
    extension: '.fs',
    runtime: 'dotnet',
    // The "light" syntax, on by default since F# 2.0.
    indentation: 'yes',
    standard: 'no',
  }),
  lang('zig', 'Zig', {
    aliases: ['ziglang'],
    year: 2016,
    paradigms: ['imperative'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'manual',
    domains: ['systems', 'embedded'],
    syntax: 'c-like',
    extension: '.zig',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('nim', 'Nim', {
    aliases: ['nimrod', 'nimlang'],
    year: 2008,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'static',
    strength: 'strong',
    // Compiles through C to native code.
    execution: 'compiled',
    // ARC/ORC (reference counting with move semantics) is the default since 2.0.
    memory: 'arc',
    domains: ['systems', 'scripting'],
    syntax: 'python-like',
    extension: '.nim',
    // Compiles through C.
    runtime: 'native',
    indentation: 'yes',
    standard: 'no',
  }),
  lang('crystal', 'Crystal', {
    aliases: ['cr'],
    year: 2014,
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    memory: 'gc',
    domains: ['backend', 'web'],
    syntax: 'ruby-like',
    extension: '.cr',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('groovy', 'Groovy', {
    aliases: ['gradle', 'jenkinsfile'],
    year: 2003,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    // Dynamic by default, statically checked under @TypeChecked/@CompileStatic.
    typing: 'gradual',
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['devops', 'scripting'],
    syntax: 'c-like',
    extension: '.groovy',
    runtime: 'jvm',
    indentation: 'no',
    standard: 'no',
  }),
  lang('objective-c', 'Objective-C', {
    aliases: ['objc', 'obj-c', 'objective c'],
    year: 1984,
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    // A strict superset of C, with its implicit conversions.
    strength: 'weak',
    execution: 'compiled',
    memory: 'arc',
    domains: ['mobile', 'desktop'],
    syntax: 'c-like',
    extension: '.m',
    runtime: 'native',
    indentation: 'no',
    standard: 'no',
  }),
  lang('vbnet', 'Visual Basic .NET', {
    aliases: ['vb', 'vb.net', 'visual basic', 'vbnet'],
    year: 2001,
    paradigms: ['imperative', 'object-oriented'],
    typing: 'static',
    // Option Strict On, the recommended setting, forbids implicit narrowing.
    strength: 'strong',
    execution: 'jit',
    memory: 'gc',
    domains: ['desktop', 'enterprise'],
    syntax: 'basic',
    extension: '.vb',
    runtime: 'dotnet',
    indentation: 'no',
    // Only Microsoft's own spec.
    standard: 'no',
  }),
  lang('fortran', 'Fortran', {
    aliases: ['f90', 'formula translation'],
    year: 1957,
    paradigms: ['imperative'],
    typing: 'static',
    strength: 'strong',
    execution: 'compiled',
    // ALLOCATE and DEALLOCATE; no collector.
    memory: 'manual',
    domains: ['scientific'],
    syntax: 'other',
    extension: '.f90',
    runtime: 'native',
    // Free form since Fortran 90; the old fixed form cares about columns, not indentation.
    indentation: 'no',
    // ISO/IEC 1539.
    standard: 'yes',
  }),
  lang('cobol', 'COBOL', {
    aliases: ['cbl'],
    year: 1959,
    paradigms: ['imperative'],
    typing: 'static',
    // MOVE converts between PIC formats on its own.
    strength: 'weak',
    execution: 'compiled',
    // Storage is declared up front in the DATA DIVISION; nothing is collected.
    memory: 'manual',
    domains: ['enterprise'],
    syntax: 'other',
    extension: '.cob',
    runtime: 'native',
    // Fixed-format code cares about columns (areas A and B), not block indentation.
    indentation: 'no',
    // ISO/IEC 1989.
    standard: 'yes',
  }),
  lang('prolog', 'Prolog', {
    aliases: ['swi-prolog', 'swipl'],
    year: 1972,
    paradigms: ['logic', 'declarative'],
    typing: 'dynamic',
    strength: 'strong',
    execution: 'interpreted',
    memory: 'gc',
    domains: ['academic'],
    syntax: 'other',
    // Shares .pl with Perl: a fair trap for the hint.
    extension: '.pl',
    // SWI-Prolog, the usual pick, loads programs into its interactive toplevel.
    runtime: 'interpreter',
    indentation: 'no',
    // ISO/IEC 13211.
    standard: 'yes',
  }),
  lang('sql', 'SQL', {
    aliases: ['postgres', 'mysql', 'sqlite', 'tsql', 'plsql'],
    year: 1974,
    paradigms: ['declarative'],
    // Columns have declared types; we follow standard SQL (PostgreSQL), not SQLite's loose mode.
    typing: 'static',
    strength: 'strong',
    // The database plans and runs each query.
    execution: 'interpreted',
    // The database engine owns all memory; SQL itself has no memory model.
    memory: 'engine',
    domains: ['databases', 'data'],
    syntax: 'other',
    extension: '.sql',
    // The database engine runs it.
    runtime: 'database',
    indentation: 'no',
    // ISO/IEC 9075.
    standard: 'yes',
  }),
  lang('bash', 'Bash', {
    aliases: ['shell', 'sh', 'zsh'],
    year: 1989,
    paradigms: ['imperative'],
    typing: 'dynamic',
    // Everything is a string until something reads it as a number.
    strength: 'weak',
    execution: 'interpreted',
    // The shell manages its own memory; scripts never allocate or free anything.
    memory: 'engine',
    domains: ['scripting', 'devops'],
    syntax: 'other',
    extension: '.sh',
    runtime: 'interpreter',
    indentation: 'no',
    // POSIX standardizes sh; Bash is its own superset.
    standard: 'no',
  }),
  lang('elm', 'Elm', {
    aliases: ['elmlang'],
    year: 2012,
    paradigms: ['functional'],
    typing: 'static',
    strength: 'strong',
    execution: 'transpiled',
    memory: 'gc',
    domains: ['web'],
    syntax: 'ml',
    extension: '.elm',
    // Compiles to JavaScript for the browser.
    runtime: 'js-engine',
    indentation: 'yes',
    standard: 'no',
  }),
  lang('coffeescript', 'CoffeeScript', {
    aliases: ['coffee'],
    year: 2009,
    paradigms: ['imperative', 'object-oriented', 'functional'],
    typing: 'dynamic',
    strength: 'weak',
    execution: 'transpiled',
    memory: 'gc',
    domains: ['web'],
    // Significant indentation, like Python.
    syntax: 'python-like',
    extension: '.coffee',
    runtime: 'js-engine',
    indentation: 'yes',
    standard: 'no',
  }),
]

const BY_ID = new Map(LANGUAGES.map((item) => [item.id, item]))

export const languageById = (id) => BY_ID.get(id) ?? null

// The guess box: accents don't matter, best match first (see search.js).
export const searchLanguages = (query, list = LANGUAGES) => searchItems(query, list)
