import { expect, it } from 'vitest'
import { saveDraft, takeDraft } from './draft.js'

it('takes a saved draft only once', () => {
  saveDraft({ error: 'TypeError: x', code: 'def f():\n    pass' })
  expect(takeDraft()).toEqual({ error: 'TypeError: x', code: 'def f():\n    pass' })
  expect(takeDraft()).toBeNull()
})
