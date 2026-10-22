// Max characters per field. The form caps input with these and the API rejects anything longer.
// Attached files: up to `files` of them, each under `code` characters, all together under `filesTotal`.
export const LIMITS = { error: 2000, code: 6000, context: 300, files: 5, filesTotal: 15000, path: 200 }

// Notes: how many per account, blocks per note, and characters per block or title.
export const NOTE_LIMITS = { notes: 200, blocks: 200, text: 2000, title: 120 }
