import { localeOf } from '../locale.js'

// req.locale: 'pt-BR' or 'en', from the Accept-Language header the app sends with every call.
export function locale(req, _res, next) {
  req.locale = localeOf(req.get('accept-language'))
  next()
}
