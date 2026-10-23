import { expect, it } from 'vitest'

// Question cases (cards from a doubt chat): every store must pass these. storeContract calls this
// inside its describe, with a getter for the store and its test users.
export const QUESTION_CASE = {
  kind: 'question',
  error: '',
  code: 'for i in range(len(xs) - 1):\n    print(xs[i])',
  context: '',
  files: [],
  question: 'Why does my loop skip the last item?',
  topic: 'range end',
  title: 'range stops before its end',
  recap: 'Asked why the loop skips the last item; saw that range excludes its end.',
  analysis: { explicacao: 'range(n) stops at n - 1.', causa: 'The end of a range is not included.', correcao: '', exercicio: { enunciado: 'Print 1 to 5.', resposta: 'range(1, 6)' } },
  concept: 'off-by-one',
  language: 'python',
}

const ERROR_CASE = {
  error: 'TypeError: x is undefined',
  code: 'x.y',
  analysis: { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } },
  concept: 'undefined-access',
  language: 'javascript',
}

const QUESTION_FIELDS = { question: '', topic: '', title: '', recap: '' }

export function questionStoreContract(getStore, ids) {
  it('keeps a question case with its kind, question, topic, title and recap', async () => {
    const store = getStore()
    const created = await store.createCase(ids.alice, QUESTION_CASE)
    expect(created).toMatchObject({ ...QUESTION_CASE, userId: ids.alice, status: 'new', passedCount: 0 })
    expect(await store.getCase(ids.alice, created.id)).toMatchObject(QUESTION_CASE)
    expect((await store.listCases(ids.alice)).find((item) => item.id === created.id)).toMatchObject(QUESTION_CASE)
    // Moving it through the gym keeps what it is.
    expect(await store.updateCase(ids.alice, created.id, { status: 'training' })).toMatchObject({ kind: 'question', topic: 'range end', status: 'training' })
    expect(await store.getCase(ids.bob, created.id)).toBeNull()
  })

  it('makes an investigated error a case of kind error with empty question fields', async () => {
    const store = getStore()
    const created = await store.createCase(ids.alice, ERROR_CASE)
    expect(created).toMatchObject({ ...ERROR_CASE, kind: 'error', ...QUESTION_FIELDS })
    expect(await store.getCase(ids.alice, created.id)).toMatchObject({ kind: 'error', ...QUESTION_FIELDS })
  })
}
