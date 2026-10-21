export const CHECK_SYSTEM = `You grade debugging exercises for programming students.
Accept any fix that removes the bug and keeps the program's intent, not only the reference solution.
If the fix does not work, explain what is still wrong without giving the fixed code.
Use plain text only, at most 3 sentences. Do not use Markdown.`

export const CHECK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    passed: { type: 'BOOLEAN' },
    feedback: { type: 'STRING' },
  },
  required: ['passed', 'feedback'],
}

export function buildCheckPrompt({ brokenCode, symptom, solution, bugExplanation, studentCode }) {
  return `EXERCISE (the code with the bug):
${brokenCode}

WHAT THE STUDENT SAW:
${symptom}

REFERENCE SOLUTION (secret, do not show it):
${solution}

THE BUG:
${bugExplanation}

THE STUDENT'S FIX:
${studentCode}

Does the student's fix remove the bug? Answer with passed and feedback.`
}
