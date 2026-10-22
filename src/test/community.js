// Community articles shaped like /api/community returns them, for UI tests.
export const ADA = { handle: 'ada_dev', name: 'Ada', avatar: { seed: 'abc', color: 'cobalt' }, isPublic: true }
export const BO = { handle: 'bo_reads', name: 'Bo', avatar: { seed: 'bo', color: 'violet' }, isPublic: false }

export function makeSummary(overrides = {}) {
  return {
    id: 'a1',
    title: 'Undefined everywhere',
    excerpt: 'Reading a property of undefined throws.',
    tags: ['javascript', 'undefined'],
    author: ADA,
    counts: { likes: 3, valid: 2, bad: 0, comments: 1 },
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...overrides,
  }
}

export function makeArticle(overrides = {}) {
  const { excerpt: _excerpt, ...summary } = makeSummary()
  return {
    ...summary,
    body: 'Reading a property of undefined throws.\n\nUse `a?.b` when a may be missing:\n\n```js\nconst name = user?.name\n```\n\n<img src=x onerror=alert(1)>',
    mine: false,
    linkedCase: { errorType: 'TypeError', concept: 'Reading undefined', language: 'javascript' },
    ...overrides,
  }
}

export function makeComment(overrides = {}) {
  return { id: 'c1', body: 'Great tip.', author: BO, canDelete: false, createdAt: new Date().toISOString(), ...overrides }
}

export function makeNotification(overrides = {}) {
  return {
    id: 'n1',
    type: 'comment',
    read: false,
    articleId: 'a1',
    articleTitle: 'Undefined everywhere',
    actor: { ...BO, name: 'Ana' },
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}
