import { seedEvents } from '../events/events.seed.js'

// Sample community content, so the articles area is never empty for a judge trying the demo.
// The sample people have no password, so nobody can sign in as them.
const TEAM = {
  email: 'team@sample.glitch',
  profile: {
    handle: 'glitch_team',
    displayName: 'Glitch Team',
    bio: 'Short write-ups about the bugs students hit most.',
    avatar: { seed: 'glitch-team', color: 'violet' },
    isPublic: true,
  },
}

const READER = {
  email: 'bo@sample.glitch',
  profile: { handle: 'bo_reads', displayName: 'Bo', bio: 'Collecting stack traces.', avatar: { seed: 'bo-reads', color: 'cobalt' }, isPublic: false },
}

const ARTICLES = [
  {
    title: 'Undefined everywhere: reading a property too early',
    tags: ['javascript', 'undefined', 'beginner'],
    body: [
      "TypeError: Cannot read properties of undefined is the error we see most on the board. It always means the same thing: the thing before the dot isn't there yet.",
      'Read the error from the end. "(reading \'length\')" names the property, so look one step to the left of it: that value is undefined.',
      '```js\nconst user = {}\nconsole.log(user.name.length) // user.name is undefined\n```',
      'Two fixes, depending on what you meant. If the value must exist, give it one before you read it. If it may be missing, ask politely with optional chaining:',
      '```js\nconsole.log(user.name?.length ?? 0)\n```',
      'Then train it in the gym until `?.` is a habit, not a guess.',
    ].join('\n\n'),
    comments: ['This finally made optional chaining click for me. Reading the error from the end helps a lot.'],
    reaction: { liked: true, rating: 'valid' },
  },
  {
    title: 'Off by one: why range() stops early',
    tags: ['python', 'loops', 'off-by-one'],
    body: [
      'IndexError: list index out of range usually hides an off by one. Lists start at 0, so a list of 4 items ends at index 3.',
      '```python\nscores = [7, 9, 4, 10]\nfor i in range(1, len(scores) + 1):\n    print(scores[i])  # i reaches 4\n```',
      '`range(a, b)` stops before b. Start at 0 and stop at `len(scores)`, or skip indexes and loop over the items themselves:',
      '```python\nfor score in scores:\n    print(score)\n```',
    ].join('\n\n'),
    comments: ['Looping over the items directly is so much cleaner.'],
    reaction: { liked: true },
  },
  {
    title: 'Read the stack trace in three steps',
    tags: ['debugging', 'python', 'javascript'],
    body: [
      'A stack trace is a list of clues, not a wall of noise. Find three things before you change any code.',
      'First, the error type and message: TypeError, IndexError, ReferenceError. That names the kind of bug.',
      'Second, the first line that points at your own file, not a library. That is where to look.',
      'Third, the values on that line. Print them, or hover them in the debugger, and ask which one is not what you expected.',
    ].join('\n\n'),
    comments: [],
    reaction: null,
  },
]

// The same samples for a Portuguese reader, by the same sample people. Code and error messages stay
// as the languages print them.
const ARTICLES_PT = [
  {
    title: 'Undefined em todo lugar: lendo uma propriedade cedo demais',
    tags: ['javascript', 'undefined', 'iniciante'],
    body: [
      'TypeError: Cannot read properties of undefined é o erro que mais aparece no board. Ele sempre quer dizer a mesma coisa: o que vem antes do ponto ainda não existe.',
      'Leia o erro de trás para frente. "(reading \'length\')" diz qual é a propriedade, então olhe um passo à esquerda dela: esse valor é undefined.',
      '```js\nconst user = {}\nconsole.log(user.name.length) // user.name é undefined\n```',
      'Duas correções, dependendo do que você queria. Se o valor precisa existir, dê um valor a ele antes de ler. Se ele pode faltar, pergunte com educação usando optional chaining:',
      '```js\nconsole.log(user.name?.length ?? 0)\n```',
      'Depois treine no gym até o `?.` virar hábito, e não um chute.',
    ].join('\n\n'),
    comments: ['Finalmente entendi optional chaining. Ler o erro de trás para frente ajuda muito.'],
    reaction: { liked: true, rating: 'valid' },
  },
  {
    title: 'Um a mais: por que o range() para antes',
    tags: ['python', 'loops', 'off-by-one'],
    body: [
      'IndexError: list index out of range quase sempre esconde um erro de um a mais. Listas começam no 0, então uma lista com 4 itens termina no índice 3.',
      '```python\nscores = [7, 9, 4, 10]\nfor i in range(1, len(scores) + 1):\n    print(scores[i])  # i chega a 4\n```',
      '`range(a, b)` para antes de b. Comece no 0 e pare em `len(scores)`, ou deixe os índices de lado e percorra os próprios itens:',
      '```python\nfor score in scores:\n    print(score)\n```',
    ].join('\n\n'),
    comments: ['Percorrer os itens direto fica muito mais limpo.'],
    reaction: { liked: true },
  },
  {
    title: 'Leia o stack trace em três passos',
    tags: ['debugging', 'python', 'javascript'],
    body: [
      'Um stack trace é uma lista de pistas, não um paredão de ruído. Encontre três coisas antes de mudar qualquer código.',
      'Primeiro, o tipo e a mensagem do erro: TypeError, IndexError, ReferenceError. Isso diz que tipo de bug é.',
      'Segundo, a primeira linha que aponta para um arquivo seu, não de uma biblioteca. É ali que você vai olhar.',
      'Terceiro, os valores nessa linha. Imprima esses valores, ou passe o mouse em cima deles no debugger, e pergunte qual não é o que você esperava.',
    ].join('\n\n'),
    comments: [],
    reaction: null,
  },
]

// Each language's samples, and the words that find its first article (the one the demo's
// notification points at).
const SAMPLES = {
  en: { articles: ARTICLES, search: 'Undefined everywhere' },
  'pt-BR': { articles: ARTICLES_PT, search: 'Undefined em todo lugar' },
}

// The team's first sample in that language, or undefined when it was never made.
async function firstSample(store, team, { articles, search }) {
  const found = await store.searchArticles({ q: search, sort: 'new', offset: 0, limit: 10 })
  return found.articles.find((item) => item.authorId === team.id && item.title === articles[0].title)
}

// The account for a sample person, made (with its profile) the first time it is needed.
export async function samplePerson(store, { email, profile }) {
  const existing = await store.findUserByEmail(email)
  // Only ever reuse the app's own passwordless sample account, never someone's real one.
  if (existing) return existing.passwordHash === null && !existing.isDemo ? existing : null
  // Two demos starting at once: the second create finds the email taken and reads the first one.
  const created = (await store.createUser({ email, passwordHash: null, isDemo: false })) ?? (await store.findUserByEmail(email))
  const result = await store.updateProfile(created.id, profile)
  // Someone already owns the handle: keep the sample person, just without one.
  if (result?.conflict) await store.updateProfile(created.id, { ...profile, handle: null, isPublic: false })
  return created
}

// Makes the sample articles in the visitor's language once (the first demo in each language makes
// that language's set), then gives this demo account one notification to open, on a sample it can read.
export async function seedCommunity(store, demoUserId, locale = 'en') {
  const team = await samplePerson(store, TEAM)
  const reader = await samplePerson(store, READER)
  if (!team || !reader) return

  const samples = SAMPLES[locale] ?? SAMPLES.en
  if (!(await firstSample(store, team, samples))) {
    for (const { comments, reaction, ...fields } of samples.articles) {
      const article = await store.createArticle(team.id, { ...fields, caseId: null })
      for (const body of comments) await store.createComment(reader.id, article.id, body)
      if (reaction) await store.setReaction(article.id, reader.id, reaction)
    }
  }

  // A sample live event with a couple of entries and votes (see events/seed.js).
  await seedEvents(store, { team, reader }, samplePerson, Date.now(), locale)

  // "Bo commented on Undefined everywhere", pointing at the team's first sample in this language.
  const first = await firstSample(store, team, samples)
  if (first) await store.addNotification({ userId: demoUserId, type: 'comment', actorId: reader.id, articleId: first.id })
}
