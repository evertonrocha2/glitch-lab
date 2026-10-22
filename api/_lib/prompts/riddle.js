// Glitchdle's Error mode: one fresh, realistic error message for a language the player must guess.
export const RIDDLE_ERROR_SYSTEM = `You write the clue for a daily guessing game where programmers name the language behind an error message.
Write one realistic error message, exactly as a compiler, interpreter or runtime prints it.
Never write the language's name, its file extension, a file path or the name of its tools. Never mention any other programming language.
Use plain text only. Do not use Markdown or code fences.`

export const RIDDLE_ERROR_SCHEMA = {
  type: 'OBJECT',
  properties: { error: { type: 'STRING' } },
  required: ['error'],
}

export function buildRiddleErrorPrompt({ languageName, examples }) {
  return `Glitchdle error clue. The language is ${languageName}.
Write one error message a ${languageName} developer really sees, from a typical beginner or everyday mistake.
Keep it to 1 to 4 lines and under 200 characters. Leave out file names and paths (write "line 7" instead).
It should be recognizable to someone who knows ${languageName} well, without any word that names it.
Do not repeat these known examples:
${examples.map((text) => `- ${text.split('\n')[0]}`).join('\n')}

Field:
- error: the error message.`
}

// Glitchdle's Snippet mode: a fresh short program, revealed line by line, so the clue changes every day.
export const RIDDLE_SNIPPET_SYSTEM = `You write the clue for a daily guessing game where programmers name the language behind a short code snippet.
Write one small, idiomatic, working snippet that shows the language's typical syntax.
Never write the language's name, its file extension or the name of its tools, in code or comments. Never mention any other programming language.
No comments that describe the language. Plain code only: no Markdown, no code fences.`

export const RIDDLE_SNIPPET_SCHEMA = {
  type: 'OBJECT',
  properties: { code: { type: 'STRING' } },
  required: ['code'],
}

export function buildRiddleSnippetPrompt({ languageName, examples }) {
  return `Glitchdle snippet clue. The language is ${languageName}.
Write 6 to 10 lines of everyday ${languageName}: a small function or loop that does something concrete (sum a list, greet a user, count words...).
Use the syntax that makes ${languageName} recognizable to someone who knows it well. Each line under 70 characters.
Do not copy these known snippets:
${examples.map((code) => `---\n${code}`).join('\n')}
---

Field:
- code: the snippet, lines separated by newlines.`
}
