import * as cases from './cases.service.js'

export async function list(req, res) {
  res.json({ cases: await cases.listCases(req.deps.store, req.user, req.locale) })
}

export async function analyze(req, res) {
  res.status(201).json({ case: await cases.analyzeError(req.deps, req.user, req.body, req.locale) })
}
