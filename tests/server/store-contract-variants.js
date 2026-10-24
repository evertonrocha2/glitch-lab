import { expect, it } from 'vitest'
import { PUZZLE_SECRET, puzzleFor, randomDay } from './store-contract.js'

// A daily puzzle ported to JavaScript, as the switch saves it.
export const VARIANT = {
  brokenCode: 'const items = [1, 2, 3]\nfor (let i = 0; i < items.length - 1; i++) console.log(items[i])',
  symptom: 'Prints 1 and 2, but never 3.',
  hints: ['Count the lines printed.', 'Look at the loop condition.', 'The loop stops one early.'],
  pt: { symptom: 'Imprime 1 e 2, mas nunca 3.', hints: ['Conte as linhas.', 'Olhe a condição do laço.', 'O laço para um antes.'] },
}
export const VARIANT_SECRET = {
  solution: 'const items = [1, 2, 3]\nfor (let i = 0; i < items.length; i++) console.log(items[i])',
  bugExplanation: 'items.length - 1 skips the last index.',
  pt: { bugExplanation: 'items.length - 1 pula o último índice.' },
}

// Puzzle ports and language switches: every store must pass these. storeContract calls this inside
// its describe, with a getter for the store and the test users' ids (fresh accounts on Supabase).
export function variantsStoreContract(getStore, ids) {
  it('keeps one port per puzzle and language, with its secret apart', async () => {
    const store = getStore()
    const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    expect(await store.getPuzzleVariant(puzzle.id, 'javascript')).toBeNull()

    const variant = await store.createPuzzleVariant(puzzle.id, 'javascript', VARIANT, VARIANT_SECRET)
    expect(variant).toEqual({ puzzleId: puzzle.id, language: 'javascript', ...VARIANT, createdAt: expect.any(String) })
    expect(variant).not.toHaveProperty('solution')
    expect(await store.getPuzzleVariant(puzzle.id, 'javascript')).toEqual(variant)
    expect(await store.getPuzzleVariantSecret(puzzle.id, 'javascript')).toEqual(VARIANT_SECRET)
    // A second port to the same language loses; another language is its own port.
    expect(await store.createPuzzleVariant(puzzle.id, 'javascript', { ...VARIANT, symptom: 'Other' }, VARIANT_SECRET)).toBeNull()
    expect((await store.getPuzzleVariant(puzzle.id, 'javascript')).symptom).toBe(VARIANT.symptom)
    expect(await store.getPuzzleVariant(puzzle.id, 'go')).toBeNull()
    expect(await store.getPuzzleVariantSecret(puzzle.id, 'go')).toBeNull()
    expect(await store.getPuzzleVariant('not-an-id', 'javascript')).toBeNull()

    // Saved without a Portuguese copy, it reads as null.
    const { pt, ...english } = VARIANT
    const plain = await store.createPuzzleVariant(puzzle.id, 'go', english, { solution: 'x', bugExplanation: 'y' })
    expect(plain.pt).toBeNull()
    expect(await store.getPuzzleVariantSecret(puzzle.id, 'go')).toEqual({ solution: 'x', bugExplanation: 'y', pt: null })
  })

  it('records one switch per player per puzzle', async () => {
    const store = getStore()
    const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    expect(await store.findPuzzleSwitch(ids.alice, puzzle.id)).toBeNull()

    const saved = await store.switchPuzzle(ids.alice, puzzle.id, { fromLanguage: 'python', toLanguage: 'javascript' })
    const expected = { userId: ids.alice, puzzleId: puzzle.id, fromLanguage: 'python', toLanguage: 'javascript', createdAt: expect.any(String) }
    expect(saved).toEqual({ switch: expected, challenge: null })
    expect(await store.findPuzzleSwitch(ids.alice, puzzle.id)).toEqual(saved.switch)
    expect(await store.switchPuzzle(ids.alice, puzzle.id, { fromLanguage: 'python', toLanguage: 'go' })).toBeNull()
    expect((await store.findPuzzleSwitch(ids.alice, puzzle.id)).toLanguage).toBe('javascript')
    // Bob has his own switch.
    expect(await store.findPuzzleSwitch(ids.bob, puzzle.id)).toBeNull()
    expect(await store.switchPuzzle(ids.bob, puzzle.id, { fromLanguage: 'python', toLanguage: 'go' })).toMatchObject({ switch: { toLanguage: 'go' } })
  })

  it('moves an open challenge to the port, keeping its id, start, attempts and hints revealed', async () => {
    const store = getStore()
    const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    const started = await store.createChallenge(
      ids.alice,
      { caseId: null, puzzleId: puzzle.id, brokenCode: puzzle.brokenCode, symptom: puzzle.symptom, language: 'python', hints: puzzle.hints },
      PUZZLE_SECRET,
    )
    await store.updateChallenge(ids.alice, started.id, { hintsRevealed: 2, attempts: 1 })

    const { pt, ...english } = VARIANT
    const moved = { id: started.id, ...english, language: 'javascript', secret: { solution: VARIANT_SECRET.solution, bugExplanation: VARIANT_SECRET.bugExplanation } }
    const saved = await store.switchPuzzle(ids.alice, puzzle.id, { fromLanguage: 'python', toLanguage: 'javascript' }, moved)
    const after = {
      ...started,
      brokenCode: VARIANT.brokenCode,
      symptom: VARIANT.symptom,
      hints: VARIANT.hints,
      language: 'javascript',
      hintsRevealed: 2,
      attempts: 1,
    }
    expect(saved.challenge).toEqual(after)
    expect(await store.getChallenge(ids.alice, started.id)).toEqual(after)
    expect(await store.getChallengeSecret(started.id)).toEqual({ solution: VARIANT_SECRET.solution, bugExplanation: VARIANT_SECRET.bugExplanation })
  })

  it("never moves someone else's challenge or one already passed", async () => {
    const store = getStore()
    const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    const fields = { caseId: null, puzzleId: puzzle.id, brokenCode: puzzle.brokenCode, symptom: puzzle.symptom, language: 'python', hints: puzzle.hints }
    const bobs = await store.createChallenge(ids.bob, fields, PUZZLE_SECRET)
    const moved = (id) => ({ id, ...VARIANT, language: 'javascript', secret: VARIANT_SECRET })
    expect((await store.switchPuzzle(ids.alice, puzzle.id, { fromLanguage: 'python', toLanguage: 'javascript' }, moved(bobs.id))).challenge).toBeNull()
    expect((await store.getChallenge(ids.bob, bobs.id)).language).toBe('python')

    const other = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    const mine = await store.createChallenge(ids.alice, { ...fields, puzzleId: other.id }, PUZZLE_SECRET)
    await store.updateChallenge(ids.alice, mine.id, { status: 'passed', attempts: 1 })
    expect((await store.switchPuzzle(ids.alice, other.id, { fromLanguage: 'python', toLanguage: 'go' }, moved(mine.id))).challenge).toBeNull()
    expect(await store.getChallengeSecret(mine.id)).toEqual(PUZZLE_SECRET)
  })

  it('tells which language each solver passed a puzzle in', async () => {
    const store = getStore()
    const puzzle = await store.createPuzzle(puzzleFor(randomDay()), PUZZLE_SECRET)
    const fields = { caseId: null, puzzleId: puzzle.id, brokenCode: puzzle.brokenCode, symptom: puzzle.symptom, language: 'python', hints: puzzle.hints }
    const mine = await store.createChallenge(ids.alice, fields, PUZZLE_SECRET)
    await store.switchPuzzle(ids.alice, puzzle.id, { fromLanguage: 'python', toLanguage: 'javascript' }, { id: mine.id, ...VARIANT, language: 'javascript', secret: VARIANT_SECRET })
    await store.updateChallenge(ids.alice, mine.id, { status: 'passed', attempts: 2 })
    const bobs = await store.createChallenge(ids.bob, fields, PUZZLE_SECRET)
    await store.updateChallenge(ids.bob, bobs.id, { status: 'passed', attempts: 1 })

    const solves = await store.puzzleSolves(puzzle.id)
    expect(solves.map((item) => [item.userId, item.language, item.startedAt])).toEqual([
      [ids.alice, 'javascript', mine.createdAt],
      [ids.bob, 'python', bobs.createdAt],
    ])
  })
}
