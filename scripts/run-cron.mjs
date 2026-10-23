// The daily cron (Render cron job): wakes the API, then asks it to write today's and tomorrow's
// content. Exits non-zero on failure so Render marks the run as failed.
const base = (process.env.APP_URL ?? '').replace(/\/+$/, '')
const secret = process.env.CRON_SECRET
if (!base || !secret) {
  console.error('APP_URL and CRON_SECRET must be set')
  process.exit(1)
}

// A free web service sleeps when idle and can take a minute to wake.
for (let attempt = 1; ; attempt++) {
  const awake = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(90_000) }).then((res) => res.ok, () => false)
  if (awake) break
  if (attempt === 5) {
    console.error('The API did not wake up')
    process.exit(1)
  }
  await new Promise((done) => setTimeout(done, 15_000))
}

const res = await fetch(`${base}/api/challenge?cron=1`, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(600_000) })
const body = await res.text()
console.log(res.status, body.slice(0, 2000))
if (!res.ok) process.exit(1)
