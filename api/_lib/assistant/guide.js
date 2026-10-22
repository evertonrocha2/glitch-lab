// What the App guide specialist knows. Static on purpose: no student data, nothing to leak.
export const APP_GUIDE = `Glitch Detective is a debugging gym for programming students. It hides the answer and trains you instead of handing over fixes.

Pages (top bar: Board, Notes, Progress):
- Board (/board): paste an error (and the code, files, and what you were trying to do) under "New investigation". The AI explains what happened and why; the fix stays hidden until you ask. Every investigation becomes a case tagged with a bug type, on a board with three columns: New, Training, Solved. The summary at the top names your weak spot: the bug type you hit most among cases not solved yet. Click a case to open it: read the explanation, "Train this" to go to the gym, or "Write a note" about it. The board can be exported as Markdown.
- Gym (/gym/<challenge>): the AI writes a brand-new small program with the same kind of bug. You see the symptom and the broken code, fix it in the editor and press check. Hints unlock one at a time, from vague to almost the answer. Passing without hints earns extra XP. Pass 2 challenges and the case is solved.
- Notes (/notes): a notebook like Notion. Blocks: text, headings, to-dos, and cases from your board. Type @ to drop a case into the page and / for other blocks. Notes save on their own and can be exported.
- Progress (/progress): XP, level (Rookie up to Bug Whisperer), daily study streak (a day counts with at least 5 minutes of study) and 12 badges.

Always there:
- Study timer, bottom left: Start, Pause, Reset. It keeps running through reloads and counts toward your streak.
- Ask the detective (this assistant): the button in the top bar, or Alt+A or Ctrl+/ from any signed-in page. Escape closes it.
- New badges pop up bottom right.
- Each account has a daily AI limit. Sign out is in the top bar.`
