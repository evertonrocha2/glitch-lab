import { ENEM } from '../../../shared/exams/enem.js'

// The words for a Glitch World lock ({ requirement, have, need }, from shared/world/unlocks.js).

const areaName = (id) => ENEM.areas.find((area) => area.id === id)?.shortName ?? id
const areaOf = (requirement) => (requirement.area ? areaName(requirement.area) : '')

// "12 de 15 acertos em Matemática"
export const progressText = (t, { requirement, have, need }) => t(`world.need.${requirement.signal}`, { have, need, area: areaOf(requirement) })

// "faltam 3 desafios de programação"
export const leftText = (t, { requirement, have, need }) => t(`world.left.${requirement.signal}`, { count: need - have, area: areaOf(requirement) })

// Where to go to open a lock: ENEM practice for right answers, the daily puzzle for programming.
export const studyHref = (requirement) => (requirement.signal === 'enemCorrect' ? '/exams/enem' : '/daily')
