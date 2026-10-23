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
