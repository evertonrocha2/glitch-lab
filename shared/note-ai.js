// The AI tools in the note editor. Shared by the API (which checks them) and the editor's menu.
// improve: fix the writing. organize: restructure into headings, lists and steps with a summary on
// top. summarize: a short summary added on top, the rest untouched.
export const NOTE_AI_ACTIONS = ['improve', 'organize', 'summarize']

// chars: the most text (title plus the blocks in scope, code included) one request sends the AI.
export const NOTE_AI_LIMITS = { chars: 8000 }

export const NOTE_AI_TOO_LONG = `Too long for the AI. Select up to ${NOTE_AI_LIMITS.chars} characters and try again.`
