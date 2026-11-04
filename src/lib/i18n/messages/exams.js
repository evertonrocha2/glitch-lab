// Exam practice (/exams/:exam and /exams/:exam/:topic): the ENEM page, its topics and the question card.
// Area and topic names come from shared/exams/ and stay in Portuguese: the exam is Brazilian.

const en = {
  'app.nav.enem': 'ENEM',

  'exams.badge.official': 'Official question · {exam} {year} · Q{number}',
  'exams.answer': 'Answer',
  'exams.answering': 'Checking...',
  'exams.pick': 'Pick an alternative',
  'exams.result.right': 'You got it!',
  'exams.result.wrong': 'Not this time. The answer is {answer}.',
  'exams.mark.answer': 'answer key',
  'exams.mark.yours': 'your answer',
  'exams.next': 'Next',
  'exams.imageAlt': 'Alternative {letter}',

  'exams.kicker': 'exam practice',
  'exams.lead': 'Real questions from the {exam} exams, by topic. Pick a topic and answer one question at a time.',
  'exams.loading': 'Loading the exam...',
  'exams.join.title': 'Study for the {exam}',
  'exams.join.lead': 'Real questions from the 2019 to 2023 exams, sorted by topic.',
  'exams.join.date': 'Exam date (optional)',
  'exams.join.cta': 'Start',
  'exams.join.saving': 'Starting...',
  'exams.examDate': 'Exam on {date}',
  'exams.topic.stats': '{correct} of {answered} right · {questions} questions',
  'exams.topic.soon': 'coming soon',
  'exams.topic.empty': 'You answered every question in this topic.',
  'exams.topic.notFound': 'Topic not found.',
  'exams.topic.back': 'Back to {exam}',
  'exams.topic.progress': '{current} of {total}',
  'exams.topic.loading': 'Loading questions...',
}

const ptBR = {
  'app.nav.enem': 'ENEM',

  'exams.badge.official': 'Questão oficial · {exam} {year} · Q{number}',
  'exams.answer': 'Responder',
  'exams.answering': 'Conferindo...',
  'exams.pick': 'Escolha uma alternativa',
  'exams.result.right': 'Acertou!',
  'exams.result.wrong': 'Não foi dessa vez. A resposta é a {answer}.',
  'exams.mark.answer': 'gabarito',
  'exams.mark.yours': 'sua resposta',
  'exams.next': 'Próxima',
  'exams.imageAlt': 'Alternativa {letter}',

  'exams.kicker': 'prática de prova',
  'exams.lead': 'Questões reais das provas do {exam}, por assunto. Escolha um assunto e responda uma questão por vez.',
  'exams.loading': 'Carregando a prova...',
  'exams.join.title': 'Estudar para o {exam}',
  'exams.join.lead': 'Questões reais das provas de 2019 a 2023, separadas por assunto.',
  'exams.join.date': 'Data da prova (opcional)',
  'exams.join.cta': 'Começar',
  'exams.join.saving': 'Começando...',
  'exams.examDate': 'Prova em {date}',
  'exams.topic.stats': '{correct} de {answered} certas · {questions} questões',
  'exams.topic.soon': 'em breve',
  'exams.topic.empty': 'Você respondeu todas as questões deste assunto.',
  'exams.topic.notFound': 'Assunto não encontrado.',
  'exams.topic.back': 'Voltar para {exam}',
  'exams.topic.progress': '{current} de {total}',
  'exams.topic.loading': 'Carregando questões...',
}

export default { en, 'pt-BR': ptBR }
