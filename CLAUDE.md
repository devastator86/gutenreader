# Claude Code Instructions — GutenReader

This file is the source of truth for how Claude Code operates on this project.
Read it fully before writing any code.

---

## Project Summary
GutenReader is a single-page reading app for Project Gutenberg books.
Pure vanilla HTML, CSS, JavaScript. No framework. No build step. No backend.
Hosted at `jasonritz.com/_code/gutenreader/`.

Full spec: see `gutenreader-handoff.md` in the repo root.

---

## Hard Rules

- **Never guess or invent.** If something is unclear, stop and ask.
- **Never assume** file structure, API behavior, or user intent. Verify first.
- **Never push to `main` directly.** All work goes on a feature branch, PR'd to `dev`.
- **Never merge your own PRs.** Open the PR, stop, notify the human.
- **Never truncate or omit code** when editing a file. Always write the complete file.
- **Keep thinking under 500 words** when reasoning through a problem.
- **One feature branch at a time.** Finish and PR before starting the next.

---

## Response Style
- Short and direct. No lengthy explanations unless asked.
- No bullet points for everything — use prose.
- No emojis.
- If there are two valid options, ask which to use. Don't silently pick one.
- Ask one clarifying question at a time, never a list of questions.

---

## Git Workflow

### Branch naming
```
feature/search
feature/reader
feature/library
feature/settings
feature/polish
```

### Commit format
```
type: short description
```
Types: `feat`, `fix`, `style`, `refactor`, `docs`, `chore`

Examples:
```
feat: gutendex search with 300ms debounce
fix: restore scroll position on mobile safari
style: sepia theme text contrast pass
```

### Branch lifecycle
1. Cut feature branch from `dev`
2. Build the feature completely
3. Self-test in browser (mobile and desktop viewport)
4. Commit with clean, atomic commits
5. Push branch and open PR to `dev`
6. Stop — do not merge. Human reviews.

### Never
- Force push to `main` or `dev`
- Commit `.DS_Store`, `node_modules`, or any build artifacts
- Commit API keys or credentials of any kind

---

## File & Path Rules
- All asset and script paths must be **relative** (e.g. `./css/app.css`, not `/css/app.css`)
- This app lives in a subdirectory — absolute paths will break it
- The entry point is `index.html` at the repo root

---

## Code Standards

### HTML
- Semantic elements: `<main>`, `<article>`, `<nav>`, `<header>`, `<section>`
- One `<main>` element — views render inside it via JS
- `lang="en"` on `<html>`
- Meta viewport: `<meta name="viewport" content="width=device-width, initial-scale=1">`

### CSS
- Mobile-first: base styles for mobile, `@media (min-width: 768px)` for desktop
- CSS custom properties (variables) for all colors, font sizes, spacing
- No inline styles
- No `!important`
- Themes applied via `data-theme` attribute on `<html>` element

### JavaScript
- Vanilla ES6+ only — no libraries, no npm
- No `var` — use `const` and `let`
- All `localStorage` access wrapped in try/catch
- All `fetch()` calls wrapped in try/catch with user-visible error states
- Debounce scroll events (2s) and search input (300ms)
- No `console.log` left in production code

---

## Build Order
Work through these in sequence. Do not skip ahead.

1. `index.html` shell + JS view router
2. `css/reset.css`, `css/app.css` — variables, layout, themes
3. `css/reader.css` — reading typography
4. Search view + Gutendex API (`js/search.js`)
5. Reader view — fetch, parse, render Gutenberg plain text (`js/reader.js`)
6. Reading position save/restore via localStorage
7. Library — save, remove, display books with progress (`js/library.js`)
8. Settings panel + preference persistence (`js/settings.js`)
9. Polish: transitions, loading states, error states, empty states, mobile QA

---

## API Reference

### Gutendex (search)
```
GET https://gutendex.com/books/?search=query
GET https://gutendex.com/books/?ids=1342
```
Returns: `id`, `title`, `authors[]`, `formats{}` (includes cover image URL and plain text URL)

Plain text URL key: `text/plain; charset=utf-8` or `text/plain`

### Gutenberg plain text
Fetch the `.txt` URL directly — CORS is allowed.
Strip everything before `*** START OF` and after `*** END OF` before rendering.

---

## localStorage Keys
```
gutenreader_prefs         — user settings object
gutenreader_library       — array of saved book objects
gutenreader_pos_{id}      — character offset per book (e.g. gutenreader_pos_1342)
```

Full schema is in `gutenreader-handoff.md`.

---

## Typography (do not change these values)
```
Body font:    Lora (serif)
UI font:      DM Sans
Body size:    clamp(17px, 2vw, 20px)
Line height:  1.7
Max width:    66ch
Text align:   left
```
These are evidence-based. Do not adjust without explicit instruction from the human.

---

## Themes
Applied via `data-theme="light|sepia|dark"` on `<html>`.
Default: `sepia`.

```
Light:  bg #FAFAF8  /  text #1A1A18  /  accent #7C6A52
Sepia:  bg #F5F0E8  /  text #2C2416  /  accent #8B6914
Dark:   bg #1A1A1A  /  text #D4CEBF  /  accent #A08C6E
```

---

## Out of Scope — Do Not Build
- User accounts or server-side code
- Annotations or highlights
- Audio or TTS
- Non-Gutenberg content sources
- Any npm packages, bundlers, or build tools
