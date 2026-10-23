// The "what kind of bug is this?" rounds. A set of their own, kept apart from the puzzle pool: the
// pool is the daily challenge's fallback, and a duel showing one of those would spoil a daily.
// Each has one clear bug, its symptom and the concept it's graded on. Server only.
const lines = (...rows) => rows.join('\n')

export const DUEL_BUGS = [
  {
    language: 'python',
    concept: 'off-by-one',
    code: lines('nums = [3, 5, 8]', 'total = 0', 'for i in range(1, len(nums)):', '    total += nums[i]', 'print(total)'),
    symptom: 'It prints 13, but 3 + 5 + 8 is 16.',
  },
  {
    language: 'javascript',
    concept: 'undefined-access',
    code: lines("const settings = { theme: 'dark' }", 'console.log(settings.colors.primary)'),
    symptom: "TypeError: Cannot read properties of undefined (reading 'primary')",
  },
  {
    language: 'python',
    concept: 'index-out-of-range',
    code: lines('days = ["mon", "tue", "wed"]', 'print(days[3])'),
    symptom: 'IndexError: list index out of range',
  },
  {
    language: 'javascript',
    concept: 'not-defined',
    code: lines('function greet(name) {', "  return 'Hi, ' + nmae", '}', "console.log(greet('Bia'))"),
    symptom: 'ReferenceError: nmae is not defined',
  },
  {
    language: 'python',
    concept: 'type-mismatch',
    code: lines('age = input("Age: ")', 'print(age + 1)'),
    symptom: 'TypeError: can only concatenate str (not "int") to str',
  },
  {
    language: 'javascript',
    concept: 'type-mismatch',
    code: lines("let total = '10'", 'total += 5', 'console.log(total)'),
    symptom: 'It prints 105 instead of 15.',
  },
  {
    language: 'python',
    concept: 'indentation-syntax',
    code: lines('def double(n):', 'return n * 2', 'print(double(4))'),
    symptom: 'IndentationError: expected an indented block',
  },
  {
    language: 'javascript',
    concept: 'missing-return',
    code: lines('function area(w, h) {', '  w * h', '}', 'console.log(area(3, 4))'),
    symptom: 'It prints undefined instead of 12.',
  },
  {
    language: 'javascript',
    concept: 'wrong-comparison',
    code: lines('let stock = 0', 'if (stock = 0) {', "  console.log('Sold out')", '} else {', "  console.log('In stock')", '}'),
    symptom: 'It prints "In stock" even though stock is 0.',
  },
  {
    language: 'python',
    concept: 'mutation-reference',
    code: lines('base = ["salt"]', 'soup = base', 'soup.append("pepper")', 'print(base)'),
    symptom: "base should still be ['salt'], but it prints ['salt', 'pepper'].",
  },
  {
    language: 'javascript',
    concept: 'async-await',
    code: lines('async function loadName() {', "  return 'Lia'", '}', 'const name = loadName()', "console.log('Hello, ' + name)"),
    symptom: 'It prints "Hello, [object Promise]" instead of "Hello, Lia".',
  },
  {
    language: 'python',
    concept: 'key-error',
    code: lines('user = {"name": "Rui"}', 'print(user["email"])'),
    symptom: "KeyError: 'email'",
  },
]
