// @vitest-environment node
import { expect, it } from 'vitest'
import { excerpt, findLocations, isCodePath, languageOfPath, matchFile, scanError } from '../../shared/errorScan.js'

it('reads a JavaScript stack trace', () => {
  const scan = scanError(`TypeError: Cannot read properties of undefined (reading 'length')
    at total (/home/ada/shop/src/cart.js:12:18)
    at Object.<anonymous> (/home/ada/shop/index.js:3:1)
    at Module._compile (node:internal/modules/cjs/loader:1256:14)`)
  expect(scan.type).toBe('TypeError')
  expect(scan.message).toBe("Cannot read properties of undefined (reading 'length')")
  expect(scan.language).toBe('javascript')
  expect(scan.locations).toEqual([
    { file: '/home/ada/shop/src/cart.js', line: 12, column: 18 },
    { file: '/home/ada/shop/index.js', line: 3, column: 1 },
  ])
})

it('reads a Python traceback, where the error comes last', () => {
  const scan = scanError(`Traceback (most recent call last):
  File "app/main.py", line 8, in <module>
    run()
  File "app/report.py", line 21, in run
    print(rows[3])
IndexError: list index out of range`)
  expect(scan).toMatchObject({ type: 'IndexError', message: 'list index out of range', language: 'python' })
  expect(scan.locations.map((spot) => `${spot.file}:${spot.line}`)).toEqual(['app/main.py:8', 'app/report.py:21'])
})

it('reads a Java exception', () => {
  const scan = scanError(`Exception in thread "main" java.lang.NullPointerException
\tat com.shop.Cart.total(Cart.java:42)`)
  expect(scan.type).toBe('java.lang.NullPointerException')
  expect(scan.language).toBe('java')
  expect(scan.locations).toEqual([{ file: 'Cart.java', line: 42 }])
})

it('guesses the language from the type alone', () => {
  expect(scanError('KeyError: email').language).toBe('python')
  expect(scanError('ReferenceError: x is not defined').language).toBe('javascript')
  expect(scanError('something odd happened').type).toBeNull()
  expect(scanError('   ')).toMatchObject({ type: null, locations: [] })
})

it('cleans URL and webpack paths', () => {
  expect(findLocations('at main (file:///C:/dev/app/main.ts:4:2)')).toEqual([{ file: 'C:/dev/app/main.ts', line: 4, column: 2 }])
  expect(findLocations('at x (webpack:///./src/App.jsx?abc:10:3)')).toEqual([{ file: 'src/App.jsx', line: 10, column: 3 }])
})

it('knows code files by extension', () => {
  expect(isCodePath('src/a.tsx')).toBe(true)
  expect(isCodePath('logo.png')).toBe(false)
  expect(languageOfPath('x/y.py')).toBe('python')
})

it('matches an uploaded file by the longest shared path ending', () => {
  const files = [{ path: 'shop/src/cart.js' }, { path: 'shop/test/cart.js' }, { path: 'shop/index.js' }]
  expect(matchFile(files, { file: '/home/ada/shop/src/cart.js' }).path).toBe('shop/src/cart.js')
  expect(matchFile(files, { file: 'index.js' }).path).toBe('shop/index.js')
  expect(matchFile(files, { file: 'other.py' })).toBeNull()
})

it('cuts a window of lines around the error and marks it', () => {
  const content = Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join('\n')
  const cut = excerpt(content, 50, 2)
  expect(cut).toBe(['   ... lines 1-47 not shown', '   48 | line 48', '   49 | line 49', '>> 50 | line 50', '   51 | line 51', '   52 | line 52', '   ... lines 53-100 not shown'].join('\n'))
})
