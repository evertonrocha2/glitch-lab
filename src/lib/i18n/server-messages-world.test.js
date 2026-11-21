import { expect, it } from 'vitest'
import { MESSAGES } from '../../../server/modules/world/world.model.js'
import { translateServerMessage } from './serverMessages.js'

it("translates every Glitch World error the server sends", () => {
  for (const message of Object.values(MESSAGES)) {
    const translated = translateServerMessage(message, 'pt-BR')
    expect(translated, message).not.toBe(message)
    expect(translateServerMessage(message, 'en')).toBe(message)
  }
})
