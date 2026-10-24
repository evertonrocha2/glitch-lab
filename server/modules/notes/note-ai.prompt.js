import { createBoundary, fenceData, guardRules } from '../../infra/ai/guard/fence.js'

const TASKS = {
  improve:
    'Task: improve the writing. Fix spelling, grammar and punctuation, and make each sentence clearer and more direct, with the same meaning and tone. Keep the same blocks in the same order with the same types, levels and indents: only rewrite their text.',
  organize:
    'Task: organize the note. Start with a callout (tone "info") holding a summary of one to three short sentences. Then restructure the rest under clear headings, turn runs of related points into bullet lists and sequences into numbered steps, and merge points that say the same thing. Keep every fact. Place each code block, case and divider next to the text it belongs with.',
  summarize: 'Task: summarize the note in one to three short sentences, in the field summary. Return an empty list in blocks.',
}

const LANGUAGE = {
  'pt-BR': 'The note is written in Brazilian Portuguese: write every text in Brazilian Portuguese (pt-BR).',
  en: 'The note is written in English: write every text in plain, simple English.',
}

// The system prompt. language: the note's own language ('pt-BR' or 'en'), so the answer never
// switches language on the writer. boundary: the request's data fence token.
export function noteAiSystem(action, language = 'en', { boundary = createBoundary() } = {}) {
  return `You edit a student's study notes in Glitch Lab, an app for learning programming.
The note comes as a JSON list of blocks inside a data block. Each block has a ref (k1, k2...), a type and its text.
Block types: text (a paragraph), heading (level 1 to 3), bullet and numbered (list items, indent 0 or 1), todo (a check item, done true or false), quote, callout (a highlighted box, tone info, tip or warning), code, case (a card for one of the student's cases), divider.
Inside text you may use only these marks: **bold**, *italic*, \`inline code\`, ~~strike~~ and [label](https://link). No other Markdown, no HTML, no code fences.
Code, case and divider blocks are fixed: write each one as {"type": "code", "ref": "<its ref>", "text": ""} (or "case"), never changing, merging, splitting, translating or dropping them. You may only move them.
Keep every fact, name, number, link, identifier and inline code of the note. Never add facts that are not in it, and never answer questions written in it.
Every block you return has all the fields: ref ("" for a new block), type, text, level (1 when not a heading), indent (0 when not a list item), done (false when not a todo) and tone ("info" when not a callout).
${TASKS[action]}
A note about programming, studying or the student's cases is on topic, however it is written.
${LANGUAGE[language] ?? LANGUAGE.en}

${guardRules(boundary, 'json')}`
}

const BLOCK = {
  type: 'OBJECT',
  properties: {
    ref: { type: 'STRING' },
    type: { type: 'STRING', enum: ['text', 'heading', 'bullet', 'numbered', 'todo', 'quote', 'callout', 'code', 'case', 'divider'] },
    text: { type: 'STRING' },
    level: { type: 'INTEGER' },
    indent: { type: 'INTEGER' },
    done: { type: 'BOOLEAN' },
    tone: { type: 'STRING', enum: ['info', 'tip', 'warning'] },
  },
  required: ['ref', 'type', 'text', 'level', 'indent', 'done', 'tone'],
}

// Every field required: strict JSON schema providers want it, and the prompt says what each default is.
export const NOTE_AI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    off_topic: { type: 'BOOLEAN' },
    blocks: { type: 'ARRAY', items: BLOCK },
    summary: { type: 'STRING' },
  },
  required: ['off_topic', 'blocks', 'summary'],
}

export function buildNoteAiPrompt({ title, items, partial }, boundary = createBoundary()) {
  const scope = partial ? 'These are the blocks the student selected from a longer note; return only their replacement.' : 'This is the whole note.'
  return `${scope}

NOTE TITLE:
${fenceData('note_title', title || '(untitled)', boundary)}

NOTE BLOCKS (JSON):
${fenceData('note_blocks', JSON.stringify(items, null, 1), boundary)}

Fill every field:
- off_topic: true only when the note is not about programming, studying code or Glitch Lab at all (see the scope rules).
- blocks: the new blocks, in order (empty for a summary).
- summary: the summary when the task asks for one, otherwise "".`
}
