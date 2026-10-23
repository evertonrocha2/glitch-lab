import * as interrogation from './interrogation.service.js'

export async function get(req, res) {
  res.json(await interrogation.getInterrogation(req.deps.store, req.user, req.params.caseId))
}

export async function answer(req, res) {
  res.json(await interrogation.answerInterrogation(req.deps, req.user, req.params.caseId, req.body, req.locale))
}
