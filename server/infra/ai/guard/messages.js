// What the student reads when the guard steps in: short, kind, in their language, and with
// something to do instead. The English texts are also in src/lib/i18n/messages/server.js (where
// an AppError carries them and the client translates), so keep both in step.

export const GUARD_TEXT = {
  injection: {
    en: "I can't follow instructions that try to change my rules. Tell me your programming question.",
    'pt-BR': 'Não posso seguir instruções que tentam mudar minhas regras. Me conta sua dúvida de programação.',
  },
  off_topic: {
    en: 'I only help with programming and Glitch Lab. Want to ask a coding question?',
    'pt-BR': 'Eu só ajudo com programação e com o Glitch Lab. Quer tirar uma dúvida de código?',
  },
  gibberish: {
    en: "I couldn't understand that. Tell me your programming question in a sentence or two.",
    'pt-BR': 'Não consegui entender. Me conta sua dúvida de programação em uma ou duas frases.',
  },
  leak: {
    en: "I can't share that. Let's get back to your code: what are you stuck on?",
    'pt-BR': 'Não posso compartilhar isso. Vamos voltar ao seu código: onde você travou?',
  },
  // The gym grades code: instructions written inside it are what got blocked.
  gym_injection: {
    en: "I only grade the code itself and can't follow instructions written inside it. Fix the bug and submit again.",
    'pt-BR': 'Eu só avalio o código e não sigo instruções escritas nele. Corrija o bug e envie de novo.',
  },
  gym_off_topic: {
    en: "This doesn't look like a fix for the exercise. Change the code so the bug is gone and submit again.",
    'pt-BR': 'Isso não parece uma correção do exercício. Mude o código para tirar o bug e envie de novo.',
  },
  // "New investigation" with something that isn't an error at all.
  not_an_error: {
    en: "This doesn't look like a programming error. Paste the error message your code printed.",
    'pt-BR': 'Isso não parece um erro de programação. Cole a mensagem de erro que seu código mostrou.',
  },
}

export const guardText = (kind, locale = 'en') => (GUARD_TEXT[kind] ?? GUARD_TEXT.off_topic)[locale] ?? GUARD_TEXT[kind]?.en ?? GUARD_TEXT.off_topic.en

// The 429 once a student has been blocked too often today. English: AppErrors are translated on the client.
export const LOCKED_MESSAGE = 'Too many blocked requests today. The AI features are paused for your account until tomorrow.'
