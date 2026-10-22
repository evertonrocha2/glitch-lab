// What each specialist knows about, and the pieces of data it may ask for.
// The router picks from these; the context loaders only ever load these keys.
export const AGENTS = {
  board: {
    about: "the student's cases on the board: bug types, the weak spot, why an error happened",
    needs: ['case_list', 'current_case'],
  },
  gym: {
    about: "the student's gym challenges: symptom, hints already revealed, attempts, status",
    needs: ['challenge_list', 'current_challenge'],
  },
  notes: {
    about: "the student's notes: summaries, what they wrote, what to write next",
    needs: ['note_list', 'current_note'],
  },
  study: {
    about: 'XP, level, streak, study time, badges, and planning the next study session',
    needs: ['progress', 'study_plan'],
  },
  guide: {
    about: 'how to use Glitch Detective: features, pages, buttons, shortcuts, export',
    needs: ['app_guide'],
  },
}

export const DATA_NEEDS = Object.fromEntries(Object.entries(AGENTS).map(([name, agent]) => [name, agent.needs]))
export const ALL_NEEDS = Object.values(DATA_NEEDS).flat()
