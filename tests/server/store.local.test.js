// @vitest-environment node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { createLocalStore } from '../../server/infra/database/local/index.js'
import { CASE, storeContract } from './store-contract.js'

const tempFile = async () => join(await mkdtemp(join(tmpdir(), 'gd-store-')), 'db.json')

storeContract('local', async () => createLocalStore({ file: await tempFile() }))

it('keeps both writes when two requests hit a fresh store at once', async () => {
  const file = await tempFile()
  const store = createLocalStore({ file })
  await Promise.all([store.createCase('alice', CASE), store.createCase('alice', CASE)])
  expect(await createLocalStore({ file }).listCases('alice')).toHaveLength(2)
})

it('keeps data after a restart', async () => {
  const file = await tempFile()
  const created = await createLocalStore({ file }).createCase('alice', CASE)
  expect(await createLocalStore({ file }).getCase('alice', created.id)).toEqual(created)
})
