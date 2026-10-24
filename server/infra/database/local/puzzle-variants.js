const now = () => new Date().toISOString()
const copy = (value) => (value == null ? null : structuredClone(value))
const keyOf = (puzzleId, language) => `${puzzleId}:${language}`

// Puzzle ports and language switches in the local JSON file. A port (variant) is a daily or global
// puzzle rewritten in another programming language, shared by everyone who switches to it; its
// secret sits apart like a puzzle's. A switch is a player's one language change on a puzzle.
// Spread into createLocalStore.
export function createLocalPuzzleVariants({ load, save }) {
  // Files saved before switches existed don't have these lists yet.
  const variantsOf = (data) => (data.puzzleVariants ??= [])
  const variantSecretsOf = (data) => (data.puzzleVariantSecrets ??= {})
  const switchesOf = (data) => (data.puzzleSwitches ??= [])
  const findVariant = (data, puzzleId, language) => variantsOf(data).find((item) => item.puzzleId === puzzleId && item.language === language)

  return {
    // One port per puzzle and language: null when it already exists.
    async createPuzzleVariant(puzzleId, language, { brokenCode, symptom, hints, pt = null }, { solution, bugExplanation, pt: secretPt = null }) {
      const data = await load()
      if (findVariant(data, puzzleId, language)) return null
      const created = { puzzleId, language, brokenCode, symptom, hints, pt, createdAt: now() }
      variantsOf(data).push(created)
      variantSecretsOf(data)[keyOf(puzzleId, language)] = { solution, bugExplanation, pt: secretPt }
      await save()
      return copy(created)
    },

    async getPuzzleVariant(puzzleId, language) {
      return copy(findVariant(await load(), puzzleId, language))
    },

    async getPuzzleVariantSecret(puzzleId, language) {
      return copy(variantSecretsOf(await load())[keyOf(puzzleId, language)])
    },

    async findPuzzleSwitch(userId, puzzleId) {
      return copy(switchesOf(await load()).find((item) => item.userId === userId && item.puzzleId === puzzleId))
    },

    // A player's one switch on a puzzle, or null when they already switched it. challenge: their open
    // challenge moved to the port in the same write ({ id, brokenCode, symptom, language, hints,
    // secret: { solution, bugExplanation } }), or null before they started. Hints revealed, attempts
    // and the start time stay. Answers { switch, challenge } (challenge null when none moved).
    async switchPuzzle(userId, puzzleId, { fromLanguage, toLanguage }, challenge = null) {
      const data = await load()
      const switches = switchesOf(data)
      if (switches.some((item) => item.userId === userId && item.puzzleId === puzzleId)) return null
      const created = { userId, puzzleId, fromLanguage, toLanguage, createdAt: now() }
      switches.push(created)
      const found = challenge && data.challenges.find((item) => item.id === challenge.id && item.userId === userId && item.puzzleId === puzzleId && item.status === 'open')
      if (found) {
        Object.assign(found, { brokenCode: challenge.brokenCode, symptom: challenge.symptom, language: challenge.language, hints: challenge.hints })
        data.secrets[found.id] = { solution: challenge.secret.solution, bugExplanation: challenge.secret.bugExplanation }
      }
      await save()
      return { switch: copy(created), challenge: copy(found ?? null) }
    },
  }
}
