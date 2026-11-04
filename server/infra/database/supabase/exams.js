// Postgres "invalid input syntax for type uuid": a malformed id simply matches nothing.
const INVALID_UUID = '22P02'
// PostgREST caps an .in() list by URL length: look sourceKeys up a slice at a time.
const LOOKUP_SLICE = 100

function unwrap({ data, error }) {
  if (error?.code === INVALID_UUID) return null
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data
}

const toQuestion = (row) =>
  row && {
    id: row.id,
    exam: row.exam,
    year: row.year,
    number: row.number,
    area: row.area,
    language: row.language ?? null,
    topic: row.topic ?? null,
    context: row.context,
    statement: row.statement,
    alternatives: row.alternatives,
    answer: row.answer,
    needsReview: row.needs_review,
    sourceKey: row.source_key,
  }

const toRow = (question) => ({
  exam: question.exam,
  year: question.year,
  number: question.number,
  area: question.area,
  language: question.language,
  topic: question.topic,
  context: question.context,
  statement: question.statement,
  alternatives: question.alternatives,
  answer: question.answer,
  needs_review: question.needsReview,
  source_key: question.sourceKey,
})

// Exam questions on Supabase (exam_questions). Spread into createSupabaseStore.
export function createSupabaseExams(db) {
  const questions = () => db.from('exam_questions')
  const visible = (query) => query.not('topic', 'is', null).eq('needs_review', false)

  return {
    // An upsert on source_key would write topic: null over a saved topic, so new rows are inserted
    // and known ones updated without their topic when the import sent none.
    async upsertExamQuestions(rows) {
      const known = new Set()
      for (let start = 0; start < rows.length; start += LOOKUP_SLICE) {
        const keys = rows.slice(start, start + LOOKUP_SLICE).map((row) => row.sourceKey)
        for (const row of unwrap(await questions().select('source_key').in('source_key', keys)) ?? []) known.add(row.source_key)
      }
      const fresh = rows.filter((row) => !known.has(row.sourceKey))
      if (fresh.length) unwrap(await questions().insert(fresh.map(toRow)))
      const stamp = new Date().toISOString()
      for (const row of rows.filter((item) => known.has(item.sourceKey))) {
        const { topic, ...patch } = toRow(row)
        unwrap(await questions().update({ ...patch, ...(topic ? { topic } : {}), updated_at: stamp }).eq('source_key', row.sourceKey))
      }
      return { inserted: fresh.length, updated: rows.length - fresh.length }
    },

    async listUntaggedExamQuestions(exam, limit) {
      const rows = unwrap(
        await questions()
          .select('*')
          .eq('exam', exam)
          .is('topic', null)
          .eq('needs_review', false)
          .order('year', { ascending: false })
          .order('number', { ascending: true })
          .limit(limit),
      )
      return (rows ?? []).map(toQuestion)
    },

    async setExamQuestionTopic(id, topic) {
      const rows = unwrap(await questions().update({ topic, updated_at: new Date().toISOString() }).eq('id', id).select('id'))
      return (rows ?? []).length > 0
    },

    // A few thousand rows at most per exam: counting the topic column here is cheap enough.
    async countExamQuestionsByTopic(exam) {
      const counts = {}
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const rows = unwrap(await visible(questions().select('topic').eq('exam', exam)).order('id').range(from, from + PAGE - 1)) ?? []
        for (const row of rows) counts[row.topic] = (counts[row.topic] ?? 0) + 1
        if (rows.length < PAGE) return counts
      }
    },

    async listExamQuestions(exam, topic, { offset, limit }) {
      const rows = unwrap(
        await visible(questions().select('*').eq('exam', exam).eq('topic', topic))
          .order('year', { ascending: false })
          .order('number', { ascending: true })
          .range(offset, offset + limit - 1),
      )
      return (rows ?? []).map(toQuestion)
    },

    async getExamQuestion(id) {
      return toQuestion(unwrap(await questions().select('*').eq('id', id).maybeSingle()))
    },
  }
}
