// What the AI sends back for a daily puzzle, for tests that mock Gemini.
export const AI_PUZZLE = {
  title: 'The lost index',
  brokenCode: 'names = ["a", "b"]\nprint(names[2])',
  symptom: 'IndexError: list index out of range',
  hints: ['How many names are there?', 'Indexes start at 0.', 'The last index is 1.'],
  solution: 'names = ["a", "b"]\nprint(names[1])',
  bugExplanation: 'The list has indexes 0 and 1 only.',
}
