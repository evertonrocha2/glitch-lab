// Max characters per field. The form caps input with these and the API rejects anything longer.
export const LIMITS = { error: 2000, code: 6000 }

// Notes: how many per account, blocks per note, and characters per block or title.
export const NOTE_LIMITS = { notes: 200, blocks: 200, text: 2000, title: 120 }
