import * as cases from './cases.service.js'

export async function list(req, res) {
  res.json({ cases: await cases.listCases(req.deps.store, req.user, req.locale) })
}

export async function analyze(req, res) {
  res.status(201).json({ case: await cases.analyzeError(req.deps, req.user, req.body, req.locale) })
}

// A board card from a doubt chat: 201 when it was made now, 200 for the same card sent again.
export async function fromQuestion(req, res) {
  const result = await cases.createFromQuestion(req.deps, req.user, req.body)
  res.status(result.created ? 201 : 200).json({ case: result.case })
}
