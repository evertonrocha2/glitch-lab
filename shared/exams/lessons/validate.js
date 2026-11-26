// The shape of an ENEM lesson (one file per topic in this folder) and the rules it must keep.
//
// Lesson = {
//   topic: string,            the catalog topic id (shared/exams/enem.js)
//   title: string,
//   cai: string,              how the ENEM asks it, 2 to 4 sentences
//   ideias: string[],         5 to 10 core ideas
//   exemplo: {                one real ENEM question, solved
//     year: 2019..2023, number: positive integer,
//     enunciado: string,      may use the **bold** and _italic_ that QuestionText renders
//     alternativas: { A, B, C, D, E: string },
//     passos: string[],       3 to 8 steps, the last one lands on the answer
//     resposta: 'A'..'E',     the official answer
//   },
//   pegadinhas: string[],     3 to 5 common traps
// }

export const LETTERS = ['A', 'B', 'C', 'D', 'E']
export const YEARS = { min: 2019, max: 2023 }
export const BOUNDS = { cai: [2, 4], ideias: [5, 10], passos: [3, 8], pegadinhas: [3, 5] }

const EM_DASH = String.fromCharCode(0x2014)

const filled = (value) => typeof value === 'string' && value.trim() !== ''

// A sentence ends at . ? or ! followed by the end of the text or by a new sentence (a capital
// letter, maybe after a quote or a parenthesis). So 2.5 and "e.g. em" don't split one.
export function countSentences(text) {
  return text.trim().split(/(?<=[.?!])["')\]]?\s+(?=["'(\[]?\p{Lu})/u).filter((part) => part.trim()).length
}

function checkList(errors, name, list, [min, max]) {
  if (!Array.isArray(list)) return errors.push(`${name} must be a list`)
  if (list.length < min || list.length > max) errors.push(`${name} must have ${min} to ${max} items, has ${list.length}`)
  list.forEach((item, at) => {
    if (!filled(item)) errors.push(`${name}[${at}] must be a non-empty string`)
  })
}

// Every string anywhere inside the lesson, with where it sits.
function* strings(value, path) {
  if (typeof value === 'string') yield [path, value]
  else if (Array.isArray(value)) for (const [at, item] of value.entries()) yield* strings(item, `${path}[${at}]`)
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) yield* strings(item, path ? `${path}.${key}` : key)
}

// Every broken rule, as a short sentence. Empty when the lesson is fine.
export function validateLesson(lesson) {
  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) return ['lesson must be an object']
  const errors = []
  if (!filled(lesson.topic)) errors.push('topic must be a non-empty string')
  if (!filled(lesson.title)) errors.push('title must be a non-empty string')

  if (!filled(lesson.cai)) errors.push('cai must be a non-empty string')
  else {
    const [min, max] = BOUNDS.cai
    const count = countSentences(lesson.cai)
    if (count < min || count > max) errors.push(`cai must have ${min} to ${max} sentences, has ${count}`)
  }

  checkList(errors, 'ideias', lesson.ideias, BOUNDS.ideias)
  checkList(errors, 'pegadinhas', lesson.pegadinhas, BOUNDS.pegadinhas)

  const example = lesson.exemplo
  if (!example || typeof example !== 'object') errors.push('exemplo must be an object')
  else {
    if (!Number.isInteger(example.year) || example.year < YEARS.min || example.year > YEARS.max) {
      errors.push(`exemplo.year must be ${YEARS.min} to ${YEARS.max}`)
    }
    if (!Number.isInteger(example.number) || example.number < 1) errors.push('exemplo.number must be a positive integer')
    if (!filled(example.enunciado)) errors.push('exemplo.enunciado must be a non-empty string')
    const options = example.alternativas
    if (!options || typeof options !== 'object') errors.push('exemplo.alternativas must be an object')
    else {
      const keys = Object.keys(options)
      if (keys.length !== LETTERS.length || !LETTERS.every((letter) => keys.includes(letter))) {
        errors.push('exemplo.alternativas must have exactly A, B, C, D and E')
      }
      for (const letter of LETTERS) if (letter in options && !filled(options[letter])) errors.push(`exemplo.alternativas.${letter} must be a non-empty string`)
    }
    checkList(errors, 'exemplo.passos', example.passos, BOUNDS.passos)
    if (!LETTERS.includes(example.resposta)) errors.push('exemplo.resposta must be one of A to E')
  }

  for (const [path, text] of strings(lesson, '')) {
    if (text.includes(EM_DASH)) errors.push(`${path} has an em dash`)
  }
  return errors
}
