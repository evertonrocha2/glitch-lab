// Hand-written puzzles for days the cron didn't run or the AI was down. Each has exactly one bug
// (globals: two, found one after the other), a symptom, three hints from vague to direct, and the
// secret solution the judge compares against. `pt` has the Brazilian Portuguese explanation, and the
// symptom too when it is prose (a real error message stays as the language prints it). The daily
// puzzle is shared by everyone, so it is saved in English; review cards pick the text by locale.
const lines = (...rows) => rows.join('\n')

export const POOL = [
  // Easy dailies.
  {
    kind: 'daily',
    difficulty: 'easy',
    language: 'python',
    concept: 'off-by-one',
    title: 'The missing last item',
    brokenCode: lines('items = ["pen", "book", "lamp"]', 'for i in range(len(items) - 1):', '    print(items[i])'),
    symptom: 'It prints pen and book, but never lamp.',
    hints: ['Count how many lines get printed.', 'Look at where the range stops.', 'range already stops one before its end value.'],
    solution: lines('items = ["pen", "book", "lamp"]', 'for i in range(len(items)):', '    print(items[i])'),
    bugExplanation: 'range(len(items) - 1) stops one index early, so the last item is skipped. range(len(items)) covers every index.',
    pt: {
      symptom: 'Imprime pen e book, mas nunca lamp.',
      bugExplanation: 'range(len(items) - 1) para um índice antes, então o último item fica de fora. range(len(items)) passa por todos os índices.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'easy',
    language: 'javascript',
    concept: 'undefined-access',
    title: 'Where does Ana live?',
    brokenCode: lines("const user = { name: 'Ana', adress: { city: 'Recife' } }", 'console.log(user.address.city)'),
    symptom: "TypeError: Cannot read properties of undefined (reading 'city')",
    hints: ['Which value is undefined when .city is read?', 'Compare the key you read with the key in the object.', 'One of the two spellings of address is wrong.'],
    solution: lines("const user = { name: 'Ana', address: { city: 'Recife' } }", 'console.log(user.address.city)'),
    bugExplanation: 'The object key is spelled "adress", so user.address is undefined. Spelling the key the same way in both places fixes it.',
    pt: {
      bugExplanation: 'A chave do objeto está escrita "adress", então user.address é undefined. Escrever a chave do mesmo jeito nos dois lugares resolve.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'easy',
    language: 'python',
    concept: 'key-error',
    title: 'The capital apple',
    brokenCode: lines('prices = {"apple": 2, "banana": 1}', 'item = "Apple"', 'print(prices[item])'),
    symptom: "KeyError: 'Apple'",
    hints: ['Print the keys of prices and compare them with item.', 'Dictionary keys are case sensitive.', 'Look the item up in lowercase.'],
    solution: lines('prices = {"apple": 2, "banana": 1}', 'item = "Apple"', 'print(prices[item.lower()])'),
    bugExplanation: 'Keys are case sensitive and the dictionary only has "apple". Lowercasing the item before the lookup finds it.',
    pt: {
      bugExplanation: 'As chaves diferenciam maiúsculas de minúsculas, e o dicionário só tem "apple". Passar o item para minúsculas antes da busca encontra a chave.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'easy',
    language: 'python',
    concept: 'index-out-of-range',
    title: 'One past the end',
    brokenCode: lines('scores = [7, 9, 4]', 'last = scores[len(scores)]', 'print("Last score:", last)'),
    symptom: 'IndexError: list index out of range',
    hints: ['How many items does scores have, and what is the biggest index?', 'Indexes start at 0.', 'The last index is len(scores) - 1, or just -1.'],
    solution: lines('scores = [7, 9, 4]', 'last = scores[-1]', 'print("Last score:", last)'),
    bugExplanation: 'A list of 3 items has indexes 0 to 2, so index 3 does not exist. scores[-1] (or len(scores) - 1) is the last item.',
    pt: {
      bugExplanation: 'Uma lista com 3 itens tem índices de 0 a 2, então o índice 3 não existe. scores[-1] (ou len(scores) - 1) é o último item.',
    },
  },

  // Medium dailies.
  {
    kind: 'daily',
    difficulty: 'medium',
    language: 'javascript',
    concept: 'wrong-comparison',
    title: 'Not quite an adult',
    brokenCode: lines('function isAdult(age) {', '  return age > 18', '}', '', 'console.log(isAdult(18))'),
    symptom: 'It prints false, but someone who is 18 counts as an adult.',
    hints: ['Try the function with 17, 18 and 19.', 'What should happen exactly at 18?', 'The comparison must include 18 itself.'],
    solution: lines('function isAdult(age) {', '  return age >= 18', '}', '', 'console.log(isAdult(18))'),
    bugExplanation: 'age > 18 is false at exactly 18. age >= 18 includes the boundary.',
    pt: {
      symptom: 'Imprime false, mas quem tem 18 anos já conta como adulto.',
      bugExplanation: 'age > 18 dá false quando a idade é exatamente 18. age >= 18 inclui o limite.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'medium',
    language: 'python',
    concept: 'missing-return',
    title: 'The average of nothing',
    brokenCode: lines('def average(numbers):', '    total = sum(numbers)', '    total / len(numbers)', '', 'print(average([4, 6, 8]))'),
    symptom: 'It prints None instead of 6.0.',
    hints: ['What does a function give back when it has no return?', 'The division is computed, then thrown away.', 'Send the result of the division back to the caller.'],
    solution: lines('def average(numbers):', '    total = sum(numbers)', '    return total / len(numbers)', '', 'print(average([4, 6, 8]))'),
    bugExplanation: 'The function computes the average but never returns it, so Python returns None. Adding return fixes it.',
    pt: {
      symptom: 'Imprime None em vez de 6.0.',
      bugExplanation: 'A função calcula a média, mas nunca retorna o valor, então o Python devolve None. Adicionar o return resolve.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'medium',
    language: 'python',
    concept: 'type-mismatch',
    title: 'Next year never comes',
    brokenCode: lines('age = "20"  # read from a form', 'next_year = age + 1', 'print("Next year you will be", next_year)'),
    symptom: 'TypeError: can only concatenate str (not "int") to str',
    hints: ['What type does age have?', 'Text from a form is a string, even when it looks like a number.', 'Turn age into a number before adding.'],
    solution: lines('age = "20"  # read from a form', 'next_year = int(age) + 1', 'print("Next year you will be", next_year)'),
    bugExplanation: 'age is the string "20", and Python cannot add a string and an int. int(age) converts it first.',
    pt: {
      bugExplanation: 'age é a string "20", e o Python não soma string com int. int(age) converte o valor antes.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'medium',
    language: 'javascript',
    concept: 'not-defined',
    title: 'The message that stayed inside',
    brokenCode: lines('function greet(name) {', '  const message = `Hi, ${name}!`', '}', '', "greet('Bia')", 'console.log(message)'),
    symptom: 'ReferenceError: message is not defined',
    hints: ['Where was message created?', 'A const only exists inside the block that declares it.', 'Have greet give the message back and log that.'],
    solution: lines('function greet(name) {', '  const message = `Hi, ${name}!`', '  return message', '}', '', "console.log(greet('Bia'))"),
    bugExplanation: 'message lives only inside greet, so the outer code cannot see it. Returning it from greet and logging the result fixes it.',
    pt: {
      bugExplanation: 'message só existe dentro de greet, então o código de fora não enxerga a variável. Retornar a mensagem em greet e logar o resultado resolve.',
    },
  },

  // Hard dailies.
  {
    kind: 'daily',
    difficulty: 'hard',
    language: 'python',
    concept: 'mutation-reference',
    title: 'The cart that remembers',
    brokenCode: lines('def add_item(item, cart=[]):', '    cart.append(item)', '    return cart', '', 'print(add_item("pen"))', 'print(add_item("book"))'),
    symptom: "The second line prints ['pen', 'book'], but it should be ['book'].",
    hints: ['Each call should start with an empty cart. Does it?', 'A default value is created once, when the function is defined.', 'Use None as the default and make a new list inside.'],
    solution: lines(
      'def add_item(item, cart=None):',
      '    if cart is None:',
      '        cart = []',
      '    cart.append(item)',
      '    return cart',
      '',
      'print(add_item("pen"))',
      'print(add_item("book"))',
    ),
    bugExplanation: 'The default list is shared by every call, so items pile up. A None default with a fresh list per call fixes it.',
    pt: {
      symptom: "A segunda linha imprime ['pen', 'book'], mas deveria ser ['book'].",
      bugExplanation: 'A lista padrão é compartilhada por todas as chamadas, então os itens vão se acumulando. Usar None como padrão e criar uma lista nova em cada chamada resolve.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'hard',
    language: 'javascript',
    concept: 'async-await',
    title: 'Total: [object Promise]',
    brokenCode: lines('async function getTotal() {', '  return 42', '}', '', 'async function main() {', '  const total = getTotal()', '  console.log(`Total: ${total + 1}`)', '}', '', 'main()'),
    symptom: 'It prints "Total: [object Promise]1" instead of "Total: 43".',
    hints: ['What does an async function return?', 'total is not a number yet when you add 1.', 'Wait for the promise before using its value.'],
    solution: lines('async function getTotal() {', '  return 42', '}', '', 'async function main() {', '  const total = await getTotal()', '  console.log(`Total: ${total + 1}`)', '}', '', 'main()'),
    bugExplanation: 'getTotal returns a Promise, and adding 1 to a Promise makes a string. await gives the number 42 first.',
    pt: {
      symptom: 'Imprime "Total: [object Promise]1" em vez de "Total: 43".',
      bugExplanation: 'getTotal retorna uma Promise, e somar 1 a uma Promise vira uma string. Com await, você recebe o número 42 antes.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'hard',
    language: 'javascript',
    concept: 'mutation-reference',
    title: 'The copy that was not a copy',
    brokenCode: lines(
      "const base = { theme: 'light', tags: [] }",
      'const draft = { ...base }',
      "draft.tags.push('new')",
      '',
      'console.log(base.tags)',
    ),
    symptom: "It prints [ 'new' ], but base should still have no tags.",
    hints: ['Did the spread copy the tags array or just point at it?', 'Spreading copies only the first level of an object.', 'Give draft its own tags array.'],
    solution: lines(
      "const base = { theme: 'light', tags: [] }",
      'const draft = { ...base, tags: [...base.tags] }',
      "draft.tags.push('new')",
      '',
      'console.log(base.tags)',
    ),
    bugExplanation: 'The spread is a shallow copy, so draft.tags and base.tags are the same array. Copying the array too keeps base untouched.',
    pt: {
      symptom: "Imprime [ 'new' ], mas base deveria continuar sem tags.",
      bugExplanation: 'O spread faz uma cópia rasa, então draft.tags e base.tags são o mesmo array. Copiar o array também deixa base intacto.',
    },
  },
  {
    kind: 'daily',
    difficulty: 'hard',
    language: 'python',
    concept: 'wrong-comparison',
    title: 'Equal, but not the same',
    brokenCode: lines('def same_total(a, b):', '    return sum(a) is sum(b)', '', 'print(same_total([500, 500], [1000]))'),
    symptom: 'It prints False, but both lists add up to 1000.',
    hints: ['Try it with small numbers, like [1, 1] and [2].', 'is checks whether two values are the same object.', 'Compare the values, not the objects.'],
    solution: lines('def same_total(a, b):', '    return sum(a) == sum(b)', '', 'print(same_total([500, 500], [1000]))'),
    bugExplanation: 'is compares identity, and two separate 1000 objects are not the same object. == compares the values.',
    pt: {
      symptom: 'Imprime False, mas as duas listas somam 1000.',
      bugExplanation: 'is compara identidade, e dois objetos 1000 criados separadamente não são o mesmo objeto. == compara os valores.',
    },
  },

  // Global challenges: longer, with a second bug waiting behind the first.
  {
    kind: 'global',
    difficulty: 'hard',
    language: 'python',
    concept: 'missing-return',
    title: 'The coupon that never applied',
    brokenCode: lines(
      'def apply_discount(price, percent):',
      '    return price - price * percent / 100',
      '',
      'def cart_total(items, coupon):',
      '    total = 0',
      '    for name, price in items.items():',
      '        total =+ price',
      '    if coupon == "SAVE10":',
      '        apply_discount(total, 10)',
      '    return round(total, 2)',
      '',
      'cart = {"book": 30.0, "pen": 5.5}',
      'print(cart_total(cart, "SAVE10"))',
    ),
    symptom: 'It prints 5.5. The cart is worth 35.5, so with the 10% coupon it should print 31.95.',
    hints: [
      'Print total inside the loop. Is it growing?',
      'Look closely at the operator in total =+ price.',
      'After fixing the sum, check what happens to the value apply_discount gives back.',
    ],
    solution: lines(
      'def apply_discount(price, percent):',
      '    return price - price * percent / 100',
      '',
      'def cart_total(items, coupon):',
      '    total = 0',
      '    for name, price in items.items():',
      '        total += price',
      '    if coupon == "SAVE10":',
      '        total = apply_discount(total, 10)',
      '    return round(total, 2)',
      '',
      'cart = {"book": 30.0, "pen": 5.5}',
      'print(cart_total(cart, "SAVE10"))',
    ),
    bugExplanation:
      'Two bugs: "total =+ price" assigns +price instead of adding, and the discounted value is thrown away. Use += and assign the result of apply_discount to total.',
    pt: {
      symptom: 'Imprime 5.5. O carrinho vale 35.5, então com o cupom de 10% deveria imprimir 31.95.',
      bugExplanation: 'Dois bugs: "total =+ price" atribui +price em vez de somar, e o valor com desconto é jogado fora. Use += e atribua o resultado de apply_discount a total.',
    },
  },
  {
    kind: 'global',
    difficulty: 'hard',
    language: 'javascript',
    concept: 'wrong-comparison',
    title: 'Everybody passes',
    brokenCode: lines(
      'function average(grades) {',
      '  let sum = 0',
      '  for (let i = 1; i < grades.length; i++) sum += grades[i]',
      '  return sum / grades.length',
      '}',
      '',
      'function report(students) {',
      '  return students.map((student) => {',
      '    const avg = average(student.grades)',
      '    if (avg => 7) return `${student.name}: passed`',
      '    return `${student.name}: failed`',
      '  })',
      '}',
      '',
      "console.log(report([{ name: 'Ana', grades: [8, 9] }, { name: 'Leo', grades: [4, 5] }]))",
    ),
    symptom: "It prints [ 'Ana: passed', 'Leo: passed' ]. Leo's average is 4.5, so he should fail.",
    hints: [
      'Log avg for each student. Is the condition even using it?',
      'avg => 7 is not a comparison in JavaScript. What is it?',
      'Once the condition is fixed, check that average reads every grade, starting at index 0.',
    ],
    solution: lines(
      'function average(grades) {',
      '  let sum = 0',
      '  for (let i = 0; i < grades.length; i++) sum += grades[i]',
      '  return sum / grades.length',
      '}',
      '',
      'function report(students) {',
      '  return students.map((student) => {',
      '    const avg = average(student.grades)',
      '    if (avg >= 7) return `${student.name}: passed`',
      '    return `${student.name}: failed`',
      '  })',
      '}',
      '',
      "console.log(report([{ name: 'Ana', grades: [8, 9] }, { name: 'Leo', grades: [4, 5] }]))",
    ),
    bugExplanation:
      'Two bugs: "avg => 7" is an arrow function, which is always truthy, so it must be avg >= 7. The loop also starts at 1 and skips the first grade.',
    pt: {
      symptom: "Imprime [ 'Ana: passed', 'Leo: passed' ]. A média do Leo é 4.5, então ele deveria reprovar.",
      bugExplanation: 'Dois bugs: "avg => 7" é uma arrow function, que é sempre truthy, então o certo é avg >= 7. O loop também começa em 1 e pula a primeira nota.',
    },
  },
  {
    kind: 'global',
    difficulty: 'hard',
    language: 'python',
    concept: 'key-error',
    title: 'The word counter that could not count',
    brokenCode: lines(
      'def count_words(text):',
      '    counts = {}',
      '    for word in text.split(" "):',
      '        counts[word] += 1',
      '    return counts',
      '',
      'def top_word(text):',
      '    counts = count_words(text.lower)',
      '    best = None',
      '    for word, n in counts.items():',
      '        if best is None or n > counts[best]:',
      '            best = word',
      '    return best',
      '',
      'print(top_word("The cat and the hat"))',
    ),
    symptom: "AttributeError: 'builtin_function_or_method' object has no attribute 'split'",
    hints: [
      'What is passed to count_words? Is it text, or something else?',
      'A method needs parentheses to run. After that fix, run it again and read the new error.',
      'A word seen for the first time has no count yet: start it at 0 before adding 1.',
    ],
    solution: lines(
      'def count_words(text):',
      '    counts = {}',
      '    for word in text.split(" "):',
      '        counts[word] = counts.get(word, 0) + 1',
      '    return counts',
      '',
      'def top_word(text):',
      '    counts = count_words(text.lower())',
      '    best = None',
      '    for word, n in counts.items():',
      '        if best is None or n > counts[best]:',
      '            best = word',
      '    return best',
      '',
      'print(top_word("The cat and the hat"))',
    ),
    bugExplanation:
      'Two bugs: text.lower without parentheses passes the method itself, and counts[word] += 1 fails for a new word with a KeyError. Call text.lower() and use counts.get(word, 0) + 1.',
    pt: {
      bugExplanation: 'Dois bugs: text.lower sem parênteses passa o próprio método, e counts[word] += 1 dá KeyError numa palavra nova. Chame text.lower() e use counts.get(word, 0) + 1.',
    },
  },
]

// A pool entry's prose in the reader's language, English when there is no translation.
export function poolText(entry, locale) {
  const pt = locale === 'pt-BR' ? entry.pt : null
  return { symptom: pt?.symptom ?? entry.symptom, bugExplanation: pt?.bugExplanation ?? entry.bugExplanation }
}

// The pool entry a saved puzzle came from (matched by its code), or null for an AI puzzle.
export const poolEntryFor = (brokenCode) => POOL.find((entry) => entry.brokenCode.trim() === String(brokenCode ?? '').trim()) ?? null

const DAY_MS = 24 * 3_600_000

// The same slot always gets the same puzzle, so everyone sees one set even when two requests
// fill the day at once. Dailies rotate by day, the global by week (its day is a Monday).
export function pickFromPool({ kind, day, difficulty }) {
  const choices = POOL.filter((entry) => entry.kind === kind && (kind === 'global' || entry.difficulty === difficulty))
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS)
  const entry = choices[(kind === 'global' ? Math.floor(days / 7) : days) % choices.length]
  const { language, concept, title, brokenCode, symptom, hints, solution, bugExplanation } = entry
  return {
    puzzle: { kind, day, difficulty, language, concept, title, brokenCode, symptom, hints: [...hints] },
    secret: { solution, bugExplanation },
  }
}
