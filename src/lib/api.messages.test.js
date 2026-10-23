// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GUARD_TEXT, LOCKED_MESSAGE } from '../../server/infra/ai/guard/messages.js'
import { credentialsProblem } from '../../server/modules/auth/credentials.js'
import { validateInput } from '../../server/modules/cases/analysis.js'
import { parseAssistantRequest } from '../../server/modules/assistant/request.js'
import { parseNote } from '../../server/modules/notes/notes.model.js'
import { parseProfile } from '../../server/modules/profile/profile.model.js'
import { AuthError, listCases, getPublicProfile, listPublicNotes } from './api.js'
import { translateServerMessage } from './i18n/serverMessages.js'

// The reader's language as the API client sees it (the provider sets it in the app).
const reader = vi.hoisted(() => ({ locale: 'en' }))
vi.mock('./i18n/I18nProvider.jsx', async (original) => ({ ...(await original()), currentLocale: () => reader.locale }))

const pt = (message) => translateServerMessage(message, 'pt-BR')
const usePortuguese = () => {
  reader.locale = 'pt-BR'
}
const useEnglish = () => {
  reader.locale = 'en'
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  useEnglish()
})

it('translates exact server messages and leaves English alone', () => {
  expect(pt('Daily limit reached. Come back tomorrow.')).toBe('Limite diário atingido. Volte amanhã.')
  expect(pt('Wrong email or password.')).toBe('E-mail ou senha incorretos.')
  expect(pt("This challenge is over. Try today's set.")).toBe('Este desafio acabou. Tente os de hoje.')
  expect(translateServerMessage('Daily limit reached. Come back tomorrow.', 'en')).toBe('Daily limit reached. Come back tomorrow.')
})

it('translates messages with numbers in them', () => {
  expect(pt('Too long. Keep the error under 2000 characters and the code under 6000.')).toBe(
    'Muito longo. Deixe o erro com menos de 2000 caracteres e o código com menos de 6000.',
  )
  expect(pt('You can publish 3 articles a day. Come back tomorrow.')).toBe('Você pode publicar 3 artigos por dia. Volte amanhã.')
  expect(pt('Use a password with at least 8 characters.')).toBe('Use uma senha com pelo menos 8 caracteres.')
})

it('translates the words and the inner problem of a composed message', () => {
  expect(pt('Too long. Keep your bio under 161 characters.')).toBe('Muito longo. Deixe sua bio com menos de 161 caracteres.')
  expect(pt("That handle won't work. Use at least 3 characters.")).toBe('Esse nome de usuário não serve. Use pelo menos 3 caracteres.')
  expect(pt("That GitHub link won't work. Use a github.com link.")).toBe('Esse link do GitHub não serve. Use um link do github.com.')
  expect(pt("That Website link won't work. Use a full https:// link.")).toBe('Esse link do site não serve. Use um link completo, com https://.')
})

it('gives back anything it does not know, unchanged', () => {
  expect(pt('Some brand new server message.')).toBe('Some brand new server message.')
  expect(pt('')).toBe('')
  expect(pt(undefined)).toBe(undefined)
})

// Every literal message in server/ (AppError and its helpers, { message: ... }, default messages and
// the message constants) has a translation.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.js') ? [path] : []
  })
}

it('knows every fixed message the API can send', () => {
  const root = join(import.meta.dirname, '../../server')
  const literal =
    /(?:new AppError\(\d+,\s*|\b(?:badRequest|unauthorized|forbidden|notFound|conflict|tooLarge|tooMany)\(|message:\s*|message = |const (?:NOT_FOUND|NOT_SHARED|NOTE_NOT_FOUND|DEMO_SHARE|WRONG|NO_CASES|TOO_LONG|ALREADY_IN|INVALID_REQUEST)\s*=\s*)(['"])((?:(?!\1).)+)\1/g
  const found = new Set()
  for (const file of sourceFiles(root)) {
    for (const match of readFileSync(file, 'utf8').matchAll(literal)) found.add(match[2])
  }
  expect(found.size).toBeGreaterThan(40)
  const untranslated = [...found].filter((message) => pt(message) === message)
  expect(untranslated).toEqual([])
})

it('knows the messages the API builds from limits and checks', () => {
  const messages = [
    validateInput({ error: '' }).message,
    validateInput({ error: 'x'.repeat(5000) }).message,
    validateInput({ error: 'E', context: 'x'.repeat(400) }).message,
    validateInput({ error: 'E', files: Array.from({ length: 9 }, (_, i) => ({ path: `f${i}`, content: 'x' })) }).message,
    validateInput({ error: 'E', files: [{ path: 'a', content: 'x'.repeat(7000) }] }).message,
    validateInput({ error: 'E', files: [1, 2, 3].map((i) => ({ path: `f${i}`, content: 'x'.repeat(5500) })) }).message,
    credentialsProblem({ email: 'nope', password: 'x' }),
    credentialsProblem({ email: 'ada@example.com', password: 'x' }),
    parseAssistantRequest({ messages: [{ role: 'user', content: 'x'.repeat(5000) }] }).message,
    parseNote({ title: 'x'.repeat(500) }).message,
    parseNote({ blocks: Array.from({ length: 500 }, () => ({ type: 'text', text: '' })) }).message,
    parseNote({ blocks: [{ type: 'text', text: 'x'.repeat(5000) }] }).message,
    parseNote({ blocks: [{ type: 'mystery' }] }).message,
    parseProfile({ handle: 'a' }).message,
    parseProfile({ handle: 'a'.repeat(40) }).message,
    parseProfile({ handle: 'Bad Handle!' }).message,
    parseProfile({ displayName: 'x'.repeat(100) }).message,
    parseProfile({ bio: 'x'.repeat(500) }).message,
    parseProfile({ work: 'x'.repeat(500) }).message,
    parseProfile({ featuredBadges: ['first-clue', 'fixed-it', 'case-closed', 'sharp-eye'] }).message,
    parseProfile({ links: { github: 'https://example.com/ada' } }).message,
    parseProfile({ links: { website: 'ftp://example.com' } }).message,
    parseProfile({ links: { website: `https://example.com/${'x'.repeat(400)}` } }).message,
  ]
  for (const message of messages) {
    expect(typeof message).toBe('string')
    expect(pt(message), message).not.toBe(message)
  }
})

// The guard writes its refusals in the reader's language on the server (they show as answers) and
// sends English in AppErrors (a new investigation it won't take, the lockout): both must read the same.
it("knows the AI guard's messages, in the same words the server uses", () => {
  for (const text of Object.values(GUARD_TEXT)) expect(pt(text.en)).toBe(text['pt-BR'])
  expect(pt(LOCKED_MESSAGE)).toBe('Muitas tentativas bloqueadas hoje. As funções de IA ficam pausadas na sua conta até amanhã.')
})

it('throws Portuguese errors from the API client when the reader picked Portuguese', async () => {
  usePortuguese()
  fetch.mockResolvedValueOnce(Response.json({ message: 'Daily limit reached. Come back tomorrow.' }, { status: 429 }))
  await expect(listCases('t')).rejects.toThrow('Limite diário atingido. Volte amanhã.')

  fetch.mockResolvedValueOnce(Response.json({ message: 'Sign in to continue.' }, { status: 401 }))
  const auth = listCases('t')
  await expect(auth).rejects.toBeInstanceOf(AuthError)
  await expect(auth).rejects.toThrow('Entre para continuar.')

  fetch.mockResolvedValueOnce(new Response('oops', { status: 500 }))
  await expect(listCases('t')).rejects.toThrow('Algo deu errado. Tente de novo.')

  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(listCases('t')).rejects.toThrow('Não foi possível falar com o servidor. Confira sua conexão.')

  fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await expect(getPublicProfile('ada', '2026-10-22')).rejects.toThrow('Não foi possível falar com o servidor. Confira sua conexão.')

  fetch.mockResolvedValueOnce(Response.json({ message: 'Invalid request.' }, { status: 400 }))
  await expect(listPublicNotes('ada')).rejects.toThrow('Pedido inválido.')
})

it('keeps the English messages for an English reader', async () => {
  fetch.mockResolvedValueOnce(Response.json({ message: 'Daily limit reached. Come back tomorrow.' }, { status: 429 }))
  await expect(listCases('t')).rejects.toThrow('Daily limit reached. Come back tomorrow.')
  fetch.mockResolvedValueOnce(new Response('oops', { status: 500 }))
  await expect(listCases('t')).rejects.toThrow('Something went wrong. Please try again.')
})
