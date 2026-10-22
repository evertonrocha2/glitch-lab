import { SPECIALISTS, specialistName } from '../../../shared/assistant.js'

// The "what happened" lines under an answer, in the reader's language. English comes from
// shared/assistant.js, so the panel's own guesses while it waits read the same.
const PT_BR = {
  names: {
    board: 'Analista do board',
    gym: 'Treinador do gym',
    notes: 'Guardião das notas',
    study: 'Planejador de estudos',
    guide: 'Guia do app',
  },
  doing: {
    board: 'está olhando seus casos',
    gym: 'está conferindo seus desafios do gym',
    notes: 'está lendo suas notas',
    study: 'está olhando seu progresso',
    guide: 'está vendo como o app funciona',
  },
  routing: 'Encaminhando sua pergunta',
  fellBack: 'Escolhendo especialistas por palavras-chave (o roteador não respondeu)',
  failed: (name) => `${name} não conseguiu responder desta vez`,
  merging: 'Juntando as respostas',
}

const EN = {
  routing: 'Routing your question',
  fellBack: 'Picking specialists by keywords (the router did not answer)',
  failed: (name) => `${name} could not answer this time`,
  merging: 'Putting the answers together',
}

const nameOf = (id, locale) => (locale === 'pt-BR' ? PT_BR.names[id] : undefined) ?? specialistName(id)
const doingOf = (id, locale) => (locale === 'pt-BR' ? PT_BR.doing[id] : undefined) ?? SPECIALISTS.find((item) => item.id === id)?.doing

// { routing, fellBack, merging, working(id), failed(id) } in the reader's language.
export function stepText(locale = 'en') {
  const words = locale === 'pt-BR' ? PT_BR : EN
  return {
    routing: words.routing,
    fellBack: words.fellBack,
    merging: words.merging,
    working: (id) => `${nameOf(id, locale)} ${doingOf(id, locale)}`,
    failed: (id) => words.failed(nameOf(id, locale)),
  }
}
