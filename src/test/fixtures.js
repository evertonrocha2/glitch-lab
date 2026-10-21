// Cases shaped like the API returns them, for UI tests.
export function makeCase(overrides = {}) {
  return {
    id: 'c1',
    userId: 'alice',
    error: "TypeError: Cannot read properties of undefined (reading 'length')\n    at cart.js:2",
    code: 'const user = {}\nconsole.log(user.name.length)',
    analysis: {
      explicacao: 'You read .length of something that does not exist.',
      causa: 'user.name was never set, so it is undefined.',
      correcao: 'if (user.name) console.log(user.name.length)',
      exercicio: { enunciado: 'const a = {}\nconsole.log(a.b.c)', resposta: 'a.b is undefined, so check it first.' },
    },
    concept: 'undefined-access',
    language: 'javascript',
    status: 'new',
    passedCount: 0,
    createdAt: '2026-10-21T10:00:00.000Z',
    updatedAt: '2026-10-21T10:00:00.000Z',
    ...overrides,
  }
}
