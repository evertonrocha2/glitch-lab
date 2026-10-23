import { FIX_STEP, INTERROGATION_STEPS } from '../../../shared/interrogation.js'

// The coach must not hand out the fix before the "fix" step: the prompt says so, and this checks it.
// A reply "gives the fix away" when it repeats a line of code from the case's fix that is NOT
// already in the student's own code (lines both share, like a print, are fair to quote).

const MIN_LINE = 6
// Code looks like code: brackets, operators, dots between names, or a keyword line.
const CODE_LIKE = /[(){}[\];=<>]|\w\.\w|^\s*(return|if|for|while|def|const|let|var|import)\b/

const squash = (text) => text.replace(/[\s`'"]+/g, '').toLowerCase()

// The code lines from the fix that the broken code doesn't already have, squashed for matching.
export function fixLines(fix = '', code = '') {
  const known = squash(code)
  const lines = String(fix)
    .split('\n')
    .flatMap((line) => line.split('`'))
    .filter((line) => CODE_LIKE.test(line))
    .map(squash)
    .filter((line) => line.length >= MIN_LINE && !known.includes(line))
  return [...new Set(lines)]
}

export function revealsFix(text, lines) {
  const squashed = squash(text ?? '')
  return lines.some((line) => squashed.includes(line))
}

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

// The verdict as the student may see it at this step. Before the fix step, a reply that leaks the fix
// is swapped for a safe one (the pass or fail itself stands). { verdict, blocked }.
export function guardReply(verdict, { step, fix, code, locale = 'en' }) {
  const index = INTERROGATION_STEPS.indexOf(step)
  if (index === -1 || index >= FIX_STEP) return { verdict, blocked: false }
  const lines = fixLines(fix, code)
  const leaks = (text) => revealsFix(text, lines) || /```/.test(text ?? '')
  if (!leaks(verdict.feedback) && !leaks(verdict.question)) return { verdict, blocked: false }
  const safe = SAFE[locale] ?? SAFE.en
  return {
    verdict: { ...verdict, feedback: safe.feedback, question: verdict.passed ? '' : safe.question[step] },
    blocked: true,
  }
}
