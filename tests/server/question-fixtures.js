// A board card as the tutor proposes it, after parseCard. Not a test file: suites import it.
export const CARD = {
  concept: 'off-by-one',
  topic: 'range end',
  language: 'python',
  title: 'range stops before its end',
  summary: 'range(n) gives 0 up to n - 1.',
  explanation: 'The end of a range is never included, so range(len(xs) - 1) skips the last index.',
  exercise: { prompt: 'Print every item of xs = [1, 2, 3].', answer: 'for i in range(len(xs)): print(xs[i]), since the end is left out.' },
  recap: 'Asked why the loop skips the last item.',
}
