import { FIX_STEP, INTERROGATION_STEPS } from '../../../shared/interrogation.js'
import { repeatsLines, secretLines } from '../../infra/ai/guard/output.js'

// The coach must not hand out the fix before the "fix" step: the prompt says so, and this checks it.
// A reply "gives the fix away" when it repeats a line of code from the case's fix that is NOT
// already in the student's own code (lines both share, like a print, are fair to quote).
// The line matching is the output guard's, shared with the gym and the assistant.

// The code lines from the fix that the broken code doesn't already have, squashed for matching.
export const fixLines = (fix = '', code = '') => secretLines(fix, code)

export const revealsFix = (text, lines) => repeatsLines(text, lines)

const SAFE = {
  en: {
    feedback: "You're on the right track, but I won't hand you the fix yet. Keep investigating.",
    question: {
      reproduce: 'What exact input or action makes the error show up?',
      read: 'Which line and which value does the error message point at?',
      hypothesis: 'What do you think that value is at that moment, and why?',
      isolate: 'What could you print or check to prove your guess?',
    },
  },
  'pt-BR': {
    feedback: 'Você está no caminho certo, mas ainda não vou te dar a correção. Continue investigando.',
    question: {
      reproduce: 'Qual entrada ou ação exata faz o erro aparecer?',
      read: 'Para qual linha e qual valor a mensagem de erro aponta?',
      hypothesis: 'Qual você acha que é o valor nesse momento, e por quê?',
      isolate: 'O que você poderia imprimir ou checar para provar seu palpite?',
    },
  },
}

// A question case (a doubt, no error) asks its own safe questions.
const SAFE_QUESTION = {
  en: {
    reproduce: 'What exactly confuses you, and where did you see it?',
    read: 'What does each line of a tiny example do, one at a time?',
    hypothesis: 'In your own words, why does it work this way?',
    isolate: 'What is the smallest example that would prove your explanation?',
  },
  'pt-BR': {
    reproduce: 'O que exatamente te confunde, e onde você viu isso?',
    read: 'O que cada linha de um exemplo pequeno faz, uma de cada vez?',
    hypothesis: 'Com suas palavras, por que funciona desse jeito?',
    isolate: 'Qual é o menor exemplo que provaria sua explicação?',
  },
}

// The verdict as the student may see it at this step. Before the fix step, a reply that leaks the fix
// is swapped for a safe one (the pass or fail itself stands). { verdict, blocked }.
// question: the case is a doubt, so the safe question is about the doubt, not an error.
export function guardReply(verdict, { step, fix, code, locale = 'en', question = false }) {
  const index = INTERROGATION_STEPS.indexOf(step)
  if (index === -1 || index >= FIX_STEP) return { verdict, blocked: false }
  const lines = fixLines(fix, code)
  const leaks = (text) => revealsFix(text, lines) || /```/.test(text ?? '')
  if (!leaks(verdict.feedback) && !leaks(verdict.question)) return { verdict, blocked: false }
  const safe = SAFE[locale] ?? SAFE.en
  const questions = question ? (SAFE_QUESTION[locale] ?? SAFE_QUESTION.en) : safe.question
  return {
    verdict: { ...verdict, feedback: safe.feedback, question: verdict.passed ? '' : questions[step] },
    blocked: true,
  }
}
