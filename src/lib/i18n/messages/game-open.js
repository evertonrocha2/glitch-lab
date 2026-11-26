// Glitch World open zones: every zone and difficulty can be entered from the start. These strings say
// how dangerous a place is for the hero (advice, never a lock).
const en = {
  'gameOpen.hud.suggested': '{difficulty}, suggested from level {level}',
  'gameOpen.zone.level': 'Suggested level {level}',
  'gameOpen.danger.label': 'Danger: {danger}',
  'gameOpen.danger.safe': 'Safe',
  'gameOpen.danger.risky': 'Risky',
  'gameOpen.danger.deadly': 'Deadly',
  'gameOpen.under': 'Your power {power} is below the suggested. You can go in, but expect to fall.',
  'gameOpen.diff.warn': '{difficulty}: enemies {mult}x stronger than on Normal. Suggested from level {level}.',
  'gameOpen.diff.below': 'Your hero is level {level}: a weak hero falls fast here.',
}

const pt = {
  'gameOpen.hud.suggested': '{difficulty}, sugerido a partir do nível {level}',
  'gameOpen.zone.level': 'Nível sugerido {level}',
  'gameOpen.danger.label': 'Perigo: {danger}',
  'gameOpen.danger.safe': 'Tranquila',
  'gameOpen.danger.risky': 'Arriscada',
  'gameOpen.danger.deadly': 'Mortal',
  'gameOpen.under': 'Seu poder {power} está abaixo do sugerido. Dá pra entrar, mas espere cair.',
  'gameOpen.diff.warn': '{difficulty}: inimigos {mult}x mais fortes que no Normal. Sugerido a partir do nível {level}.',
  'gameOpen.diff.below': 'Seu herói está no nível {level}: herói fraco cai rápido aqui.',
}

export default { en, 'pt-BR': pt }
