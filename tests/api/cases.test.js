// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GET } from '../../api/cases.js'
import { apiRequest, useTempStore } from './helpers.js'
import { CASE } from './store-contract.js'

let store

beforeEach(async () => {
  store = await useTempStore()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

it('lists only my cases', async () => {
  const mine = await store.createCase('bob', CASE)
  await store.createCase('alice', CASE)
  const res = await GET(apiRequest('/api/cases', { method: 'GET', token: 'dev:bob' }))
  expect(res.status).toBe(200)
  expect((await res.json()).cases.map((item) => item.id)).toEqual([mine.id])
})

it('asks for sign in without a user', async () => {
  const res = await GET(apiRequest('/api/cases', { method: 'GET', token: null }))
  expect(res.status).toBe(401)
})
