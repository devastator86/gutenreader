/* ─── Reader ────────────────────────────────────────────────────── */

const READER_TOOLBAR_HIDE_DELAY = 3000;

function getStoredPosition(bookId) {
  try {
    const val = localStorage.getItem(`gutenreader_pos_${bookId}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

function savePosition(bookId, offset) {
  try {
    localStorage.setItem(`gutenreader_pos_${bookId}`, String(offset));
  } catch { /* storage unavailable */ }
}

function getLibrary() {
  try {
    const raw = localStorage.getItem('gutenreader_library');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLibrary(library) {
  try {
    localStorage.setItem('gutenreader_library', JSON.stringify(library));
  } catch { /* storage unavailable */ }
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

/* ─── Text Parsing ──────────────────────────────────────────────── */

function stripBoilerplate(text) {
  const startMatch = text.match(/\*{3}\s*START OF (?:THIS |THE )?PROJECT GUTENBERG[^\n]*\n/i);
  const endMatch = text.match(/\*{3}\s*END OF (?:THIS |THE )?PROJECT GUTENBERG[^\n]*/i);
  const start = startMatch ? text.indexOf(startMatch[0]) + startMatch[0].length : 0;
  const end = endMatch ? text.indexOf(endMatch[0]) : text.length;
  return text.slice(start, end).trim();
}

function isChapterHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^CHAPTER\s+/i.test(trimmed)) return true;
  if (/^PART\s+/i.test(trimmed)) return true;
  if (/^BOOK\s+/i.test(trimmed)) return true;
  if (trimmed.length <= 60 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
  return false;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseTextToHtml(text) {
  const blocks = text.split(/\n{2,}/);
  const parts = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.length <= 3 && lines.every(l => isChapterHeading(l))) {
      parts.push(`<h2>${escapeHtml(lines.join(' '))}</h2>`);
    } else {
      const content = lines.join(' ');
      parts.push(`<p>${escapeHtml(content)}</p>`);
    }
  }

  return parts.join('\n');
}

/* ─── Progress ──────────────────────────────────────────────────── */

function calcProgressPercent(article) {
  const rect = article.getBoundingClientRect();
  const scrolled = Math.max(0, -rect.top);
  const total = Math.max(1, rect.height - window.innerHeight);
  return Math.min(100, (scrolled / total) * 100);
}

function calcCharOffset(article) {
  const children = Array.from(article.children);
  for (let i = 0; i < children.length; i++) {
    const r = children[i].getBoundingClientRect();
    if (r.bottom > 0) {
      let offset = 0;
      for (let j = 0; j < i; j++) {
        offset += (children[j].textContent || '').length + 2;
      }
      return offset;
    }
  }
  return 0;
}

function scrollToOffset(article, offset) {
  if (!offset) return;
  let accumulated = 0;
  for (const child of article.children) {
    const len = (child.textContent || '').length + 2;
    if (accumulated + len >= offset) {
      child.scrollIntoView({ block: 'start' });
      return;
    }
    accumulated += len;
  }
}

/* ─── Toolbar ───────────────────────────────────────────────────── */

function buildToolbar(container, bookId) {
  const prefs = (() => {
    try {
      return JSON.parse(localStorage.getItem('gutenreader_prefs') || '{}');
    } catch { return {}; }
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
    if (toolbar.classList.contains('visible')) {
      toolbar.classList.remove('visible');
      clearTimeout(hideTimer);
    } else {
      showToolbar();
    }
  }

  trigger.addEventListener('click', toggleToolbar);
  document.addEventListener('click', e => {
    if (!toolbar.contains(e.target) && e.target !== trigger) {
      toolbar.classList.remove('visible');
      clearTimeout(hideTimer);
    }
  });

  // Font size
  container.querySelector('[data-action="font-smaller"]').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.fontSize || 'normal';
    const next = current === 'large' ? 'normal' : 'small';
    root.dataset.fontSize = next;
    savePref('fontSize', next);
    showToolbar();
  });

  container.querySelector('[data-action="font-larger"]').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.fontSize || 'normal';
    const next = current === 'small' ? 'normal' : 'large';
    root.dataset.fontSize = next;
    savePref('fontSize', next);
    showToolbar();
  });

  // Theme
  container.querySelectorAll('[data-action="theme"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.value;
      document.documentElement.dataset.theme = theme;
      savePref('theme', theme);
      container.querySelectorAll('[data-action="theme"]').forEach(b => {
        b.classList.toggle('active', b.dataset.value === theme);
      });
      showToolbar();
    });
    if (btn.dataset.value === (prefs.theme || 'sepia')) btn.classList.add('active');
  });

  // Font toggle
  container.querySelector('[data-action="font-toggle"]').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.font || 'serif';
    const next = current === 'serif' ? 'sans' : 'serif';
    root.dataset.font = next;
    savePref('font', next);
    const btn = container.querySelector('[data-action="font-toggle"]');
    btn.textContent = next === 'serif' ? 'Serif' : 'Sans';
    showToolbar();
  });

  // Line width
  container.querySelectorAll('[data-action="width"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const width = btn.dataset.value;
      document.documentElement.dataset.lineWidth = width;
      savePref('lineWidth', width);
      container.querySelectorAll('[data-action="width"]').forEach(b => {
        b.classList.toggle('active', b.dataset.value === width);
      });
      showToolbar();
    });
    if (btn.dataset.value === (prefs.lineWidth || 'normal')) btn.classList.add('active');
  });

  // Save to library button
  container.querySelector('[data-action="save-book"]').addEventListener('click', () => {
    const btn = container.querySelector('[data-action="save-book"]');
    const bookData = JSON.parse(btn.dataset.book || '{}');
    upsertLibraryBook(bookData);
    btn.textContent = 'Saved';
    btn.classList.add('active');
    showToolbar();
  });
}

/* ─── Fetch & Render ────────────────────────────────────────────── */

async function fetchAndRenderBook(container, bookId) {
  const main = container;

  main.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Loading book…</p>
      </div>
    </div>
  `;

  let bookMeta = null;

  try {
    const metaRes = await fetch(`https://gutendex.com/books/?ids=${bookId}`);
    if (!metaRes.ok) throw new Error('Metadata fetch failed');
    const metaData = await metaRes.json();
    bookMeta = metaData.results && metaData.results[0];
    if (!bookMeta) throw new Error('Book not found');
  } catch {
    main.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon" aria-hidden="true">&#x26A0;</div>
          <p class="state-block-title">Could not load book</p>
          <p class="state-block-body">Check your connection and try again.</p>
        </div>
      </div>
    `;
    return;
  }

  function toHttps(url) {
    return url ? url.replace(/^http:\/\//i, 'https://') : url;
  }

  function pickTextUrl(formats) {
    const candidates = [
      formats['text/plain; charset=utf-8'],
      formats['text/plain'],
    ];
    for (const url of candidates) {
      if (url && !url.endsWith('.zip')) return toHttps(url);
    }
    return null;
  }

  const title = bookMeta.title || 'Untitled';
  const authors = bookMeta.authors || [];
  const authorName = authors.length ? authors.map(a => a.name).join(', ') : 'Unknown author';
  const coverUrl = toHttps(bookMeta.formats['image/jpeg'] || '');
  const textUrl = pickTextUrl(bookMeta.formats);

  if (!textUrl) {
    main.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon" aria-hidden="true">&#x1F4DA;</div>
          <p class="state-block-title">No plain text available</p>
          <p class="state-block-body">This book doesn't have a readable plain text format.</p>
        </div>
      </div>
    `;
    return;
  }

  main.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Fetching text…</p>
      </div>
    </div>
  `;

  let rawText = '';
  try {
    const textRes = await fetch(textUrl);
    if (!textRes.ok) throw new Error('Text fetch failed');
    rawText = await textRes.text();
  } catch {
    main.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon" aria-hidden="true">&#x26A0;</div>
          <p class="state-block-title">Could not fetch book text</p>
          <p class="state-block-body">Check your connection and try again.</p>
        </div>
      </div>
    `;
    return;
  }

  const cleanText = stripBoilerplate(rawText);
  const totalLength = cleanText.length;
  const bodyHtml = parseTextToHtml(cleanText);
  const savedPos = getStoredPosition(bookId);
  const percentComplete = totalLength > 0 ? Math.round((savedPos / totalLength) * 100 * 10) / 10 : 0;

  const currentFont = document.documentElement.dataset.font || 'serif';

  main.innerHTML = `
    <div class="reader-view" id="reader-view">
      <div class="reader-progress-bar" id="reader-progress-bar" role="progressbar" aria-valuenow="${percentComplete}" aria-valuemin="0" aria-valuemax="100"></div>
      <a href="#search" class="reader-back" aria-label="Back to search">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Search
      </a>
      <div class="reader-book-info">
        <h1 class="reader-book-title">${escapeHtml(title)}</h1>
        <p class="reader-book-author">${escapeHtml(authorName)}</p>
      </div>
      <article class="reader-article" id="reader-article" aria-label="${escapeHtml(title)}">
        ${bodyHtml}
      </article>
    </div>
    <button class="reader-toolbar-trigger" aria-label="Open reading controls" aria-expanded="false">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 10h6M10 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="reader-toolbar" role="toolbar" aria-label="Reading controls">
      <button class="toolbar-btn" data-action="font-smaller" aria-label="Decrease font size" title="Smaller text">A&#x2212;</button>
      <button class="toolbar-btn" data-action="font-larger" aria-label="Increase font size" title="Larger text">A+</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="theme" data-value="light" aria-label="Light theme" title="Light">&#x2600;&#xFE0F;</button>
      <button class="toolbar-btn" data-action="theme" data-value="sepia" aria-label="Sepia theme" title="Sepia">&#x1F4DC;</button>
      <button class="toolbar-btn" data-action="theme" data-value="dark" aria-label="Dark theme" title="Dark">&#x1F319;</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="font-toggle" aria-label="Toggle font" title="Toggle font">${currentFont === 'serif' ? 'Serif' : 'Sans'}</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="width" data-value="narrow" aria-label="Narrow width" title="Narrow">&#x2194;&#xFE0F;</button>
      <button class="toolbar-btn" data-action="width" data-value="normal" aria-label="Normal width" title="Normal">&#x2194;&#xFE0F;</button>
      <button class="toolbar-btn" data-action="width" data-value="wide" aria-label="Wide width" title="Wide">&#x2194;&#xFE0F;</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="save-book" data-book="${escapeHtml(JSON.stringify({ id: bookId, title, author: authorName, coverUrl, savedAt: Date.now(), position: savedPos, totalLength, percentComplete }))}" aria-label="Save to library" title="Save">Save</button>
    </div>
  `;

  const article = main.querySelector('#reader-article');
  const progressBar = main.querySelector('#reader-progress-bar');

  // Restore position
  if (savedPos > 0) {
    requestAnimationFrame(() => scrollToOffset(article, savedPos));
  }

  // Progress bar init
  progressBar.style.width = `${percentComplete}%`;

  // Scroll handler — debounced 2s
  let scrollTimer = null;
  function onScroll() {
    const pct = calcProgressPercent(article);
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', pct.toFixed(1));

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const offset = calcCharOffset(article);
      savePosition(bookId, offset);
      const pctComplete = totalLength > 0 ? Math.round((offset / totalLength) * 100 * 10) / 10 : 0;
      upsertLibraryBook({
        id: bookId,
        title,
        author: authorName,
        coverUrl,
        savedAt: Date.now(),
        position: offset,
        totalLength,
        percentComplete: pctComplete,
      });
    }, 2000);
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // Clean up scroll listener on navigation
  const observer = new MutationObserver(() => {
    if (!document.getElementById('reader-view')) {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('main-content'), { childList: true });

  buildToolbar(main, bookId);
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
