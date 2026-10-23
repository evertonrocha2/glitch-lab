// A ready-made board for the demo account, so judges see every column without waiting on the AI.
const DEMO_CASES = [
  {
    status: 'new',
    passedCount: 0,
    error: "TypeError: Cannot read properties of undefined (reading 'length')",
    code: 'const user = {}\nconsole.log(user.name.length)',
    concept: 'undefined-access',
    language: 'javascript',
    analysis: {
      explicacao:
        'Your code asked for the length of user.name, but user has no name yet. JavaScript gives back undefined for a missing property, and undefined has nothing inside it to read.',
      causa:
        'Reading a property that does not exist is allowed and returns undefined. Reading a property OF undefined is not: undefined is not an object, so asking it for .length stops the program.',
      correcao: "Give the object the property first, or check it before reading:\nconst user = { name: 'Ada' }\nconsole.log(user.name?.length)",
      exercicio: {
        enunciado: 'const book = {}\nconsole.log(book.title.toUpperCase())',
        resposta: "const book = { title: 'Dune' }\nconsole.log(book.title.toUpperCase())\nbook.title must exist before you call a method on it.",
      },
    },
  },
  {
    status: 'new',
    passedCount: 0,
    error: 'IndentationError: expected an indented block',
    code: 'def greet(name):\nprint("Hi", name)',
    concept: 'indentation-syntax',
    language: 'python',
    analysis: {
      explicacao: 'Python expected the body of greet to be indented, but the print line starts at the left edge.',
      causa:
        'Python uses indentation to know which lines belong to a function, loop or if. A line ending in a colon promises an indented block right after it.',
      correcao: 'def greet(name):\n    print("Hi", name)',
      exercicio: {
        enunciado: 'for n in range(3):\nprint(n)',
        resposta: 'for n in range(3):\n    print(n)\nThe loop body must be indented under the for line.',
      },
    },
  },
  {
    status: 'training',
    passedCount: 1,
    error: 'IndexError: list index out of range',
    code: 'nums = [10, 20, 30]\nprint(nums[3])',
    concept: 'index-out-of-range',
    language: 'python',
    analysis: {
      explicacao: 'You asked for position 3 of a list that only has positions 0, 1 and 2.',
      causa:
        'Python counts list positions from 0, so the last item of a list with 3 items is at index 2. Index 3 points one step past the end.',
      correcao: 'print(nums[2])  # or nums[-1] for the last item',
      exercicio: {
        enunciado: "colors = ['red', 'blue']\nprint(colors[2])",
        resposta: 'print(colors[1])\nTwo items means the indexes are 0 and 1.',
      },
    },
    challenge: {
      brokenCode: "scores = [7, 9, 4, 10]\nfor i in range(1, len(scores) + 1):\n    print(scores[i])",
      symptom: 'IndexError: list index out of range',
      hints: [
        'Look at the numbers range() gives the loop.',
        'The last value of i is len(scores), which is 4.',
        'Start the range at 0 and stop at len(scores).',
      ],
      solution: 'scores = [7, 9, 4, 10]\nfor i in range(len(scores)):\n    print(scores[i])',
      bugExplanation: 'range(1, len(scores) + 1) ends at 4, but the last valid index is 3.',
    },
  },
  {
    status: 'solved',
    passedCount: 2,
    error: 'ReferenceError: x is not defined',
    code: 'function total() {\n  return x + 1\n}\ntotal()',
    concept: 'not-defined',
    language: 'javascript',
    analysis: {
      explicacao: 'total() uses a variable called x, but x was never created anywhere the function can see.',
      causa:
        'Before you read a variable, it has to be declared (let, const, a parameter) in the current scope or an outer one. JavaScript cannot guess what x should be.',
      correcao: 'function total(x) {\n  return x + 1\n}\ntotal(4)',
      exercicio: {
        enunciado: 'function double() {\n  return n * 2\n}\ndouble()',
        resposta: 'function double(n) {\n  return n * 2\n}\ndouble(5)\nn now arrives as a parameter.',
      },
    },
  },
]

// The same sample board for a Portuguese reader (Accept-Language pt-BR): the texts the student
// reads, by bug type. Errors and code stay exactly as the languages print them.
const DEMO_CASES_PT = {
  'undefined-access': {
    analysis: {
      explicacao:
        'Seu código pediu o tamanho de user.name, mas user ainda não tem name. O JavaScript devolve undefined para uma propriedade que não existe, e undefined não tem nada dentro para ler.',
      causa:
        'Ler uma propriedade que não existe é permitido e devolve undefined. Ler uma propriedade DE undefined não é: undefined não é um objeto, então pedir .length a ele para o programa.',
      correcao: "Dê a propriedade ao objeto primeiro, ou confira antes de ler:\nconst user = { name: 'Ada' }\nconsole.log(user.name?.length)",
      exercicio: {
        enunciado: 'const book = {}\nconsole.log(book.title.toUpperCase())',
        resposta: "const book = { title: 'Dune' }\nconsole.log(book.title.toUpperCase())\nbook.title precisa existir antes de você chamar um método nele.",
      },
    },
  },
  'indentation-syntax': {
    analysis: {
      explicacao: 'O Python esperava que o corpo de greet viesse indentado, mas a linha do print começa colada na margem esquerda.',
      causa:
        'O Python usa a indentação para saber quais linhas pertencem a uma função, a um loop ou a um if. Uma linha que termina em dois-pontos promete um bloco indentado logo depois.',
      correcao: 'def greet(name):\n    print("Hi", name)',
      exercicio: {
        enunciado: 'for n in range(3):\nprint(n)',
        resposta: 'for n in range(3):\n    print(n)\nO corpo do loop precisa estar indentado embaixo da linha do for.',
      },
    },
  },
  'index-out-of-range': {
    analysis: {
      explicacao: 'Você pediu a posição 3 de uma lista que só tem as posições 0, 1 e 2.',
      causa:
        'O Python conta as posições de uma lista a partir do 0, então o último item de uma lista com 3 itens fica no índice 2. O índice 3 aponta um passo depois do fim.',
      correcao: 'print(nums[2])  # ou nums[-1] para o último item',
      exercicio: {
        enunciado: "colors = ['red', 'blue']\nprint(colors[2])",
        resposta: 'print(colors[1])\nDois itens quer dizer que os índices são 0 e 1.',
      },
    },
    challenge: {
      hints: [
        'Olhe os números que o range() entrega para o loop.',
        'O último valor de i é len(scores), que é 4.',
        'Comece o range no 0 e pare em len(scores).',
      ],
      bugExplanation: 'range(1, len(scores) + 1) termina em 4, mas o último índice válido é 3.',
    },
  },
  'not-defined': {
    analysis: {
      explicacao: 'total() usa uma variável chamada x, mas x nunca foi criada em nenhum lugar que a função enxergue.',
      causa:
        'Antes de ler uma variável, ela precisa ser declarada (let, const, um parâmetro) no escopo atual ou em um escopo de fora. O JavaScript não tem como adivinhar o que x deveria ser.',
      correcao: 'function total(x) {\n  return x + 1\n}\ntotal(4)',
      exercicio: {
        enunciado: 'function double() {\n  return n * 2\n}\ndouble()',
        resposta: 'function double(n) {\n  return n * 2\n}\ndouble(5)\nAgora n chega como parâmetro.',
      },
    },
  },
}

// The sample board in the reader's language: English, or the Portuguese texts over the same cases.
function demoCases(locale) {
  if (locale !== 'pt-BR') return DEMO_CASES
  return DEMO_CASES.map((kase) => {
    const pt = DEMO_CASES_PT[kase.concept]
    return { ...kase, analysis: pt.analysis, ...(kase.challenge ? { challenge: { ...kase.challenge, ...pt.challenge } } : {}) }
  })
}

import { MISSION_XP } from '../../../shared/trails.js'
import { serverDay } from '../../core/days.js'

// Earlier, shorter sessions over the past two months, so the demo's activity graph has a history.
// Day 4 stays empty, so the current streak is still the 3 days below.
const DEMO_STUDY_HISTORY = [
  [6, 15], [8, 25], [9, 10], [12, 40], [15, 20], [16, 12], [19, 35], [23, 18], [27, 22],
  [30, 30], [33, 14], [37, 26], [41, 16], [44, 45], [48, 20], [52, 11], [58, 28], [63, 19],
]

// Minutes studied 3, 2 and 1 days ago: a 3-day streak, and one day long enough for Deep focus.
const DEMO_STUDY_MINUTES = [20, 35, 15]

const PASSED_HINTS = {
  en: ['Read the error again.', 'Look at the line it names.', 'Compare with the fix on the card.'],
  'pt-BR': ['Leia o erro de novo.', 'Olhe a linha que ele aponta.', 'Compare com a correção no card.'],
}

// A challenge the demo already beat, built from the case's own practice exercise.
async function seedPassedChallenge(store, userId, kase, hintsRevealed, locale) {
  const { enunciado, resposta } = kase.analysis.exercicio
  const challenge = await store.createChallenge(
    userId,
    { caseId: kase.id, brokenCode: enunciado, symptom: kase.error, language: kase.language, hints: PASSED_HINTS[locale] ?? PASSED_HINTS.en },
    { solution: resposta, bugExplanation: kase.analysis.causa },
  )
  await store.updateChallenge(userId, challenge.id, { status: 'passed', attempts: 1, hintsRevealed })
}

const NOTE_TEXT = {
  en: {
    title: 'My debugging notebook',
    heading: 'Things I keep getting wrong',
    undefined: 'Reading a property of something that is not there yet. Check the object exists before going deeper.',
    chaining: 'Try optional chaining (?.) in my own project',
    lists: 'Lists start at 0. The last index is length - 1.',
    gym: 'Pass the second gym challenge for this one',
  },
  'pt-BR': {
    title: 'Meu caderno de debugging',
    heading: 'Coisas que eu sempre erro',
    undefined: 'Ler uma propriedade de algo que ainda não existe. Confira se o objeto existe antes de ir mais fundo.',
    chaining: 'Testar optional chaining (?.) no meu próprio projeto',
    lists: 'Listas começam no 0. O último índice é length - 1.',
    gym: 'Passar no segundo desafio do gym deste caso',
  },
}

function demoNote(byConcept, locale) {
  const text = NOTE_TEXT[locale] ?? NOTE_TEXT.en
  return {
    title: text.title,
    blocks: [
      { id: 'demo-1', type: 'heading', text: text.heading },
      { id: 'demo-2', type: 'text', text: text.undefined },
      { id: 'demo-3', type: 'case', caseId: byConcept['undefined-access'].id },
      { id: 'demo-4', type: 'todo', text: text.chaining, done: true },
      { id: 'demo-5', type: 'text', text: text.lists },
      { id: 'demo-6', type: 'case', caseId: byConcept['index-out-of-range'].id },
      { id: 'demo-7', type: 'todo', text: text.gym, done: false },
    ],
  }
}

// The demo's profile shows off badges the seed above really earns (solved case, clean pass, 3-day streak).
const DEMO_PROFILE = {
  displayName: 'Demo Dev',
  bio: 'Learning to read error messages one case at a time.',
  featuredBadges: ['case-closed', 'sharp-eye', 'on-a-roll'],
  // "About you", so judges see a filled-in card. Links stay empty: they would point at real people.
  role: 'student',
  headline: 'Learning JavaScript and Python at night',
  university: 'Glitch Academy',
  course: 'Software Engineering',
  work: 'Support analyst',
  location: 'Rio de Janeiro',
  languages: ['javascript', 'python', 'sql'],
  links: {},
  openTo: ['study-buddies', 'mentoring'],
}

// The words on the sample profile for a Portuguese reader; the rest stays as above.
const DEMO_PROFILE_PT = {
  displayName: 'Dev Demo',
  bio: 'Aprendendo a ler mensagens de erro, um caso de cada vez.',
  headline: 'Estudando JavaScript e Python à noite',
  course: 'Engenharia de Software',
  work: 'Analista de suporte',
}

const DAY_MS = 24 * 3_600_000
const daysBefore = (day, count) => new Date(Date.parse(`${day}T00:00:00Z`) - count * DAY_MS).toISOString().slice(0, 10)

// A study trail that started before the seeded study days, so the seeded gym pass, note and study
// minutes already tick the first three missions. XP per kind comes from shared/trails.js, like a real trail.
// Each mission's [title, description], in the order demoTrail lists them.
const TRAIL_TEXT = {
  en: {
    title: 'Index and undefined bootcamp',
    summary: 'Your open cases are mostly about reading things that are not there. This trail trains both, then checks you can explain them.',
    missions: [
      ['Beat a list index challenge', 'Pass a gym challenge on your IndexError case. It is still in training, so one more pass helps it stick.'],
      ['Write down the undefined rule', 'Add your TypeError case to a note and say, in your own words, why reading undefined fails.'],
      ['Study for 30 focused minutes', 'Run the timer while you reread your cases. Short, regular sessions stick best.'],
      ['Train your undefined case', 'Fix a fresh program with the same bug. Try it without hints for extra XP.'],
      ['Investigate an off-by-one bug', 'Next time a loop goes one step too far, paste the error on your board.'],
      ['Explain why lists start at 0', 'Think it through: why is the last index of a list length - 1? Mark it done when you can say it out loud.'],
    ],
  },
  'pt-BR': {
    title: 'Bootcamp de índice e undefined',
    summary: 'Seus casos abertos são quase todos sobre ler coisas que não existem. Esta trilha treina os dois e depois confere se você consegue explicar.',
    missions: [
      ['Vença um desafio de índice de lista', 'Passe em um desafio do gym no seu caso de IndexError. Ele ainda está em treino, então mais uma vitória ajuda a fixar.'],
      ['Anote a regra do undefined', 'Coloque seu caso de TypeError em uma nota e explique, com suas palavras, por que ler undefined dá erro.'],
      ['Estude por 30 minutos com foco', 'Rode o timer enquanto relê seus casos. Sessões curtas e frequentes fixam melhor.'],
      ['Treine seu caso de undefined', 'Conserte um programa novo com o mesmo bug. Tente sem dicas para ganhar XP extra.'],
      ['Investigue um bug de um a mais', 'Na próxima vez que um loop passar um passo do ponto, cole o erro no seu board.'],
      ['Explique por que listas começam no 0', 'Pense bem: por que o último índice de uma lista é length - 1? Marque como feita quando conseguir explicar em voz alta.'],
    ],
  },
}

function demoTrail(byConcept, startDay, locale) {
  const text = TRAIL_TEXT[locale] ?? TRAIL_TEXT.en
  const missions = [
    { kind: 'train', caseId: byConcept['index-out-of-range'].id, concept: 'index-out-of-range' },
    { kind: 'note', caseId: byConcept['undefined-access'].id, concept: 'undefined-access' },
    { kind: 'study', minutes: 30 },
    { kind: 'train', caseId: byConcept['undefined-access'].id, concept: 'undefined-access' },
    { kind: 'investigate', concept: 'off-by-one' },
    { kind: 'reflect' },
  ].map(({ kind, ...rest }, index) => ({ kind, title: text.missions[index][0], description: text.missions[index][1], ...rest }))
  return {
    title: text.title,
    summary: text.summary,
    missions: missions.map((mission, index) => ({ id: `m${index + 1}`, ...mission, xp: MISSION_XP[mission.kind] })),
    done: [],
    createdAt: `${startDay}T00:00:00.000Z`,
  }
}

// Returns false (and changes nothing) when the account already has cases.
// today is the visitor's own date, so the streak lines up with their clock. locale is the
// visitor's language: 'pt-BR' seeds the Portuguese texts, and the community samples and live event
// in Portuguese too (made once per language, shared by every demo in it).
export async function seedDemo(store, userId, today = serverDay(), locale = 'en') {
  if ((await store.listCases(userId)).length > 0) return false

  const byConcept = {}
  for (const { status, passedCount, challenge, ...fields } of demoCases(locale)) {
    const created = await store.createCase(userId, fields)
    await store.updateCase(userId, created.id, { status, passedCount })
    byConcept[fields.concept] = created
    // One passed challenge per pass already on the card; the first one without hints.
    for (let pass = 0; pass < passedCount; pass++) await seedPassedChallenge(store, userId, created, pass === 0 ? 0 : 2, locale)
    if (challenge) {
      const { solution, bugExplanation, ...publicPart } = challenge
      await store.createChallenge(userId, { caseId: created.id, language: fields.language, ...publicPart }, { solution, bugExplanation })
    }
  }

  await store.createNote(userId, demoNote(byConcept, locale))
  for (const [index, minutes] of DEMO_STUDY_MINUTES.entries()) {
    const day = daysBefore(today, DEMO_STUDY_MINUTES.length - index)
    await store.addStudyTime(userId, day, minutes * 60, minutes * 60)
  }
  for (const [daysAgo, minutes] of DEMO_STUDY_HISTORY) await store.addStudyTime(userId, daysBefore(today, daysAgo), minutes * 60, minutes * 60)
  await store.createTrail(userId, demoTrail(byConcept, daysBefore(today, DEMO_STUDY_MINUTES.length), locale))
  // Only a fresh profile gets the sample one, so a demo's own edits are never overwritten.
  if (!(await store.getProfile(userId))?.displayName) await store.updateProfile(userId, locale === 'pt-BR' ? { ...DEMO_PROFILE, ...DEMO_PROFILE_PT } : DEMO_PROFILE)
  // Nothing public: the demo never writes articles, events or people into the shared feeds.
  return true
}
