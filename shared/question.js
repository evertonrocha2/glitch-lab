// "Ask a question": a doubt chat with the tutor that can end in a board card (a case of kind
// 'question'). Shared by the API (limits, the CARD line, validation) and the app (limits, labels).

// turns: questions per conversation. message and code: characters per message and pasted code.
// history: characters of the conversation the API reads per turn (oldest dropped first, the
// opening doubt always kept). recap: characters of the short recap stored with the card.
export const QUESTION_LIMITS = { turns: 12, message: 2000, code: 6000, history: 12000, recap: 400, cardTopic: 60 }

// The fields of a board card the tutor proposes, with their max length.
export const CARD_LIMITS = { topic: 60, title: 100, summary: 400, explanation: 1500, prompt: 1500, answer: 1500, recap: 400 }

// The machine line the tutor ends a message with once it knows the topic. Held back from the screen.
export const CARD_MARKER = 'CARD:'

// Every case is an investigated error unless it says otherwise (rows made before questions existed).
export const CASE_KINDS = ['error', 'question']
export const isQuestion = (item) => item?.kind === 'question'

// What a case is about, as text: the error as printed, or the student's question.
export const caseText = (item) => (isQuestion(item) ? (item?.question ?? '') : (item?.error ?? ''))

// Programming languages a card may name (lowercase, like the analyzer writes them), and the
// spellings models use for them.
export const KNOWN_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'c++',
  'c#',
  'go',
  'rust',
  'ruby',
  'php',
  'kotlin',
  'swift',
  'dart',
  'scala',
  'r',
  'lua',
  'elixir',
  'haskell',
  'sql',
  'html',
  'css',
  'bash',
]
const LANGUAGE_ALIASES = { js: 'javascript', node: 'javascript', 'node.js': 'javascript', ts: 'typescript', py: 'python', cpp: 'c++', csharp: 'c#', golang: 'go', shell: 'bash', sh: 'bash' }

// The language id for a name, or null when it is not one the app knows.
export function knownLanguage(name) {
  if (typeof name !== 'string') return null
  const clean = name.trim().toLowerCase()
  const id = LANGUAGE_ALIASES[clean] ?? clean
  return KNOWN_LANGUAGES.includes(id) ? id : null
}
