import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/app.jsx'
import './index.css'
import { watchForNewBuild } from './lib/stale-build.js'

watchForNewBuild()

// Dev only (left out of the build): Ctrl+Shift+F shows an FPS and long-task meter.
if (import.meta.env.DEV) import('./lib/dev/fps-meter.js').then(({ installFpsMeter }) => installFpsMeter())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
