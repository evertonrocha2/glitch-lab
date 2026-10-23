import { ask } from './assistant.service.js'

export async function question(req, res) {
  res.json(await ask(req.deps, req.user, req.body, req.locale))
}
