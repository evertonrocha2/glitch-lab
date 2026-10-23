// Interrogation: the guided debugging method on a case (the page, the case drawer section, the
// timeline and the note export). [key, English, Brazilian Portuguese]
const ROWS = [
  // The six steps: title, the question asked, and an example answer for the placeholder.
  ['interrogation.step.reproduce.title', 'Reproduce', 'Reproduzir'],
  ['interrogation.step.reproduce.ask', 'What input or action makes the bug show up?', 'Qual entrada ou ação faz o bug aparecer?'],
  ['interrogation.step.reproduce.example', 'Ex.: I call total([]) with an empty cart and it crashes.', 'Ex.: Chamo total([]) com o carrinho vazio e ele quebra.'],
  ['interrogation.step.read.title', 'Read the error', 'Ler o erro'],
  ['interrogation.step.read.ask', 'What does the error message actually say? Which line does it point at?', 'O que a mensagem de erro diz de verdade? Para qual linha ela aponta?'],
  ['interrogation.step.read.example', 'Ex.: A TypeError: it reads .length of undefined on line 2 of cart.js.', 'Ex.: Um TypeError: ele lê .length de undefined na linha 2 do cart.js.'],
  ['interrogation.step.hypothesis.title', 'Hypothesis', 'Hipótese'],
  ['interrogation.step.hypothesis.ask', 'What do you think is wrong, and why?', 'O que você acha que está errado, e por quê?'],
  ['interrogation.step.hypothesis.example', 'Ex.: user.name is never set, so it is undefined when I read .length.', 'Ex.: user.name nunca é definido, então é undefined quando leio .length.'],
  ['interrogation.step.isolate.title', 'Isolate', 'Isolar'],
  ['interrogation.step.isolate.ask', 'What is the smallest code that still breaks, or what would you print or check?', 'Qual é o menor código que ainda quebra, ou o que você imprimiria ou checaria?'],
  ['interrogation.step.isolate.example', 'Ex.: console.log(user) right before line 2 shows {}.', 'Ex.: console.log(user) logo antes da linha 2 mostra {}.'],
  ['interrogation.step.fix.title', 'Fix', 'Corrigir'],
  ['interrogation.step.fix.ask', 'How would you fix it? Code or words both work.', 'Como você corrigiria? Vale código ou palavras.'],
  ['interrogation.step.fix.example', 'Ex.: Give user a name before reading it, or check that it exists first.', 'Ex.: Dar um nome ao user antes de ler, ou checar antes se ele existe.'],
  ['interrogation.step.prevent.title', 'Prevent', 'Prevenir'],
  ['interrogation.step.prevent.ask', 'What test or habit would catch this bug next time?', 'Que teste ou hábito pegaria esse bug da próxima vez?'],
  ['interrogation.step.prevent.example', 'Ex.: A test that calls it with an empty user and expects no crash.', 'Ex.: Um teste que chama com um user vazio e espera que não quebre.'],
  ['interrogation.step.number', 'Step {number} of {total}', 'Etapa {number} de {total}'],
  ['interrogation.step.status.passed', 'done', 'feita'],
  ['interrogation.step.status.current', 'current', 'atual'],
  ['interrogation.step.status.locked', 'locked', 'bloqueada'],
  ['interrogation.step.label', 'Step {number}, {title}: {status}', 'Etapa {number}, {title}: {status}'],

  // The page.
  ['interrogation.page.kicker', 'interrogation', 'interrogatório'],
  ['interrogation.page.title', 'Interrogate the bug', 'Interrogar o bug'],
  [
    'interrogation.page.lead',
    'Six steps, one question at a time. The coach checks each answer and never hands you the fix before step 5.',
    'Seis etapas, uma pergunta por vez. O coach confere cada resposta e nunca te entrega a correção antes da etapa 5.',
  ],
  ['interrogation.page.back', 'Back to the board', 'Voltar ao board'],
  ['interrogation.page.loading', 'Loading the interrogation...', 'Carregando o interrogatório...'],
  ['interrogation.page.case', 'The case', 'O caso'],
  ['interrogation.page.code', 'Your code', 'Seu código'],
  ['interrogation.page.steps', 'Interrogation steps', 'Etapas do interrogatório'],
  ['interrogation.answer.label', 'Your answer', 'Sua resposta'],
  ['interrogation.answer.hint', 'Plain words are fine. Up to {max} characters.', 'Pode escrever com suas palavras. Até {max} caracteres.'],
  ['interrogation.answer.send', 'Send answer', 'Enviar resposta'],
  ['interrogation.answer.checking', 'The coach is reading your answer', 'O coach está lendo sua resposta'],
  ['interrogation.feedback.passed', 'Step passed', 'Etapa concluída'],
  ['interrogation.feedback.notYet', 'Not yet', 'Ainda não'],
  ['interrogation.feedback.question', 'Think about this:', 'Pense nisto:'],
  ['interrogation.feedback.next', 'Next: {title}', 'Próxima: {title}'],
  ['interrogation.history', 'Your tries on this step', 'Suas tentativas nesta etapa'],
  ['interrogation.tries', { one: '{count} try', other: '{count} tries' }, { one: '{count} tentativa', other: '{count} tentativas' }],
  ['interrogation.done.title', 'Case interrogated', 'Caso interrogado'],
  ['interrogation.done.text', 'You walked the whole method: +{xp} XP and the {badge} badge.', 'Você percorreu o método inteiro: +{xp} XP e a medalha {badge}.'],
  ['interrogation.done.again', 'You already walked the whole method on this case.', 'Você já percorreu o método inteiro neste caso.'],

  // The timeline (page and drawer) and the export.
  ['interrogation.timeline.title', 'Interrogation timeline', 'Linha do tempo do interrogatório'],
  ['interrogation.timeline.you', 'You', 'Você'],
  ['interrogation.timeline.coach', 'Coach', 'Coach'],
  ['interrogation.export', 'Export as note', 'Exportar como nota'],
  ['interrogation.exporting', 'Creating the note...', 'Criando a nota...'],
  ['interrogation.note.title', 'Interrogation: {type}', 'Interrogatório: {type}'],
  ['interrogation.note.answer', 'My answer: {text}', 'Minha resposta: {text}'],
  ['interrogation.note.coach', 'Coach: {text}', 'Coach: {text}'],

  // The case drawer.
  ['interrogation.drawer.title', 'Interrogation', 'Interrogatório'],
  [
    'interrogation.drawer.text',
    'Walk the debugging method step by step: reproduce, read the error, guess, isolate, fix and prevent.',
    'Percorra o método de depuração passo a passo: reproduzir, ler o erro, levantar uma hipótese, isolar, corrigir e prevenir.',
  ],
  ['interrogation.drawer.start', 'Interrogate the bug', 'Interrogar o bug'],
  ['interrogation.drawer.resume', 'Continue the interrogation', 'Continuar o interrogatório'],
  ['interrogation.drawer.reward', '+{xp} XP when you finish', '+{xp} XP ao terminar'],
  ['interrogation.drawer.done', 'Done: every step passed.', 'Feito: todas as etapas concluídas.'],

  // How to earn XP, on the progress page.
  ['app.progress.earn.interrogation', 'Finish an interrogation', 'Concluir um interrogatório'],
]

export default {
  en: Object.fromEntries(ROWS.map(([key, en]) => [key, en])),
  'pt-BR': Object.fromEntries(ROWS.map(([key, , pt]) => [key, pt])),
}
