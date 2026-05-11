/* ─── Reader ────────────────────────────────────────────────────── */

const READER_TOOLBAR_HIDE_DELAY = 3000;

/* ─── localStorage helpers ──────────────────────────────────────── */

function getStoredPosition(bookId) {
  try {
    const val = localStorage.getItem(`gutenreader_pos_${bookId}`);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}

function savePosition(bookId, offset) {
  try {
    localStorage.setItem(`gutenreader_pos_${bookId}`, String(offset));
  } catch { /* unavailable */ }
}

function getLibrary() {
  try {
    const raw = localStorage.getItem('gutenreader_library');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLibrary(library) {
  try {
    localStorage.setItem('gutenreader_library', JSON.stringify(library));
  } catch { /* unavailable */ }
}

function upsertLibraryBook(book) {
  const library = getLibrary();
  const idx = library.findIndex(b => b.id === book.id);
  if (idx >= 0) {
    library[idx] = { ...library[idx], ...book };
  } else {
    library.unshift(book);
  }
  saveLibrary(library);
}

/* ─── URL helpers ───────────────────────────────────────────────── */

function toHttps(url) {
  return url ? url.replace(/^http:\/\//i, 'https://') : url;
}

function pickTextUrl(formats, bookId) {
  const candidates = [
    formats['text/plain; charset=utf-8'],
    formats['text/plain'],
  ];
  for (const url of candidates) {
    if (url && !url.endsWith('.zip')) {
      const u = toHttps(url);
      // Rewrite ebook redirect URLs to direct cache path
      return u.replace(
        /https:\/\/www\.gutenberg\.org\/ebooks\/(\d+)\.txt[^\s]*/i,
        (_, id) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`
      );
    }
  }
  return `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.txt`;
}

/* ─── Text processing ───────────────────────────────────────────── */

function processPlainText(raw) {
  // Strip Gutenberg header/footer
  const startRx = /\*{3}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*\n/i;
  const endRx = /\*{3}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i;
  const startMatch = raw.match(startRx);
  const endMatch = raw.match(endRx);
  const start = startMatch ? raw.indexOf(startMatch[0]) + startMatch[0].length : 0;
  const end = endMatch ? raw.indexOf(endMatch[0]) : raw.length;
  let text = raw.slice(start, end).trim();

  // Clean up markup artifacts
  text = text.replace(/\[Illustration[^\]]*\]/gi, '');
  text = text.replace(/\[Footnote[^\]]*\]/gi, '');
  text = text.replace(/\[Sidenote[^\]]*\]/gi, '');
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  const blocks = text.split(/\n{2,}/);
  const parts = [];
  let chapterIndex = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const singleLine = lines.length <= 3;
    const firstLine = lines[0];

    // Chapter / section heading detection
    const isChapter = singleLine && (
      /^(CHAPTER|CHAP\.)\s+/i.test(firstLine) ||
      /^PART\s+/i.test(firstLine) ||
      /^BOOK\s+/i.test(firstLine) ||
      /^VOLUME\s+/i.test(firstLine) ||
      /^SECTION\s+/i.test(firstLine) ||
      (firstLine.length <= 60 && firstLine === firstLine.toUpperCase() && /[A-Z]{3,}/.test(firstLine) && !/[.!?,;]/.test(firstLine))
    );

    if (isChapter) {
      const id = `chapter-${chapterIndex++}`;
      const label = lines.map(escapeHtml).join(' ');
      parts.push(`<h2 id="${id}">${label}</h2>`);
    } else {
      const content = lines.join(' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      // Re-insert em tags (they got escaped above — handle differently)
      parts.push(`<p>${lines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')).join(' ')}</p>`);
    }
  }

  return parts.join('\n');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function processPlainTextClean(raw) {
  const startRx = /\*{3}\s*START OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*\n/i;
  const endRx = /\*{3}\s*END OF (?:THE |THIS )?PROJECT GUTENBERG[^\n]*/i;
  const startMatch = raw.match(startRx);
  const endMatch = raw.match(endRx);
  const start = startMatch ? raw.indexOf(startMatch[0]) + startMatch[0].length : 0;
  const end = endMatch ? raw.indexOf(endMatch[0]) : raw.length;
  let text = raw.slice(start, end).trim();

  text = text.replace(/\[Illustration[^\]]*\]/gi, '');
  text = text.replace(/\[Footnote[^\]]*\]/gi, '');
  text = text.replace(/\[Sidenote[^\]]*\]/gi, '');

  const blocks = text.split(/\n{2,}/);
  const parts = [];
  let chapterIndex = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const firstLine = lines[0];
    const singleLine = lines.length <= 3;

    const isHeading = singleLine && (
      /^(CHAPTER|CHAP\.)\s+/i.test(firstLine) ||
      /^PART\s+/i.test(firstLine) ||
      /^BOOK\s+/i.test(firstLine) ||
      /^VOLUME\s+/i.test(firstLine) ||
      /^SECTION\s+/i.test(firstLine) ||
      (firstLine.length <= 60 && firstLine === firstLine.toUpperCase() && /[A-Z]{3,}/.test(firstLine) && !/[.!?,;:]/.test(firstLine))
    );

    if (isHeading) {
      const id = `chapter-${chapterIndex++}`;
      parts.push(`<h2 id="${id}">${lines.map(escapeHtml).join('<br>')}</h2>`);
    } else {
      // Detect verse/poetry (short lines, indented, or consistent short length)
      const avgLen = lines.reduce((s, l) => s + l.length, 0) / lines.length;
      const isVerse = lines.length > 1 && avgLen < 50 && lines.every(l => l.length < 80);
      if (isVerse) {
        parts.push(`<pre class="verse">${lines.map(escapeHtml).join('\n')}</pre>`);
      } else {
        parts.push(`<p>${escapeHtml(lines.join(' '))}</p>`);
      }
    }
  }

  return parts.join('\n');
}

/* ─── Chapter nav ───────────────────────────────────────────────── */

function buildChapterNavFromArticle(article) {
  const headings = Array.from(article.querySelectorAll('h2[id]'));
  if (headings.length < 2) return null;

  return headings.map(h => {
    const label = h.textContent.trim().replace(/\s+/g, ' ');
    return `<a href="#${h.id}" class="chapter-nav-item" data-target="${h.id}">${escapeHtml(label)}</a>`;
  }).join('');
}

/* ─── Progress ──────────────────────────────────────────────────── */

function calcScrollOffset() {
  const scrolled = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total > 0 ? Math.round((scrolled / total) * 100000) : 0;
}

function scrollToOffset(offset) {
  if (!offset) return;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.round((offset / 100000) * total));
}

function calcProgressPercent() {
  const scrolled = window.scrollY;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
}

/* ─── Toolbar ───────────────────────────────────────────────────── */

function buildToolbar(container, bookId, bookData) {
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('gutenreader_prefs') || '{}'); } catch { return {}; }
  })();

  function savePref(key, value) {
    const current = (() => {
      try { return JSON.parse(localStorage.getItem('gutenreader_prefs') || '{}'); } catch { return {}; }
    })();
    current[key] = value;
    try { localStorage.setItem('gutenreader_prefs', JSON.stringify(current)); } catch { /* unavailable */ }
    if (typeof applyPrefs === 'function') applyPrefs();
  }

  const toolbar = container.querySelector('.reader-toolbar');
  const trigger = container.querySelector('.reader-toolbar-trigger');
  let hideTimer = null;

  function showToolbar() {
    toolbar.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toolbar.classList.remove('visible'), READER_TOOLBAR_HIDE_DELAY);
  }

  function toggleToolbar() {
    toolbar.classList.contains('visible') ? toolbar.classList.remove('visible') : showToolbar();
  }

  trigger.addEventListener('click', e => { e.stopPropagation(); toggleToolbar(); });
  document.addEventListener('click', e => {
    if (!toolbar.contains(e.target) && e.target !== trigger) {
      toolbar.classList.remove('visible');
      clearTimeout(hideTimer);
    }
  });

  container.querySelector('[data-action="font-smaller"]').addEventListener('click', () => {
    const root = document.documentElement;
    root.dataset.fontSize = (root.dataset.fontSize || 'normal') === 'large' ? 'normal' : 'small';
    savePref('fontSize', root.dataset.fontSize);
    showToolbar();
  });

  container.querySelector('[data-action="font-larger"]').addEventListener('click', () => {
    const root = document.documentElement;
    root.dataset.fontSize = (root.dataset.fontSize || 'normal') === 'small' ? 'normal' : 'large';
    savePref('fontSize', root.dataset.fontSize);
    showToolbar();
  });

  container.querySelectorAll('[data-action="theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.value;
      document.documentElement.dataset.theme = theme;
      savePref('theme', theme);
      container.querySelectorAll('[data-action="theme"]').forEach(b => b.classList.toggle('active', b.dataset.value === theme));
      showToolbar();
    });
    if (btn.dataset.value === (prefs.theme || 'sepia')) btn.classList.add('active');
  });

  container.querySelector('[data-action="font-toggle"]').addEventListener('click', () => {
    const root = document.documentElement;
    const next = (root.dataset.font || 'serif') === 'serif' ? 'sans' : 'serif';
    root.dataset.font = next;
    savePref('font', next);
    container.querySelector('[data-action="font-toggle"]').textContent = next === 'serif' ? 'Serif' : 'Sans';
    showToolbar();
  });

  container.querySelectorAll('[data-action="width"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const width = btn.dataset.value;
      document.documentElement.dataset.lineWidth = width;
      savePref('lineWidth', width);
      container.querySelectorAll('[data-action="width"]').forEach(b => b.classList.toggle('active', b.dataset.value === width));
      showToolbar();
    });
    if (btn.dataset.value === (prefs.lineWidth || 'normal')) btn.classList.add('active');
  });

  const saveBtn = container.querySelector('[data-action="save-book"]');
  if (getLibrary().some(b => b.id === bookId)) {
    saveBtn.textContent = 'Saved';
    saveBtn.classList.add('active');
  }
  saveBtn.addEventListener('click', () => {
    upsertLibraryBook(bookData);
    saveBtn.textContent = 'Saved';
    saveBtn.classList.add('active');
    showToolbar();
  });
}

/* ─── Render shell ──────────────────────────────────────────────── */

function renderShell(container, title, authorName, bodyHtml, savedPos, currentFont) {
  const percentComplete = Math.round((savedPos / 100000) * 1000) / 10;

  container.innerHTML = `
    <div class="reader-layout" id="reader-view">
      <div class="reader-progress-bar" id="reader-progress-bar" role="progressbar" aria-valuenow="${percentComplete}" aria-valuemin="0" aria-valuemax="100"></div>

      <nav class="chapter-nav" id="chapter-nav" aria-label="Chapter navigation">
        <div class="chapter-nav-header">
          <span class="chapter-nav-title">Contents</span>
          <button class="chapter-nav-close" id="chapter-nav-close" aria-label="Close contents">&#x2715;</button>
        </div>
        <div class="chapter-nav-list" id="chapter-nav-list"></div>
      </nav>
      <div class="chapter-nav-backdrop" id="chapter-nav-backdrop"></div>

      <div class="reader-main">
        <div class="reader-topbar">
          <a href="#search" class="reader-back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Search
          </a>
          <button class="reader-contents-btn" id="reader-contents-btn" aria-label="Table of contents" aria-expanded="false">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="8" x2="10" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Contents
          </button>
        </div>

        <div class="reader-book-info">
          <h1 class="reader-book-title">${escapeHtml(title)}</h1>
          <p class="reader-book-author">${escapeHtml(authorName)}</p>
        </div>

        <article class="reader-article" id="reader-article" aria-label="${escapeHtml(title)}">
          ${bodyHtml}
        </article>
      </div>
    </div>

    <button class="reader-toolbar-trigger" aria-label="Open reading controls">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="14" r="1.5" fill="currentColor"/>
      </svg>
    </button>

    <div class="reader-toolbar" role="toolbar" aria-label="Reading controls">
      <button class="toolbar-btn" data-action="font-smaller">A&#x2212; Smaller</button>
      <button class="toolbar-btn" data-action="font-larger">A+ Larger</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="theme" data-value="light">Light</button>
      <button class="toolbar-btn" data-action="theme" data-value="sepia">Sepia</button>
      <button class="toolbar-btn" data-action="theme" data-value="dark">Dark</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="font-toggle">${currentFont === 'serif' ? 'Serif' : 'Sans'}</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="width" data-value="narrow">Narrow</button>
      <button class="toolbar-btn" data-action="width" data-value="normal">Normal</button>
      <button class="toolbar-btn" data-action="width" data-value="wide">Wide</button>
      <div class="toolbar-divider"></div>
      <button class="toolbar-btn" data-action="save-book">Save to library</button>
    </div>
  `;
}

/* ─── Fetch & Render ────────────────────────────────────────────── */

async function fetchAndRenderBook(container, bookId) {
  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Loading book…</p>
      </div>
    </div>
  `;

  let bookMeta = null;
  try {
    const res = await fetch(`https://gutendex.com/books/?ids=${bookId}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    bookMeta = data.results && data.results[0];
    if (!bookMeta) throw new Error();
  } catch {
    container.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon">&#x26A0;</div>
          <p class="state-block-title">Could not load book</p>
          <p class="state-block-body">Check your connection and try again.</p>
        </div>
      </div>
    `;
    return;
  }

  const title = bookMeta.title || 'Untitled';
  const authors = bookMeta.authors || [];
  const authorName = authors.length ? authors.map(a => a.name).join(', ') : 'Unknown author';
  const coverUrl = toHttps(bookMeta.formats['image/jpeg'] || '');
  const textUrl = pickTextUrl(bookMeta.formats, bookId);

  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Fetching book…</p>
      </div>
    </div>
  `;

  let rawText = '';
  try {
    const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(textUrl)}`);
    if (!res.ok) throw new Error();
    rawText = await res.text();
  } catch {
    container.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon">&#x26A0;</div>
          <p class="state-block-title">Could not fetch book</p>
          <p class="state-block-body">Check your connection and try again.</p>
        </div>
      </div>
    `;
    return;
  }

  const bodyHtml = processPlainTextClean(rawText);
  const savedPos = getStoredPosition(bookId);
  const percentComplete = Math.round((savedPos / 100000) * 1000) / 10;
  const currentFont = document.documentElement.dataset.font || 'serif';

  const bookData = {
    id: bookId,
    title,
    author: authorName,
    coverUrl,
    savedAt: Date.now(),
    position: savedPos,
    totalLength: rawText.length,
    percentComplete,
  };

  renderShell(container, title, authorName, bodyHtml, savedPos, currentFont);

  const article = container.querySelector('#reader-article');
  const progressBar = container.querySelector('#reader-progress-bar');
  const chapterNav = container.querySelector('#chapter-nav');
  const chapterNavList = container.querySelector('#chapter-nav-list');
  const chapterNavClose = container.querySelector('#chapter-nav-close');
  const chapterNavBackdrop = container.querySelector('#chapter-nav-backdrop');
  const contentsBtn = container.querySelector('#reader-contents-btn');

  // Build chapter nav
  requestAnimationFrame(() => {
    const navHtml = buildChapterNavFromArticle(article);
    if (navHtml) {
      chapterNavList.innerHTML = navHtml;
      chapterNavList.querySelectorAll('.chapter-nav-item').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const target = document.getElementById(link.dataset.target);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          closeNav();
        });
      });
    } else {
      chapterNavList.innerHTML = '<p class="chapter-nav-empty">No chapters found.</p>';
    }
  });

  function openNav() {
    chapterNav.classList.add('open');
    chapterNavBackdrop.classList.add('visible');
    contentsBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    chapterNav.classList.remove('open');
    chapterNavBackdrop.classList.remove('visible');
    contentsBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  contentsBtn.addEventListener('click', () => chapterNav.classList.contains('open') ? closeNav() : openNav());
  chapterNavClose.addEventListener('click', closeNav);
  chapterNavBackdrop.addEventListener('click', closeNav);

  if (savedPos > 0) requestAnimationFrame(() => scrollToOffset(savedPos));

  progressBar.style.width = `${percentComplete}%`;

  let scrollTimer = null;
  function onScroll() {
    const pct = calcProgressPercent();
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', pct.toFixed(1));
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const offset = calcScrollOffset();
      savePosition(bookId, offset);
      const pct2 = Math.round((offset / 100000) * 1000) / 10;
      upsertLibraryBook({ ...bookData, position: offset, percentComplete: pct2, savedAt: Date.now() });
    }, 2000);
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  const observer = new MutationObserver(() => {
    if (!document.getElementById('reader-view')) {
      window.removeEventListener('scroll', onScroll);
      closeNav();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('main-content'), { childList: true });

  buildToolbar(container, bookId, bookData);
}

/* ─── Entry Point ───────────────────────────────────────────────── */

function initReader(container, params) {
  const bookId = params && params.id;
  if (!bookId) {
    container.innerHTML = `
      <div class="reader-view">
        <div class="state-block">
          <p class="state-block-body">No book selected.</p>
        </div>
      </div>
    `;
    return;
  }
  fetchAndRenderBook(container, bookId);
}
