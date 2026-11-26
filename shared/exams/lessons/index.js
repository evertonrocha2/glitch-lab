// Every ENEM lesson, keyed by topic id. One file per topic (see validate.js for the shape), all
// imported here. The app loads this module lazily, so the lessons stay out of the main bundle.

export const LESSONS = Object.fromEntries([].map((lesson) => [lesson.topic, lesson]))

// The lesson for a topic, or null when it has none yet.
export const lessonFor = (topicId) => (Object.hasOwn(LESSONS, topicId) ? LESSONS[topicId] : null)
