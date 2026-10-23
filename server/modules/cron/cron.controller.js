import { AppError } from '../../core/errors.js'
import { cronAllowed, runDaily } from './cron.service.js'

// Signed with CRON_SECRET instead of a session (see requireCronSecret in cron.routes.js).
export function requireCronSecret(req, _res, next) {
  next(cronAllowed(req.get('authorization')) ? undefined : new AppError(401, 'Not allowed.'))
}

export async function daily(req, res) {
  res.json(await runDaily(req.deps.store))
}
