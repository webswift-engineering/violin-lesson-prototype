# Violin lesson manager — clickable prototype

A complete, clickable mock of the studio app: every teacher screen and the parent portal, with **fake
data only**. Nothing is saved anywhere except the browser tab you are looking at (refresh keeps your
walkthrough; **Reset demo data** in the top bar restores the sample studio). No accounts, no emails, no
API calls.

Live: https://webswift-engineering.github.io/violin-lesson-prototype/

## How to give feedback

- Every screen shows its id in the top bar (for example `teacher/notes` or `parent/home`). Quote it.
- Say what you tried to do, what you expected, and what happened. A screenshot helps.
- Changes land on the same link within a couple of minutes of a push; `CHANGELOG.md` lists them.
- When a screen is agreed as final, the live app is changed to match it, test-first, in one go.

## Rules

- No real names, emails, phone numbers or lesson notes in this repository. The sample studio is
  invented (Chen, Nguyen, 王 families).
- Plain HTML, CSS and JavaScript: no build step. Open `index.html` from disk or serve the folder.

## Layout

```
index.html          shell, prototype bar, phone / desktop frame
css/brand.css       the app's colour and font tokens (copied from the live app)
css/ui.css          buttons, chips, cards, calendar, sheet
js/data.js          sample studio, generated around today's date
js/store.js         in-memory state and the fake behaviours (attendance, moves, sends, pauses…)
js/router.js        #/routes that mirror the live app's URLs
js/ui.js            shared widgets: calendar, sheet, toast, status editor, heatmap
js/screens/teacher  one file per teacher area (records.js = lesson records with Lifetime / YTD / month report)
js/screens/parent   the parent portal (English / 中文)
```
