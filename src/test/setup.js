import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // Dev login and the landing draft live in browser storage; start every test signed out and empty.
  // (Server tests run in Node, where these don't exist.)
  globalThis.localStorage?.clear()
  globalThis.sessionStorage?.clear()
})
