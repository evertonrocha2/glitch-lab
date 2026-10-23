// Every badge, in the order the progress page shows them. `earned` reads the stats from computeProgress.
export const BADGES = [
  { id: 'first-clue', name: 'First clue', how: 'Investigate your first error.', earned: (s) => s.cases >= 1 },
  { id: 'fixed-it', name: 'Fixed it', how: 'Pass your first gym challenge.', earned: (s) => s.passes >= 1 },
  { id: 'case-closed', name: 'Case closed', how: 'Solve a case.', earned: (s) => s.solved >= 1 },
  { id: 'sharp-eye', name: 'Sharp eye', how: 'Pass a challenge without any hints.', earned: (s) => s.cleanPasses >= 1 },
  { id: 'polyglot', name: 'Polyglot', how: 'Investigate errors in 3 languages.', earned: (s) => s.languages >= 3 },
  { id: 'bug-hunter', name: 'Bug hunter', how: 'Solve 5 cases.', earned: (s) => s.solved >= 5 },
  { id: 'collector', name: 'Collector', how: 'Have 10 cases on your board.', earned: (s) => s.cases >= 10 },
  { id: 'note-taker', name: 'Note taker', how: 'Write a note that mentions a case.', earned: (s) => s.linkedNotes >= 1 },
  { id: 'deep-focus', name: 'Deep focus', how: 'Study 25 minutes in one day.', earned: (s) => s.bestDaySeconds >= 25 * 60 },
  { id: 'on-a-roll', name: 'On a roll', how: 'Study 3 days in a row.', earned: (s) => s.longestStreak >= 3 },
  { id: 'unstoppable', name: 'Unstoppable', how: 'Study 7 days in a row.', earned: (s) => s.longestStreak >= 7 },
  { id: 'marathon', name: 'Marathon', how: 'Study 5 hours in total.', earned: (s) => s.totalSeconds >= 5 * 3600 },
  { id: 'trailblazer', name: 'Trailblazer', how: 'Finish every mission on a study trail.', earned: (s) => s.trailsDone >= 1 },
  { id: 'daily-grinder', name: 'Daily grinder', how: 'Solve a daily challenge 7 days in a row.', earned: (s) => s.dailyLongestStreak >= 7 },
  { id: 'global-ace', name: 'Global ace', how: 'Solve a weekly global challenge.', earned: (s) => s.globalSolved >= 1 },
  { id: 'lingo-master', name: 'Lingo master', how: 'Solve all three Glitchdle modes in one day.', earned: (s) => s.riddlePerfectDays >= 1 },
  { id: 'author', name: 'Author', how: 'Publish a community article.', earned: (s) => s.articles >= 1 },
  { id: 'trusted', name: 'Trusted', how: 'Get 5 valid ratings on your articles.', earned: (s) => s.validReceived >= 5 },
  { id: 'duelist', name: 'Duelist', how: 'Win a duel against a person.', earned: (s) => s.duelHumanWins >= 1 },
  { id: 'speed-demon', name: 'Speed demon', how: 'Answer a duel round right in under 2 seconds.', earned: (s) => s.duelFastestMs != null && s.duelFastestMs < 2000 },
]

export const badgeById = (id) => BADGES.find((badge) => badge.id === id)
