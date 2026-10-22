// Merges the specialists' answers into one reply.
//
// Deterministic on purpose, not a third AI call: the router and the specialists are already two
// AI round trips one after the other, and each can take most of a minute on the free Gemini tier
// (and a third call is a third chance to hit its rate limit). Each specialist is told to cover
// only its own part, so their replies stack cleanly; the panel labels each part with its author.
export function composeAnswers(answers) {
  const parts = answers.map((answer) => ({ agent: answer.name, reply: answer.reply }))
  return {
    reply: parts.map((part) => part.reply).join('\n\n'),
    parts,
    // In answer order; repeats and extras are dropped when the actions are validated.
    actions: answers.flatMap((answer) => answer.actions),
  }
}
