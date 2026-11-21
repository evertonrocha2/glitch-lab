import { ENEM } from '../exams/enem.js'
import { topicById } from '../exams/catalog.js'
import { HUNT_ROUNDS } from '../hunt/game.js'

// What Glitch World's unlocks read, worked out from what the student already did in the Lab:
// { enemCorrect: { [ENEM area]: right first answers }, codeSolved: programming things solved }.
// The inputs are the ones getProgress loads:
// - examSummary: [{ topic, answered, correct }] (store.summarizeExamAttempts(userId, 'enem')), first
//   answers only. A topic that left the catalog counts for no area.
// - challenges: store.listChallenges. A pass with a puzzleId is a daily or global puzzle, counted
//   once through `daily` instead.
// - daily: { solved } (server/modules/daily/solved.js), riddle: { results } (glitchdle/solved.js),
//   hunt: { runs } (hunt/solved.js).
export function worldSignals({ examSummary, challenges, daily, riddle, hunt }) {
  const enemCorrect = Object.fromEntries(ENEM.areas.map((area) => [area.id, 0]))
  for (const { topic, correct } of examSummary) {
    const area = topicById('enem', topic)?.area
    if (area) enemCorrect[area] += correct
  }
  const gymPasses = challenges.filter((item) => item.status === 'passed' && !item.puzzleId).length
  const glitchdleDays = new Set(riddle.results.filter((result) => result.solved).map((result) => result.day)).size
  const huntsFinished = hunt.runs.filter((run) => run.answered >= HUNT_ROUNDS).length
  return { enemCorrect, codeSolved: gymPasses + daily.solved.length + glitchdleDays + huntsFinished }
}
