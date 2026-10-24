// What the AI sends back for a daily puzzle, for tests that mock Gemini: every text a student reads
// in English and in Brazilian Portuguese, the code once.
export const AI_PUZZLE = {
  title: 'The lost index',
  titlePt: 'O índice perdido',
  brokenCode: 'names = ["a", "b"]\nprint(names[2])',
  symptom: 'IndexError: list index out of range',
  symptomPt: 'IndexError: list index out of range',
  hints: ['How many names are there?', 'Indexes start at 0.', 'The last index is 1.'],
  hintsPt: ['Quantos nomes existem?', 'Os índices começam no 0.', 'O último índice é 1.'],
  solution: 'names = ["a", "b"]\nprint(names[1])',
  bugExplanation: 'The list has indexes 0 and 1 only.',
  bugExplanationPt: 'A lista só tem os índices 0 e 1.',
}

// The Portuguese copy parsePuzzle keeps from AI_PUZZLE, on the puzzle and on its secret.
export const AI_PUZZLE_PT = { title: AI_PUZZLE.titlePt, symptom: AI_PUZZLE.symptomPt, hints: AI_PUZZLE.hintsPt }
export const AI_SECRET_PT = { bugExplanation: AI_PUZZLE.bugExplanationPt }

// What the AI sends back for a port of store-contract's puzzleFor (an off-by-one in Python) to
// JavaScript: the same bug, every student text in both languages, the code once.
export const AI_PORT = {
  concept: 'off-by-one',
  brokenCode: 'const items = [1, 2, 3]\nfor (let i = 0; i < items.length - 1; i++) {\n  console.log(items[i])\n}',
  symptom: 'Prints 1 and 2, but never 3.',
  symptomPt: 'Imprime 1 e 2, mas nunca 3.',
  hints: ['Count the lines it prints.', 'Look at the loop condition.', 'The loop stops one index early.'],
  hintsPt: ['Conte as linhas impressas.', 'Olhe a condição do laço.', 'O laço para um índice antes.'],
  solution: 'const items = [1, 2, 3]\nfor (let i = 0; i < items.length; i++) {\n  console.log(items[i])\n}',
  bugExplanation: 'items.length - 1 stops the loop before the last index.',
  bugExplanationPt: 'items.length - 1 para o laço antes do último índice.',
}
