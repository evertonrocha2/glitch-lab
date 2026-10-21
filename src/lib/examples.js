// Errors every student has seen; one click fills the form (handy for judges too).
export const EXAMPLES = [
  {
    label: 'JS: TypeError',
    error: "TypeError: Cannot read properties of undefined (reading 'length')",
    code: 'const user = {}\nconsole.log(user.name.length)',
  },
  {
    label: 'JS: ReferenceError',
    error: 'ReferenceError: x is not defined',
    code: 'function total() {\n  return x + 1\n}\ntotal()',
  },
  {
    label: 'Python: IndexError',
    error: 'IndexError: list index out of range',
    code: 'nums = [10, 20, 30]\nprint(nums[3])',
  },
  {
    label: 'Python: IndentationError',
    error: 'IndentationError: expected an indented block',
    code: 'def greet(name):\nprint("Hi", name)',
  },
]
