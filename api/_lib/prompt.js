export const SYSTEM_INSTRUCTION = `You are a patient programming teacher helping a beginner student.
Explain bugs in plain, simple English. Avoid jargon; if you must use a technical term, explain it in the same sentence.
Focus on WHY the error happened (the concept behind it), not only how to fix it.
Use plain text only. Do not use Markdown or code fences. Code snippets may span multiple lines.`

// Gemini's structured output: the model can only answer with this shape.
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    explicacao: { type: 'STRING' },
    causa: { type: 'STRING' },
    correcao: { type: 'STRING' },
    exercicio: {
      type: 'OBJECT',
      properties: {
        enunciado: { type: 'STRING' },
        resposta: { type: 'STRING' },
      },
      required: ['enunciado', 'resposta'],
    },
  },
  required: ['explicacao', 'causa', 'correcao', 'exercicio'],
}

export function buildPrompt({ error, code }) {
  return `A student got this error:

ERROR:
${error}

CODE:
${code || '(no code provided)'}

Fill every field:
- explicacao: what happened, in simple language, at most 3 sentences.
- causa: the concept behind the error and why it happens.
- correcao: how to fix it, with a short code snippet.
- exercicio.enunciado: a tiny challenge (at most 8 lines of code) with the same kind of bug, in the same programming language, asking the student to find and fix it.
- exercicio.resposta: the solution to the challenge and one sentence on why it works.`
}
