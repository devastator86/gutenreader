# GutenReader — Claude Code Handoff Document

## Project Overview
A Kindle-quality reading experience for Project Gutenberg books. Users search, save, and read classic literature in a beautifully typeset, distraction-free interface. No backend. No framework. No build step.

**Live URL:** `jasonritz.com/_code/gutenreader/`
**Repo:** GitHub (new repo, name: `gutenreader`)

---

## Tech Stack
- Pure vanilla HTML, CSS, JavaScript — no frameworks, no bundlers
- [Gutendex API](https://gutendex.com) for search (free, no auth, CORS-friendly)
- Project Gutenberg plain-text URLs for book content
- `localStorage` for library, reading positions, and user preferences
- Google Fonts CDN (single `<link>` tag — only dependency)

---

## File Structure
```
gutenreader/
├── index.html          # Single HTML shell
├── css/
│   ├── reset.css       # Minimal reset
│   ├── app.css         # Layout, themes, variables
│   └── reader.css      # Reading view typography
├── js/
│   ├── app.js          # Router, state, init
│   ├── search.js       # Gutendex API calls
│   ├── reader.js       # Book fetch, text parse, render
│   ├── library.js      # localStorage CRUD for saved books
│   └── settings.js     # User preference persistence
└── assets/
    └── icon.svg        # Minimal app icon
```

---

## Views (SPA — no page reloads)
The app has three views rendered into one `<main>` container via JS:

1. **Home / Search** — search bar, recent books, library shelf
2. **Library** — saved books with cover, title, author, % progress
3. **Reader** — full reading view, controls panel

---

## Typography Spec (Evidence-Based)
These values are non-negotiable — derived from readability research:

| Property | Value |
|---|---|
| Body font | Lora (serif, Google Fonts) |
| UI font | DM Sans (Google Fonts) |
| Body size | `clamp(17px, 2vw, 20px)` |
| Line height | `1.7` |
| Max line width | `66ch` |
| Text align | Left (never justified — poor web rendering) |
| Letter spacing | `0.01em` |

---

## Themes
Three themes, switchable via reader toolbar. Stored in `localStorage`.

| Theme | Background | Text | Accent |
|---|---|---|---|
| Light | `#FAFAF8` | `#1A1A18` | `#7C6A52` |
| Sepia | `#F5F0E8` | `#2C2416` | `#8B6914` |
| Dark | `#1A1A1A` | `#D4CEBF` | `#A08C6E` |

---

## User Controls (Reader Toolbar)
Persistent panel (collapsed by default, tap/click to open):
- **Font size** — smaller / larger (3 steps)
- **Theme** — Light / Sepia / Dark
- **Font** — Lora (serif) / DM Sans (sans-serif) toggle
- **Line width** — Narrow / Normal / Wide (55ch / 66ch / 80ch)

All saved to `localStorage` key `gutenreader_prefs`.

---

## localStorage Schema

```js
// User preferences
localStorage.setItem('gutenreader_prefs', JSON.stringify({
  theme: 'sepia',        // 'light' | 'sepia' | 'dark'
  fontSize: 'normal',    // 'small' | 'normal' | 'large'
  font: 'serif',         // 'serif' | 'sans'
  lineWidth: 'normal'    // 'narrow' | 'normal' | 'wide'
}));

// Library — array of saved books
localStorage.setItem('gutenreader_library', JSON.stringify([
  {
    id: 1342,                          // Gutenberg book ID
    title: "Pride and Prejudice",
    author: "Jane Austen",
    coverUrl: "https://...",           // from Gutendex formats.image
    savedAt: 1715000000000,            // Date.now()
    position: 14200,                   // character offset in plain text
    totalLength: 683000,               // total characters
    percentComplete: 2.1
  }
]));

// Active reading position (updated on scroll, debounced 2s)
localStorage.setItem('gutenreader_pos_1342', '14200');
```

---

## API: Gutendex Search
```
GET https://gutendex.com/books/?search=pride+and+prejudice
GET https://gutendex.com/books/?search=jane+austen
GET https://gutendex.com/books/?ids=1342
```
Response includes: `id`, `title`, `authors`, `formats` (image cover URL, text/plain URL).

Extract plain text URL from `formats['text/plain; charset=utf-8']` or `formats['text/plain']`.

Fetch the plain text directly — no proxy needed (Gutenberg allows CORS on `.txt` files).

---

## Book Text Rendering
Gutenberg plain text files use double-newlines for paragraphs. Parse and render:
1. Fetch `.txt` file via `fetch()`
2. Strip Project Gutenberg header/footer boilerplate (everything before `*** START OF` and after `*** END OF`)
3. Split on `\n\n` → array of paragraphs
4. Wrap each in `<p>` tags and inject into reader `<article>` element
5. Preserve chapter headings (ALL CAPS lines or lines starting with "CHAPTER") as `<h2>`

---

## Reading Position
- On scroll, debounce 2s, save character offset of first visible paragraph to `localStorage`
- On book open: scroll to saved offset
- Calculate `percentComplete` from `(position / totalLength) * 100`
- Show progress bar at top of reader (thin, 2px, accent color)

---

## UI Design Direction
**Aesthetic:** Refined editorial — think Kindle meets a well-designed literary journal. Warm, paper-like, calm. Nothing should distract from the text.

- No harsh borders — use spacing and subtle background shifts to delineate sections
- Search results: minimal card grid, cover image left, title/author/year right
- Library shelf: same card pattern, with a thin progress bar under each cover
- Reader: full-width background color, centered `<article>` at `max-width: 66ch`, generous top/bottom padding
- Toolbar: floats bottom-right on desktop, bottom-center on mobile, semi-transparent background, appears on tap/hover, auto-hides after 3s of inactivity
- Mobile: toolbar at bottom, full-width, pill-shaped controls

---

## Mobile-First Notes
- Base styles are mobile; desktop via `@media (min-width: 768px)`
- Touch targets minimum `44px`
- Reader padding: `1.5rem` mobile, `4rem` desktop
- Search input is the hero element on Home — large, centered, autofocus

---

## GitHub Workflow Rules for Claude Code

### Branching
- `main` — production only. Never commit directly to `main`.
- `dev` — integration branch. All features merge here first.
- Feature branches: `feature/search`, `feature/reader`, `feature/library`, `feature/settings`, etc.

### Commit Convention
Format: `type: short description`

Types: `feat`, `fix`, `style`, `refactor`, `docs`, `chore`

Examples:
```
feat: add gutendex search with debounce
fix: reader position not restoring on mobile
style: sepia theme contrast adjustment
```

### Pull Request Rules
- All feature branches PR into `dev`
- `dev` PRs into `main` only when a milestone is complete and tested
- PR title must match the feature branch name
- No force pushes to `main` or `dev`

### Claude Code Permissions
- Read/write all files in the repo
- Create and push feature branches
- Open PRs from feature branches to `dev`
- **Never** push directly to `main`
- **Never** merge its own PRs — human reviews and merges

### When to Push
- Push a feature branch when the feature is complete and self-tested
- Do not push broken or incomplete code mid-feature
- Commit atomically — one logical change per commit

---

## Build & Deploy
No build step. Deploy = push to `main` and copy files to `jasonritz.com/_code/gutenreader/` via whatever method the server uses (FTP, rsync, cPanel, etc.).

All paths must be relative — no absolute paths — so it works in a subdirectory.

---

## Out of Scope (do not build)
- User accounts or cloud sync
- Annotations or highlights (v2)
- Audio/TTS
- Non-Gutenberg sources
- Any server-side code

---

## Build Order for Claude Code
1. `index.html` shell + router stub
2. `css/` — reset, variables, themes
3. Search view + Gutendex API integration
4. Reader view — fetch, parse, render plain text
5. Reading position save/restore
6. Library (save/remove books, progress display)
7. Settings panel + preference persistence
8. Polish: transitions, mobile QA, empty states, loading states, error states
