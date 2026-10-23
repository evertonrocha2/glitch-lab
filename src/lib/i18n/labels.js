import { badgeById } from '../../../shared/badges.js'
import { conceptLabel } from '../../../shared/concepts.js'
import { LEVELS } from '../../../shared/progress.js'
import { valueLabel } from '../../../shared/riddle/categories.js'
import { LABELS } from '../../../shared/riddle/languages.js'
import { kindLabel, TRAIL_KINDS } from '../../../shared/trails.js'
import { useT } from './I18nProvider.jsx'

// Names for shared data in the reader's language, falling back to the English the data carries.
// `t` comes from useT(); each helper returns the English label when no translation exists.
const or = (t, key, fallback) => {
  const text = t(key)
  return text === key ? fallback : text
}

export const conceptName = (t, id) => or(t, `concept.${id}`, conceptLabel(id))
export const badgeName = (t, id) => or(t, `badge.name.${id}`, badgeById(id)?.name ?? id)
export const badgeHow = (t, id) => or(t, `badge.how.${id}`, badgeById(id)?.how ?? '')
// level is 1-based, like progress.level.
export const levelTitle = (t, level) => or(t, `level.${level}`, LEVELS[level - 1]?.title ?? '')
export const trailKindName = (t, kind) => or(t, `trail.kind.${kind}`, kindLabel(kind))
export const trailKindHow = (t, kind) => or(t, `trail.how.${kind}`, TRAIL_KINDS.find((item) => item.id === kind)?.how ?? '')
export const statusName = (t, status) => or(t, `status.${status}`, status)
export const difficultyName = (t, difficulty) => or(t, `difficulty.${difficulty}`, difficulty)
export const traitName = (t, value) => or(t, `trait.${value}`, LABELS[value] ?? value)
export const glitchdleModeName = (t, mode) => or(t, `glitchdle.mode.${mode}`, mode)
// A framework or database trait value; language names stay as they are in every language.
export const categoryValueName = (t, category, value) => or(t, `glitchdle.value.${category}.${value}`, valueLabel(category, value))

// All of the above, bound to the current language.
export function useLabels() {
  const t = useT()
  return {
    concept: (id) => conceptName(t, id),
    badgeName: (id) => badgeName(t, id),
    badgeHow: (id) => badgeHow(t, id),
    level: (level) => levelTitle(t, level),
    trailKind: (kind) => trailKindName(t, kind),
    trailHow: (kind) => trailKindHow(t, kind),
    status: (status) => statusName(t, status),
    difficulty: (difficulty) => difficultyName(t, difficulty),
    trait: (value) => traitName(t, value),
    glitchdleMode: (mode) => glitchdleModeName(t, mode),
    categoryValue: (category, value) => categoryValueName(t, category, value),
  }
}
