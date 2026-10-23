// @vitest-environment node
import { expect, it } from 'vitest'
import { notificationText } from '../components/community/notification-bell/notification-bell.jsx'
import { translate } from './i18n/I18nProvider.jsx'
import { MESSAGES } from './i18n/catalog.js'
import { translateServerMessage } from './i18n/serverMessages.js'

const pt = (message) => translateServerMessage(message, 'pt-BR')

it('translates the messaging and community errors, with their numbers', () => {
  expect(pt('Too long. Keep your message under 2001 characters.')).toBe('Muito longo. Deixe sua mensagem com menos de 2001 caracteres.')
  expect(pt('You can send 20 messages a minute. Wait a moment.')).toBe('Você pode mandar 20 mensagens por minuto. Espere um pouco.')
  expect(pt('You can send 500 messages a day. Come back tomorrow.')).toBe('Você pode mandar 500 mensagens por dia. Volte amanhã.')
  expect(pt("This person isn't taking messages right now.")).toBe('Esta pessoa não está recebendo mensagens agora.')
  expect(pt('Name the community with 3 to 40 characters.')).toBe('Dê um nome à comunidade com 3 a 40 caracteres.')
  expect(pt('Too long. Keep the description under 301 characters.')).toBe('Muito longo. Deixe a descrição com menos de 301 caracteres.')
  expect(pt('You can create up to 3 communities.')).toBe('Você pode criar até 3 comunidades.')
  expect(pt('Sign up to send messages.')).toBe('Crie uma conta para mandar mensagens.')
})

it('has every chat string in both languages, and no em dashes', () => {
  const keys = Object.keys(MESSAGES.en).filter((key) => key.startsWith('chat.'))
  expect(keys.length).toBeGreaterThan(100)
  for (const key of keys) {
    expect(MESSAGES['pt-BR'][key], key).toBeDefined()
    expect(JSON.stringify([MESSAGES.en[key], MESSAGES['pt-BR'][key]]), key).not.toContain('—')
  }
})

it('writes the bell line for a new message in the reader language', () => {
  const item = { type: 'message', actor: { name: 'Bo' } }
  expect(notificationText(item)).toBe('Bo sent you a message')
  expect(notificationText(item, (key, vars) => translate('pt-BR', key, vars))).toBe('Bo mandou uma mensagem para você')
})
