// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ENEM } from '../../shared/exams/enem.js'
import { LESSONS, lessonFor } from '../../shared/exams/lessons/index.js'
import { validateLesson } from '../../shared/exams/lessons/validate.js'

// The areas whose every topic already has its lesson. An area joins once all its lessons are in.
const READY_AREAS = new Set([])

const valid = () => ({
  topic: 'funcoes',
  title: 'Funções',
  cai: 'O ENEM pede para ler gráficos. Também pede para montar a lei de uma função.',
  ideias: ['Uma função liga x a um só y.', 'f(x) = ax + b é uma reta.', 'a é a taxa de variação.', 'b é onde a reta corta o eixo y.', 'x² cresce mais rápido.'],
  exemplo: {
    year: 2021,
    number: 140,
    enunciado: 'Um táxi cobra R$ 5 fixos e R$ 2 por km. Quanto custa uma corrida de 10 km?',
    alternativas: { A: 'R$ 20', B: 'R$ 25', C: 'R$ 30', D: 'R$ 35', E: 'R$ 40' },
    passos: ['A lei é f(x) = 2x + 5.', 'f(10) = 2 · 10 + 5.', 'f(10) = 25, letra B.'],
    resposta: 'B',
  },
  pegadinhas: ['Esquecer a parte fixa.', 'Trocar a com b.', 'Ler o gráfico pelo eixo errado.'],
})

// Built from its code point so this file itself has no em dash.
const DASH = String.fromCharCode(0x2014)

const many = (count) => Array.from({ length: count }, (_, at) => `Ponto ${at + 1}.`)

// One broken copy per rule: [what breaks, how to break a fresh valid lesson].
const BROKEN = [
  ['no topic', (lesson) => delete lesson.topic],
  ['empty title', (lesson) => (lesson.title = '  ')],
  ['no cai', (lesson) => delete lesson.cai],
  ['cai with one sentence', (lesson) => (lesson.cai = 'Só uma frase.')],
  ['cai with five sentences', (lesson) => (lesson.cai = 'Um. Dois. Três. Quatro. Cinco.')],
  ['ideias not a list', (lesson) => (lesson.ideias = 'uma ideia')],
  ['four ideias', (lesson) => (lesson.ideias = many(4))],
  ['eleven ideias', (lesson) => (lesson.ideias = many(11))],
  ['an empty idea', (lesson) => (lesson.ideias[2] = '')],
  ['no exemplo', (lesson) => delete lesson.exemplo],
  ['year before 2019', (lesson) => (lesson.exemplo.year = 2018)],
  ['year after 2023', (lesson) => (lesson.exemplo.year = 2024)],
  ['number not a positive integer', (lesson) => (lesson.exemplo.number = 0)],
  ['empty enunciado', (lesson) => (lesson.exemplo.enunciado = '')],
  ['an alternative missing', (lesson) => delete lesson.exemplo.alternativas.E],
  ['an extra alternative', (lesson) => (lesson.exemplo.alternativas.F = 'R$ 45')],
  ['an empty alternative', (lesson) => (lesson.exemplo.alternativas.C = '')],
  ['two passos', (lesson) => (lesson.exemplo.passos = many(2))],
  ['nine passos', (lesson) => (lesson.exemplo.passos = many(9))],
  ['resposta not a letter', (lesson) => (lesson.exemplo.resposta = 'F')],
  ['resposta lowercase', (lesson) => (lesson.exemplo.resposta = 'b')],
  ['two pegadinhas', (lesson) => (lesson.pegadinhas = many(2))],
  ['six pegadinhas', (lesson) => (lesson.pegadinhas = many(6))],
  ['an em dash in cai', (lesson) => (lesson.cai = `O ENEM pede gráficos ${DASH} sempre. Também pede leis.`)],
  ['an em dash in an idea', (lesson) => (lesson.ideias[0] = `Uma função ${DASH} uma regra.`)],
  ['an em dash in an alternative', (lesson) => (lesson.exemplo.alternativas.A = `R$ 20 ${DASH} caro`)],
  ['an em dash in a step', (lesson) => (lesson.exemplo.passos[1] = `f(10) ${DASH} 25.`)],
  ['an em dash in a pegadinha', (lesson) => (lesson.pegadinhas[0] = `Esquecer ${DASH} a parte fixa.`)],
  ['an em dash in the title', (lesson) => (lesson.title = `Funções ${DASH} base`)],
]

describe('validateLesson', () => {
  it('accepts a valid lesson', () => {
    expect(validateLesson(valid())).toEqual([])
  })

  it.each(BROKEN)('rejects a lesson with %s', (_, breakIt) => {
    const lesson = valid()
    breakIt(lesson)
    expect(validateLesson(lesson)).not.toEqual([])
  })

  it('rejects something that is not a lesson at all', () => {
    expect(validateLesson(null)).not.toEqual([])
    expect(validateLesson('aula')).not.toEqual([])
  })

  it('counts a sentence ending in ? or ! and ignores decimals and abbreviations inside one', () => {
    const lesson = valid()
    lesson.cai = 'Cai muito? Sim! O valor é 2.5 vezes maior, e.g. em gráficos.'
    expect(validateLesson(lesson)).toEqual([])
  })
})

describe('lesson index', () => {
  it('gives null for a topic without a lesson', () => {
    expect(lessonFor('nope')).toBeNull()
    expect(lessonFor('constructor')).toBeNull()
  })

  it('keys every lesson by its own topic, and every topic is in the catalog', () => {
    const ids = new Set(ENEM.areas.flatMap((area) => area.topics.map((topic) => topic.id)))
    for (const [id, lesson] of Object.entries(LESSONS)) {
      expect(lesson.topic).toBe(id)
      expect(ids.has(id)).toBe(true)
      expect(validateLesson(lesson)).toEqual([])
    }
  })
})

describe.each(ENEM.areas.filter((area) => READY_AREAS.has(area.id)))('$id lessons', (area) => {
  it.each(area.topics)('has a valid lesson for $id', (topic) => {
    const lesson = lessonFor(topic.id)
    expect(lesson).not.toBeNull()
    expect(lesson.topic).toBe(topic.id)
    expect(validateLesson(lesson)).toEqual([])
  })
})
