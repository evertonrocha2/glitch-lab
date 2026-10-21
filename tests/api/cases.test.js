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

it('gives a fresh demo account its sample board', async () => {
  const res = await GET(apiRequest('/api/cases', { method: 'GET', token: 'dev:demo' }))
  const { cases } = await res.json()
  expect(cases.map((item) => item.status).sort()).toEqual(['new', 'new', 'solved', 'training'])
})

it('does not seed a normal account', async () => {
  const res = await GET(apiRequest('/api/cases', { method: 'GET', token: 'dev:carol' }))
  expect((await res.json()).cases).toEqual([])
})

it('asks for sign in without a user', async () => {
  const res = await GET(apiRequest('/api/cases', { method: 'GET', token: null }))
  expect(res.status).toBe(401)
})
