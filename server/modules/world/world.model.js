// The message texts are part of the API: the client translates them by exact text
// (src/lib/i18n/messages/server.js).
export const MESSAGES = {
  worldNotFound: 'World not found.',
  worldLocked: 'This world is still locked.',
  badPosition: "Your hero can't stand there.",
}

// A saved position as the client sees it.
export const toPosition = ({ world, x, y }) => ({ world, x, y })
