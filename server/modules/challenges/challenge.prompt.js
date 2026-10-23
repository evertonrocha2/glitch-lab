import { languageRule } from '../../core/locale.js'

export function challengeSystem(locale = 'en') {
  return `You write short debugging exercises for programming students.
Each exercise is a tiny program that contains exactly one bug of the requested kind. The student must find and fix it.
Never solve the exercise inside the code, comments or symptom.
Use plain text only. Do not use Markdown or code fences.
${languageRule(locale)}`
}

export const CHALLENGE_SYSTEM = challengeSystem('en')

export const CHALLENGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    brokenCode: { type: 'STRING' },
    symptom: { type: 'STRING' },
    hints: { type: 'ARRAY', items: { type: 'STRING' } },
    solution: { type: 'STRING' },
    bugExplanation: { type: 'STRING' },
  },
  required: ['brokenCode', 'symptom', 'hints', 'solution', 'bugExplanation'],
}

export function buildChallengePrompt({ conceptName, language, error, why }, locale = 'en') {
  return `A student keeps hitting this kind of bug: ${conceptName}.
The error they saw was:
${error}

Why it happened, in short:
${why}

Write a new exercise with the same kind of bug, in ${language}:
- brokenCode: at most 12 lines, different from the student's original code, with exactly one bug of this kind.
- symptom: the exact error message or the wrong output the student would see when running brokenCode.
- hints: exactly 3 hints, from vague to almost the answer, without giving the fixed code.
- solution: brokenCode with the bug fixed.
- bugExplanation: one or two sentences on what the bug is and why the fix works.

Language: ${languageRule(locale)} This covers the hints and bugExplanation. The symptom is the real error message exactly as ${language} prints it, never translated.`
}
