// Plain helpers for a note's block list. Every function returns a new list; nothing is edited in place.

export function newBlock(type, fields = {}) {
  const id = crypto.randomUUID()
  if (type === 'case') return { id, type, caseId: fields.caseId }
  if (type === 'todo') return { id, type, text: fields.text ?? '', done: false }
  return { id, type, text: fields.text ?? '' }
}

// "@que" right before the caret, at the start or after a space: { start, query }. Otherwise null.
export function mentionAt(text, caret) {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null
}

export function updateBlock(blocks, id, patch) {
  return blocks.map((block) => (block.id === id ? { ...block, ...patch } : block))
}

export function insertAfter(blocks, id, block) {
  const index = blocks.findIndex((item) => item.id === id)
  return index === -1 ? [...blocks, block] : [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)]
}

export function removeBlock(blocks, id) {
  return blocks.filter((block) => block.id !== id)
}

// The mention text ("@que") comes out of the block; the case goes in after it, or in its place
// when nothing else was written. A text block follows so you can keep typing.
// Returns { blocks, focusId }.
export function placeCase(blocks, blockId, caseId, mention) {
  const block = blocks.find((item) => item.id === blockId)
  const caseBlock = newBlock('case', { caseId })
  let next
  if (!block) {
    next = [...blocks, caseBlock]
  } else {
    const end = mention.start + 1 + mention.query.length
    const text = block.text.slice(0, mention.start) + block.text.slice(end)
    next =
      text.trim() === ''
        ? blocks.map((item) => (item.id === blockId ? caseBlock : item))
        : insertAfter(updateBlock(blocks, blockId, { text: text.trimEnd() }), blockId, caseBlock)
  }
  const after = next[next.findIndex((item) => item.id === caseBlock.id) + 1]
  if (after?.type === 'text') return { blocks: next, focusId: after.id }
  const writing = newBlock('text')
  return { blocks: insertAfter(next, caseBlock.id, writing), focusId: writing.id }
}

// Cases whose error, bug type or language contains the query, newest first as given.
export function matchCases(cases, query, labelOf) {
  const needle = query.trim().toLowerCase()
  if (!needle) return cases
  return cases.filter((item) => [item.error, labelOf(item.concept), item.language].some((value) => value.toLowerCase().includes(needle)))
}

export const mentionsCase = (note, caseId) => note.blocks.some((block) => block.type === 'case' && block.caseId === caseId)
