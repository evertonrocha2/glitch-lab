// The pages of lazy-pages.js, imported up front. The test config swaps this in, so a test sees a
// page on its first render, as before the code split.
const modules = import.meta.glob(['../pages/*/*-page.jsx', '!../pages/landing-page/*', '!../pages/login-page/*'], { eager: true })

const nameOf = (path) =>
  path
    .split('/')
    .at(-1)
    .replace('.jsx', '')
    .replace(/(^|-)(\w)/g, (_, __, letter) => letter.toUpperCase())

export const pages = Object.fromEntries(Object.entries(modules).map(([path, module]) => [nameOf(path), module.default]))

export function preloadPages() {}
