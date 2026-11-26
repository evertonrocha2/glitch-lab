// Glitch World: the study XP buff in the game HUD. Hunting gives XP; today's correct answers multiply
// it (1 + 0.1 each, up to x3).
const en = {
  'gameXp.chip': 'XP x{mult}',
  'gameXp.active': {
    one: 'Study buff: hunt XP x{mult}, from {count} correct answer today. Each one adds 0.1, up to x3.',
    other: 'Study buff: hunt XP x{mult}, from {count} correct answers today. Each one adds 0.1, up to x3.',
  },
  'gameXp.max': 'Study buff at its max: hunt XP x{mult}, from {count} correct answers today.',
  'gameXp.none': 'Study buff: hunt XP x{mult}. Study to raise it: each correct answer today adds 0.1, up to x3.',
}

const pt = {
  'gameXp.chip': 'XP x{mult}',
  'gameXp.active': {
    one: 'Bônus de estudo: XP da caça x{mult}, por {count} acerto hoje. Cada um soma 0,1, até x3.',
    other: 'Bônus de estudo: XP da caça x{mult}, por {count} acertos hoje. Cada um soma 0,1, até x3.',
  },
  'gameXp.max': 'Bônus de estudo no máximo: XP da caça x{mult}, por {count} acertos hoje.',
  'gameXp.none': 'Bônus de estudo: XP da caça x{mult}. Estude pra subir: cada acerto hoje soma 0,1, até x3.',
}

export default { en, 'pt-BR': pt }
