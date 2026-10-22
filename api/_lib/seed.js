// A ready-made board for the demo account, so judges see every column without waiting on the AI.
const DEMO_CASES = [
  {
    status: 'new',
    passedCount: 0,
    error: "TypeError: Cannot read properties of undefined (reading 'length')",
    code: 'const user = {}\nconsole.log(user.name.length)',
    concept: 'undefined-access',
    language: 'javascript',
    analysis: {
      explicacao:
        'Your code asked for the length of user.name, but user has no name yet. JavaScript gives back undefined for a missing property, and undefined has nothing inside it to read.',
      causa:
        'Reading a property that does not exist is allowed and returns undefined. Reading a property OF undefined is not: undefined is not an object, so asking it for .length stops the program.',
      correcao: "Give the object the property first, or check it before reading:\nconst user = { name: 'Ada' }\nconsole.log(user.name?.length)",
      exercicio: {
        enunciado: 'const book = {}\nconsole.log(book.title.toUpperCase())',
        resposta: "const book = { title: 'Dune' }\nconsole.log(book.title.toUpperCase())\nbook.title must exist before you call a method on it.",
      },
    },
  },
  {
    status: 'new',
    passedCount: 0,
    error: 'IndentationError: expected an indented block',
    code: 'def greet(name):\nprint("Hi", name)',
    concept: 'indentation-syntax',
    language: 'python',
    analysis: {
      explicacao: 'Python expected the body of greet to be indented, but the print line starts at the left edge.',
      causa:
        'Python uses indentation to know which lines belong to a function, loop or if. A line ending in a colon promises an indented block right after it.',
      correcao: 'def greet(name):\n    print("Hi", name)',
      exercicio: {
        enunciado: 'for n in range(3):\nprint(n)',
        resposta: 'for n in range(3):\n    print(n)\nThe loop body must be indented under the for line.',
      },
    },
  },
  {
    status: 'training',
    passedCount: 1,
    error: 'IndexError: list index out of range',
    code: 'nums = [10, 20, 30]\nprint(nums[3])',
    concept: 'index-out-of-range',
    language: 'python',
    analysis: {
      explicacao: 'You asked for position 3 of a list that only has positions 0, 1 and 2.',
      causa:
        'Python counts list positions from 0, so the last item of a list with 3 items is at index 2. Index 3 points one step past the end.',
      correcao: 'print(nums[2])  # or nums[-1] for the last item',
      exercicio: {
        enunciado: "colors = ['red', 'blue']\nprint(colors[2])",
        resposta: 'print(colors[1])\nTwo items means the indexes are 0 and 1.',
      },
    },
    challenge: {
      brokenCode: "scores = [7, 9, 4, 10]\nfor i in range(1, len(scores) + 1):\n    print(scores[i])",
      symptom: 'IndexError: list index out of range',
      hints: [
        'Look at the numbers range() gives the loop.',
        'The last value of i is len(scores), which is 4.',
        'Start the range at 0 and stop at len(scores).',
      ],
      solution: 'scores = [7, 9, 4, 10]\nfor i in range(len(scores)):\n    print(scores[i])',
      bugExplanation: 'range(1, len(scores) + 1) ends at 4, but the last valid index is 3.',
    },
  },
  {
    status: 'solved',
    passedCount: 2,
    error: 'ReferenceError: x is not defined',
    code: 'function total() {\n  return x + 1\n}\ntotal()',
    concept: 'not-defined',
    language: 'javascript',
    analysis: {
      explicacao: 'total() uses a variable called x, but x was never created anywhere the function can see.',
      causa:
        'Before you read a variable, it has to be declared (let, const, a parameter) in the current scope or an outer one. JavaScript cannot guess what x should be.',
      correcao: 'function total(x) {\n  return x + 1\n}\ntotal(4)',
      exercicio: {
        enunciado: 'function double() {\n  return n * 2\n}\ndouble()',
        resposta: 'function double(n) {\n  return n * 2\n}\ndouble(5)\nn now arrives as a parameter.',
      },
    },
  },
]

// Minutes studied 3, 2 and 1 days ago: a 3-day streak, and one day long enough for Deep focus.
const DEMO_STUDY_MINUTES = [20, 35, 15]

// A challenge the demo already beat, built from the case's own practice exercise.
async function seedPassedChallenge(store, userId, kase, hintsRevealed) {
  const { enunciado, resposta } = kase.analysis.exercicio
  const challenge = await store.createChallenge(
    userId,
    { caseId: kase.id, brokenCode: enunciado, symptom: kase.error, language: kase.language, hints: ['Read the error again.', 'Look at the line it names.', 'Compare with the fix on the card.'] },
    { solution: resposta, bugExplanation: kase.analysis.causa },
  )
  await store.updateChallenge(userId, challenge.id, { status: 'passed', attempts: 1, hintsRevealed })
}

function demoNote(byConcept) {
  return {
    title: 'My debugging notebook',
    blocks: [
      { id: 'demo-1', type: 'heading', text: 'Things I keep getting wrong' },
      { id: 'demo-2', type: 'text', text: 'Reading a property of something that is not there yet. Check the object exists before going deeper.' },
      { id: 'demo-3', type: 'case', caseId: byConcept['undefined-access'].id },
      { id: 'demo-4', type: 'todo', text: 'Try optional chaining (?.) in my own project', done: true },
      { id: 'demo-5', type: 'text', text: 'Lists start at 0. The last index is length - 1.' },
      { id: 'demo-6', type: 'case', caseId: byConcept['index-out-of-range'].id },
      { id: 'demo-7', type: 'todo', text: 'Pass the second gym challenge for this one', done: false },
    ],
  }
}

// Returns false (and changes nothing) when the account already has cases.
export async function seedDemo(store, userId, now = new Date()) {
  if ((await store.listCases(userId)).length > 0) return false

  const byConcept = {}
  for (const { status, passedCount, challenge, ...fields } of DEMO_CASES) {
    const created = await store.createCase(userId, fields)
    await store.updateCase(userId, created.id, { status, passedCount })
    byConcept[fields.concept] = created
    // One passed challenge per pass already on the card; the first one without hints.
    for (let pass = 0; pass < passedCount; pass++) await seedPassedChallenge(store, userId, created, pass === 0 ? 0 : 2)
    if (challenge) {
      const { solution, bugExplanation, ...publicPart } = challenge
      await store.createChallenge(userId, { caseId: created.id, language: fields.language, ...publicPart }, { solution, bugExplanation })
    }
  }

  await store.createNote(userId, demoNote(byConcept))
  for (const [index, minutes] of DEMO_STUDY_MINUTES.entries()) {
    const day = new Date(now.getTime() - (DEMO_STUDY_MINUTES.length - index) * 24 * 3_600_000).toISOString().slice(0, 10)
    await store.addStudyTime(userId, day, minutes * 60, minutes * 60)
  }
  return true
}
