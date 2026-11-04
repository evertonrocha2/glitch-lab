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

const iso = (value) => (value == null ? null : new Date(value).toISOString())

const toAttempt = (row) => ({ id: row.id, questionId: row.question_id, choice: row.choice, correct: row.correct, createdAt: iso(row.created_at) })

const toTrack = (row) => row && { id: row.track, examDate: row.exam_date ?? null, createdAt: iso(row.created_at) }

// Exam questions, answers and tracks on Supabase (exam_questions, question_attempts, user_tracks).
// Spread into createSupabaseStore.
export function createSupabaseExams(db) {
  const questions = () => db.from('exam_questions')
  const attempts = () => db.from('question_attempts')
  const tracks = () => db.from('user_tracks')
  const visible = (query) => query.not('topic', 'is', null).eq('needs_review', false)

  return {
    async createQuestionAttempt(userId, { questionId, choice, correct }) {
      return toAttempt(unwrap(await attempts().insert({ user_id: userId, question_id: questionId, choice, correct }).select().single()))
    },

    async listFirstAttempts(userId, questionIds) {
      if (!questionIds.length) return []
      const rows =
        unwrap(await attempts().select('*').eq('user_id', userId).in('question_id', questionIds).order('created_at', { ascending: true })) ?? []
      const first = new Map()
      for (const row of rows) if (!first.has(row.question_id)) first.set(row.question_id, toAttempt(row))
      return questionIds.filter((id) => first.has(id)).map((id) => first.get(id))
    },

    async summarizeExamAttempts(userId, exam) {
      const rows = unwrap(await db.rpc('exam_attempt_summary', { p_user: userId, p_exam: exam })) ?? []
      return rows.map((row) => ({ topic: row.topic, answered: Number(row.answered), correct: Number(row.correct) }))
    },

    async listUserTracks(userId) {
      const rows = unwrap(await tracks().select('*').eq('user_id', userId).order('created_at', { ascending: true })) ?? []
      return rows.map(toTrack)
    },

    // The primary key (user_id, track) makes this one upsert; created_at keeps its first value.
    async upsertUserTrack(userId, trackId, { examDate }) {
      return toTrack(unwrap(await tracks().upsert({ user_id: userId, track: trackId, exam_date: examDate }, { onConflict: 'user_id,track' }).select().single()))
    },

    async deleteUserTrack(userId, trackId) {
      const rows = unwrap(await tracks().delete().eq('user_id', userId).eq('track', trackId).select('track'))
      return (rows ?? []).length > 0
    },

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
