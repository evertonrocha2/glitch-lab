import { expect, it } from 'vitest'
import { MESSAGES } from '../../../server/modules/game/game.model.js'
import { translateServerMessage } from './serverMessages.js'

it('translates every Glitch World hero error the server sends', () => {
  for (const message of Object.values(MESSAGES)) {
    const translated = translateServerMessage(message, 'pt-BR')
    expect(translated, message).not.toBe(message)
    expect(translateServerMessage(message, 'en')).toBe(message)
  }
})
