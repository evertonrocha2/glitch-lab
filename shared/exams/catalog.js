import { ENEM } from './enem.js'

// Every exam the app knows: exam -> area -> topic. Questions live in the database; this shape lives
// in code so it's reviewed like code. A new exam (ESA...) is one more file and one more entry here.
export const EXAMS = { enem: ENEM }

// What a student can pick to study. A track may have an exam (and so an exam date) or not.
export const TRACKS = [
  { id: 'enem', exam: 'enem' },
  { id: 'programming', exam: null },
]

const own = (object, key) => (Object.hasOwn(object, key) ? object[key] : null)

export const examById = (id) => own(EXAMS, id)

export const trackById = (id) => TRACKS.find((track) => track.id === id) ?? null

export function topicById(examId, topicId) {
  const exam = examById(examId)
  for (const area of exam?.areas ?? []) {
    const topic = area.topics.find((item) => item.id === topicId)
    if (topic) return { ...topic, area: area.id }
  }
  return null
}

export const topicsOfArea = (examId, areaId) => examById(examId)?.areas.find((area) => area.id === areaId)?.topics ?? []
