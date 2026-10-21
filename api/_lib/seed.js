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

// Returns false (and changes nothing) when the account already has cases.
export async function seedDemo(store, userId) {
  if ((await store.listCases(userId)).length > 0) return false

  for (const { status, passedCount, challenge, ...fields } of DEMO_CASES) {
    const created = await store.createCase(userId, fields)
    await store.updateCase(userId, created.id, { status, passedCount })
    if (challenge) {
      const { solution, bugExplanation, ...publicPart } = challenge
      await store.createChallenge(userId, { caseId: created.id, language: fields.language, ...publicPart }, { solution, bugExplanation })
    }
  }
  return true
}
