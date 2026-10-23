import { queryText } from '../../core/validation.js'
import * as hunt from './hunt.service.js'

export async function today(req, res) {
  res.json(await hunt.getHunt(req.deps.store, req.user, req.locale))
}

// start, answers and next all answer with the run's new state (an answer also carries { result }).
export const action = (name) =>
  async function huntAction(req, res) {
    res.json(await hunt.huntAction(req.deps.store, req.user, name, req.body, req.locale))
  }

export async function practice(req, res) {
  res.json(await hunt.practiceSnippet(req.deps.store, queryText(req, 'after'), req.locale))
}

export async function practiceAnswer(req, res) {
  res.json(await hunt.practiceAnswer(req.deps.store, req.body, req.locale))
}
