import { useEffect, useState } from 'react'
import { fold } from './blocks.js'

const RECENT_KEY = 'gd:emoji-recent'
const RECENT_MAX = 16

// The list loads once, on first need, as its own small chunk.
let loading = null
export const loadEmojis = () => {
  loading ??= import('./emoji-data.js')
  return loading
}

// { emojis, categories } once loaded (null before). Only starts loading when `enabled`.
export function useEmojis(enabled = true) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    loadEmojis().then((module) => alive && setData({ emojis: module.EMOJIS, categories: module.EMOJI_CATEGORIES }))
    return () => {
      alive = false
    }
  }, [enabled])
  return data
}

// Emojis whose words (English or Portuguese, accents ignored) start with the query; a word that
// only contains it comes after. "fogo" and "fire" both find 🔥.
export function searchEmojis(emojis, query) {
  const needle = fold(query)
  if (!needle) return emojis
  const starts = []
  const contains = []
  for (const emoji of emojis) {
    if (emoji.words.some((word) => word.startsWith(needle))) starts.push(emoji)
    else if (emoji.words.some((word) => word.includes(needle))) contains.push(emoji)
  }
  return [...starts, ...contains]
}

// Recently used emojis live in this browser only. Storage can be off (private mode, blocked
// cookies), so every read and write is guarded and the picker works without it.
export function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

export function rememberEmoji(char) {
  const next = [char, ...readRecent().filter((item) => item !== char)].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Not saved: the picker just won't remember it.
  }
  return next
}
