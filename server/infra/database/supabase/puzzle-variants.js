// Postgres unique_violation: that port (or my switch on that puzzle) already exists.
const UNIQUE_VIOLATION = '23505'
// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'

const toVariant = (row) =>
  row && {
    puzzleId: row.puzzle_id,
    language: row.language,
    brokenCode: row.broken_code,
    symptom: row.symptom,
    hints: row.hints,
    pt: row.pt ?? null,
    createdAt: row.created_at,
  }

const toSwitch = (row) =>
  row && { userId: row.user_id, puzzleId: row.puzzle_id, fromLanguage: row.from_language, toLanguage: row.to_language, createdAt: row.created_at }

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

// Puzzle ports and language switches on Supabase (puzzle_variants, puzzle_variant_secrets and
// puzzle_switches). toChallenge: the store's challenge row mapper, for the challenge a switch moves.
// Spread into createSupabaseStore.
export function createSupabasePuzzleVariants(db, { toChallenge }) {
  return {
    async createPuzzleVariant(puzzleId, language, { brokenCode, symptom, hints, pt = null }, { solution, bugExplanation, pt: secretPt = null }) {
      const inserted = await db
        .from('puzzle_variants')
        .insert({ puzzle_id: puzzleId, language, broken_code: brokenCode, symptom, hints, pt })
        .select()
        .single()
      if (inserted.error?.code === UNIQUE_VIOLATION) return null
      const row = unwrap(inserted)
      const secret = await db.from('puzzle_variant_secrets').insert({ puzzle_id: puzzleId, language, solution, bug_explanation: bugExplanation, pt: secretPt })
      if (secret.error) {
        // A port nobody can be judged on must not be handed out.
        await db.from('puzzle_variants').delete().eq('puzzle_id', puzzleId).eq('language', language)
        unwrap(secret)
      }
      return toVariant(row)
    },

    async getPuzzleVariant(puzzleId, language) {
      return toVariant(unwrap(await db.from('puzzle_variants').select('*').eq('puzzle_id', puzzleId).eq('language', language).maybeSingle()))
    },

    async getPuzzleVariantSecret(puzzleId, language) {
      const row = unwrap(await db.from('puzzle_variant_secrets').select('*').eq('puzzle_id', puzzleId).eq('language', language).maybeSingle())
      return row && { solution: row.solution, bugExplanation: row.bug_explanation, pt: row.pt ?? null }
    },

    async findPuzzleSwitch(userId, puzzleId) {
      return toSwitch(unwrap(await db.from('puzzle_switches').select('*').eq('user_id', userId).eq('puzzle_id', puzzleId).maybeSingle()))
    },

    // One database function, so the switch row and the moved challenge (with its secret) land
    // together or not at all.
    async switchPuzzle(userId, puzzleId, { fromLanguage, toLanguage }, challenge = null) {
      const result = unwrap(
        await db.rpc('switch_puzzle', {
          p_user: userId,
          p_puzzle: puzzleId,
          p_from: fromLanguage,
          p_to: toLanguage,
          p_challenge: challenge?.id ?? null,
          p_broken_code: challenge?.brokenCode ?? null,
          p_symptom: challenge?.symptom ?? null,
          p_hints: challenge?.hints ?? null,
          p_solution: challenge?.secret.solution ?? null,
          p_bug_explanation: challenge?.secret.bugExplanation ?? null,
        }),
      )
      return result ? { switch: toSwitch(result.switch), challenge: toChallenge(result.challenge) ?? null } : null
    },
  }
}
