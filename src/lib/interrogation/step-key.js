// The i18n key of a step's title, ask or example. A question card walks the same six steps from the
// doubt, with its own words for them (messages/question.js).
export const stepKey = (step, part, question = false) => `${question ? 'question' : 'interrogation'}.step.${step}.${part}`
