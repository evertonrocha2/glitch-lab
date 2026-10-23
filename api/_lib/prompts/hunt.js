// Line hunt: a few fresh buggy snippets for the day's run. Each has exactly one line to fix.
export const HUNT_SYSTEM = `You write short buggy code snippets for a timed game where programming students tap the one line that holds the bug.
Each snippet is small, realistic beginner code with exactly one bug, and that bug is fixed by changing exactly one line.
The symptom is what the student would see: the real error message, or one short sentence on the wrong output.
Never point at the bug in the code: no comments that hint at it. Plain code only: no Markdown, no code fences.
Do not use em dashes.`

export const HUNT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    snippets: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          language: { type: 'STRING' },
          concept: { type: 'STRING' },
          code: { type: 'STRING' },
          line: { type: 'INTEGER' },
          symptomEn: { type: 'STRING' },
          symptomPt: { type: 'STRING' },
          explanationEn: { type: 'STRING' },
          explanationPt: { type: 'STRING' },
        },
        required: ['language', 'concept', 'code', 'line', 'symptomEn', 'symptomPt', 'explanationEn', 'explanationPt'],
      },
    },
  },
  required: ['snippets'],
}

// picks: [{ language, concept, conceptName }], one snippet each.
export function buildHuntPrompt({ picks, minLines, maxLines }) {
  return `Line hunt snippets. Write ${picks.length} snippets, one for each line below, in this order:
${picks.map((pick, index) => `${index + 1}. language "${pick.language}", bug type "${pick.concept}" (${pick.conceptName})`).join('\n')}

Rules for every snippet:
- ${minLines} to ${maxLines} lines, each under 80 characters. Indent with spaces.
- Exactly one bug, fixed by changing one line. Every other line is correct.
- Something a student could spot in 20 seconds once they read the symptom.

Fields:
- language and concept: copy them from the list above.
- code: the snippet, lines separated by newlines.
- line: the 1-based number of the line that holds the bug.
- symptomEn: the error message exactly as printed, or one short English sentence on the wrong output.
- symptomPt: the same symptom for a Brazilian Portuguese reader (keep a real error message as it is).
- explanationEn: one plain English sentence on what is wrong in that line.
- explanationPt: the same sentence in Brazilian Portuguese.`
}
