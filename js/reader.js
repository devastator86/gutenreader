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

function proxied(url) {
  return `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
}

function pickHtmlUrl(formats) {
  const url = formats['text/html'];
  if (url && !url.endsWith('.zip')) return toHttps(url);
  return null;
}

/* ─── HTML processing ───────────────────────────────────────────── */

function processGutenbergHtml(html, baseUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Remove Gutenberg header/footer boilerplate divs
  doc.querySelectorAll(
    '.pg-header, .pg-footer, #pg-header, #pg-footer, .toc, #toc, ' +
    '[class*="boilerplate"], [id*="boilerplate"]'
  ).forEach(el => el.remove());

  // Rewrite relative image src to absolute
  const base = baseUrl.replace(/\/[^/]*$/, '/');
  doc.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http')) {
      img.setAttribute('src', proxied(toHttps(base + src.replace(/^\.\//, ''))));
    } else if (src && src.startsWith('http')) {
      img.setAttribute('src', proxied(toHttps(src)));
    }
    img.setAttribute('loading', 'lazy');
    img.removeAttribute('width');
    img.removeAttribute('height');
  });

  // Rewrite internal anchor hrefs to just the hash part
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('#')) return;
    if (href && href.includes('#')) {
      a.setAttribute('href', '#' + href.split('#')[1]);
    } else {
      a.removeAttribute('href');
      a.style.cursor = 'text';
    }
  });

  // Remove inline styles and font/color attributes that fight our CSS
  doc.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
  doc.querySelectorAll('[color]').forEach(el => el.removeAttribute('color'));
  doc.querySelectorAll('[face]').forEach(el => el.removeAttribute('face'));
  doc.querySelectorAll('[size]').forEach(el => el.removeAttribute('size'));
  doc.querySelectorAll('font').forEach(el => {
    el.replaceWith(...el.childNodes);
  });

  // Return body innerHTML
  return doc.body ? doc.body.innerHTML : html;
}

/* ─── Chapter nav ───────────────────────────────────────────────── */

function buildChapterNav(article) {
  const headings = Array.from(article.querySelectorAll('h1, h2, h3, h4'));
  if (headings.length < 2) return null;

  // Assign IDs to headings that don't have them
  headings.forEach((h, i) => {
    if (!h.id) h.id = `chapter-${i}`;
  });

  const items = headings.map(h => {
    const label = h.textContent.trim().replace(/\s+/g, ' ');
    if (!label) return null;
    return { id: h.id, label, tag: h.tagName.toLowerCase() };
  }).filter(Boolean);

  if (items.length < 2) return null;

  const navHtml = items.map(item => `
    <a href="#${item.id}" class="chapter-nav-item chapter-nav-${item.tag}" data-target="${item.id}">
      ${item.label}
    </a>
  `).join('');

  return navHtml;
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
    if (toolbar.classList.contains('visible')) {
      toolbar.classList.remove('visible');
      clearTimeout(hideTimer);
    } else {
      showToolbar();
    }
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
    const current = root.dataset.fontSize || 'normal';
    root.dataset.fontSize = current === 'large' ? 'normal' : 'small';
    savePref('fontSize', root.dataset.fontSize);
    showToolbar();
  });

  container.querySelector('[data-action="font-larger"]').addEventListener('click', () => {
    const root = document.documentElement;
    const current = root.dataset.fontSize || 'normal';
    root.dataset.fontSize = current === 'small' ? 'normal' : 'large';
    savePref('fontSize', root.dataset.fontSize);
    showToolbar();
  });

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
      container.querySelectorAll('[data-action="width"]').forEach(b => {
        b.classList.toggle('active', b.dataset.value === width);
      });
      showToolbar();
    });
    if (btn.dataset.value === (prefs.lineWidth || 'normal')) btn.classList.add('active');
  });

  const saveBtn = container.querySelector('[data-action="save-book"]');
  const existingLibrary = getLibrary();
  const alreadySaved = existingLibrary.some(b => b.id === bookId);
  if (alreadySaved) {
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
          <div class="state-block-icon" aria-hidden="true">&#x26A0;</div>
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
  const htmlUrl = pickHtmlUrl(bookMeta.formats);

  if (!htmlUrl) {
    container.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon" aria-hidden="true">&#x1F4DA;</div>
          <p class="state-block-title">No readable format available</p>
          <p class="state-block-body">This book doesn't have an HTML version.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Fetching book…</p>
      </div>
    </div>
  `;

  let rawHtml = '';
  try {
    const res = await fetch(proxied(htmlUrl));
    if (!res.ok) throw new Error();
    rawHtml = await res.text();
  } catch {
    container.innerHTML = `
      <div class="reader-view">
        <div class="state-block" role="alert">
          <div class="state-block-icon" aria-hidden="true">&#x26A0;</div>
          <p class="state-block-title">Could not fetch book</p>
          <p class="state-block-body">Check your connection and try again.</p>
        </div>
      </div>
    `;
    return;
  }

  const bodyHtml = processGutenbergHtml(rawHtml, htmlUrl);
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
    totalLength: rawHtml.length,
    percentComplete,
  };

  container.innerHTML = `
    <div class="reader-layout" id="reader-view">
      <div class="reader-progress-bar" id="reader-progress-bar" role="progressbar" aria-valuenow="${percentComplete}" aria-valuemin="0" aria-valuemax="100"></div>

      <!-- Chapter nav sidebar -->
      <nav class="chapter-nav" id="chapter-nav" aria-label="Chapter navigation">
        <div class="chapter-nav-header">
          <span class="chapter-nav-title">Contents</span>
          <button class="chapter-nav-close" id="chapter-nav-close" aria-label="Close contents">&#x2715;</button>
        </div>
        <div class="chapter-nav-list" id="chapter-nav-list">
          <p class="chapter-nav-loading">Loading…</p>
        </div>
      </nav>
      <div class="chapter-nav-backdrop" id="chapter-nav-backdrop"></div>

      <!-- Main reading area -->
      <div class="reader-main" id="reader-main">
        <div class="reader-topbar">
          <a href="#search" class="reader-back" aria-label="Back to search">
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
          <h1 class="reader-book-title">${title}</h1>
          <p class="reader-book-author">${authorName}</p>
        </div>

        <article class="reader-article" id="reader-article" aria-label="${title}">
          ${bodyHtml}
        </article>
      </div>
    </div>

    <!-- Reading toolbar trigger -->
    <button class="reader-toolbar-trigger" aria-label="Open reading controls" aria-expanded="false">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="4" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="9" r="1.5" fill="currentColor"/>
        <circle cx="9" cy="14" r="1.5" fill="currentColor"/>
      </svg>
    </button>

    <!-- Reading toolbar -->
    <div class="reader-toolbar" role="toolbar" aria-label="Reading controls">
      <button class="toolbar-btn" data-action="font-smaller" aria-label="Smaller text" title="Smaller">A&#x2212;</button>
      <button class="toolbar-btn" data-action="font-larger" aria-label="Larger text" title="Larger">A+</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="theme" data-value="light" aria-label="Light theme" title="Light">L</button>
      <button class="toolbar-btn" data-action="theme" data-value="sepia" aria-label="Sepia theme" title="Sepia">S</button>
      <button class="toolbar-btn" data-action="theme" data-value="dark" aria-label="Dark theme" title="Dark">D</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="font-toggle" aria-label="Toggle font" title="Font">${currentFont === 'serif' ? 'Serif' : 'Sans'}</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="width" data-value="narrow" title="Narrow">&#x2194;</button>
      <button class="toolbar-btn" data-action="width" data-value="normal" title="Normal">&#x2194;</button>
      <button class="toolbar-btn" data-action="width" data-value="wide" title="Wide">&#x2194;</button>
      <div class="toolbar-divider" role="separator"></div>
      <button class="toolbar-btn" data-action="save-book" aria-label="Save to library" title="Save">Save</button>
    </div>
  `;

  const article = container.querySelector('#reader-article');
  const progressBar = container.querySelector('#reader-progress-bar');
  const chapterNav = container.querySelector('#chapter-nav');
  const chapterNavList = container.querySelector('#chapter-nav-list');
  const chapterNavClose = container.querySelector('#chapter-nav-close');
  const chapterNavBackdrop = container.querySelector('#chapter-nav-backdrop');
  const contentsBtn = container.querySelector('#reader-contents-btn');

  // Build chapter nav after content renders
  requestAnimationFrame(() => {
    const navHtml = buildChapterNav(article);
    if (navHtml) {
      chapterNavList.innerHTML = navHtml;
      chapterNavList.querySelectorAll('.chapter-nav-item').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const target = document.getElementById(link.dataset.target);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          closeNav();
        });
      });
    } else {
      chapterNavList.innerHTML = '<p class="chapter-nav-empty">No chapters found.</p>';
    }
  });

  // Nav open/close
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

  contentsBtn.addEventListener('click', () => {
    chapterNav.classList.contains('open') ? closeNav() : openNav();
  });
  chapterNavClose.addEventListener('click', closeNav);
  chapterNavBackdrop.addEventListener('click', closeNav);

  // Restore scroll position
  if (savedPos > 0) {
    requestAnimationFrame(() => scrollToOffset(savedPos));
  }

  // Progress bar
  progressBar.style.width = `${percentComplete}%`;

  // Scroll handler
  let scrollTimer = null;
  function onScroll() {
    const pct = calcProgressPercent();
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', pct.toFixed(1));

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const offset = calcScrollOffset();
      savePosition(bookId, offset);
      const pctComplete = Math.round((offset / 100000) * 1000) / 10;
      upsertLibraryBook({ ...bookData, position: offset, percentComplete: pctComplete, savedAt: Date.now() });
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
