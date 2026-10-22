export const PUZZLE_SYSTEM = `You write debugging puzzles for a daily challenge that every student of a debugging app gets.
Each puzzle is a small, self-contained program with a realistic task and the exact bugs asked for. The student must find and fix them.
Never solve the puzzle inside the code, comments, title or symptom.
Use plain text only. Do not use Markdown or code fences.`

export const PUZZLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    brokenCode: { type: 'STRING' },
    symptom: { type: 'STRING' },
    hints: { type: 'ARRAY', items: { type: 'STRING' } },
    solution: { type: 'STRING' },
    bugExplanation: { type: 'STRING' },
  },
  required: ['title', 'brokenCode', 'symptom', 'hints', 'solution', 'bugExplanation'],
}

const LEVELS = {
  easy: 'Easy: a beginner spots it within a minute. brokenCode has at most 8 lines and exactly one bug.',
  medium: 'Medium: it takes a little reasoning about what the code does. brokenCode has at most 12 lines and exactly one bug.',
  hard: 'Hard: a subtle bug hiding behind code that looks right, often with no crash, only a wrong result. brokenCode has at most 16 lines and exactly one bug.',
}

const GLOBAL = `This is the weekly global challenge, harder and multi-step: brokenCode has 15 to 30 lines, two or three small functions working together, and exactly two bugs. The main bug is of the kind asked for; fixing the first bug reveals the second. The symptom is what the student sees first.`

export function buildPuzzlePrompt({ kind, difficulty, language, conceptName, avoidTitles }) {
  const avoid = avoidTitles.length ? `\nThese titles were used recently. Pick a new idea with a different title:\n${avoidTitles.map((title) => `- ${title}`).join('\n')}\n` : ''
  return `Write one ${difficulty} debugging puzzle in ${language} about this kind of bug: ${conceptName}.
${kind === 'global' ? GLOBAL : LEVELS[difficulty]}
${avoid}
Fields:
- title: a short, catchy name for the puzzle, at most 6 words, without giving the bug away.
- brokenCode: the program with the bug${kind === 'global' ? 's' : ''}. It must run on its own.
- symptom: the exact error message, or the wrong output next to the expected one, that the student sees when running brokenCode.
- hints: exactly 3 hints, from vague to almost the answer, without giving the fixed code.
- solution: brokenCode with ${kind === 'global' ? 'both bugs' : 'the bug'} fixed and nothing else changed.
- bugExplanation: one or two sentences on what went wrong and why the fix works.`
}
