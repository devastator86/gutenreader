/* ─── Reader ────────────────────────────────────────────────────── */

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

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── URL helpers ───────────────────────────────────────────────── */

function toHttps(url) {
  return url ? url.replace(/^http:\/\//i, 'https://') : url;
}

/* ─── HTML processing ───────────────────────────────────────────── */

function processGutenbergHtml(htmlString, bookId) {
  const base = `https://www.gutenberg.org/cache/epub/${bookId}/`;
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Remove header and footer boilerplate sections
  const header = doc.getElementById('pg-header');
  if (header) header.remove();
  const footer = doc.getElementById('pg-footer');
  if (footer) footer.remove();

  // Remove page number spans
  doc.querySelectorAll('.pagenum').forEach(el => el.remove());

  // Rewrite relative image src and href to absolute Gutenberg URLs
  doc.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http') && !src.startsWith('//')) {
      img.setAttribute('src', base + src);
    }
    // Remove fixed dimensions so images scale fluidly
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.removeAttribute('id');
  });

  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('images/')) {
      a.setAttribute('href', base + href);
    }
    // Remove internal anchor-only links (they'll break scroll after extraction)
    if (href && href.startsWith('#')) {
      a.removeAttribute('href');
    }
  });

  // Promote anchor ids from inside h2 to the h2 itself for chapter nav
  doc.querySelectorAll('h2').forEach(h2 => {
    if (!h2.id) {
      const anchor = h2.querySelector('a[id]');
      if (anchor) {
        h2.id = anchor.id;
        anchor.removeAttribute('id');
      }
    }
  });

  const body = doc.body;
  if (!body) return '';
  return body.innerHTML;
}

/* ─── Chapter nav ───────────────────────────────────────────────── */

function buildChapterNavFromArticle(article) {
  const headings = Array.from(article.querySelectorAll('h2[id]'));
  if (headings.length < 2) return null;

  return headings.map(h => {
    const clone = h.cloneNode(true);
    clone.querySelectorAll('img, .caption, .figcenter, .figleft, .figright').forEach(el => el.remove());
    const label = clone.textContent.trim().replace(/\s+/g, ' ') || h.id;
    return `<a href="#${h.id}" class="chapter-nav-item" data-target="${h.id}">${escapeHtml(label)}</a>`;
  }).join('');
}

/* ─── Progress ──────────────────────────────────────────────────── */

function calcScrollOffset() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total > 0 ? Math.round((window.scrollY / total) * 100000) : 0;
}

function scrollToOffset(offset) {
  if (!offset) return;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.round((offset / 100000) * total));
}

function calcProgressPercent() {
  const total = document.documentElement.scrollHeight - window.innerHeight;
  return total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0;
}

/* ─── Toolbar removed — settings panel handles all reading prefs ─── */

/* ─── Render shell ──────────────────────────────────────────────── */

function renderShell(container, title, authorName, bodyHtml) {
  container.innerHTML = `
    <div class="reader-layout" id="reader-view">
      <div class="reader-main">
        <div class="reader-topbar">
          <a href="#search" class="reader-back">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Search
          </a>
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
  `;
}

function createFixedElements(savedPos) {
  const percentComplete = Math.round((savedPos / 100000) * 1000) / 10;
  const currentFont = document.documentElement.dataset.font || 'serif';

  const progressBar = document.createElement('div');
  progressBar.className = 'reader-progress-bar';
  progressBar.id = 'reader-progress-bar';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuenow', String(percentComplete));
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.style.width = `${percentComplete}%`;

  const contentsBtn = document.createElement('button');
  contentsBtn.className = 'reader-contents-btn';
  contentsBtn.setAttribute('aria-label', 'Table of contents');
  contentsBtn.setAttribute('aria-expanded', 'false');
  contentsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <line x1="2" y1="5" x2="16" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="2" y1="9" x2="12" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="2" y1="13" x2="14" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;


  const jumpBtn = document.createElement('button');
  jumpBtn.className = 'reader-jump-btn hidden';
  jumpBtn.setAttribute('aria-label', 'Jump to first chapter');
  jumpBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Jump to Chapter I`;

  const chapterNav = document.createElement('nav');
  chapterNav.className = 'chapter-nav';
  chapterNav.setAttribute('aria-label', 'Chapter navigation');
  chapterNav.innerHTML = `
    <div class="chapter-nav-header">
      <span class="chapter-nav-title">Contents</span>
      <button class="chapter-nav-close" aria-label="Close contents">&#x2715;</button>
    </div>
    <div class="chapter-nav-list">
      <p class="chapter-nav-loading">Loading contents&hellip;</p>
    </div>
  `;

  const chapterNavBackdrop = document.createElement('div');
  chapterNavBackdrop.className = 'chapter-nav-backdrop';

  document.body.append(progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn);
  return { progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn };
}

/* ─── Fetch & Render ────────────────────────────────────────────── */

async function fetchAndRenderBook(container, bookId) {
  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Loading book&hellip;</p>
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

  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Fetching book&hellip;</p>
      </div>
    </div>
  `;

  const htmlUrl = `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images.html`;
  let rawHtml = '';
  try {
    const res = await fetch(`https://gutenberg-proxy.devastator86.workers.dev/?url=${encodeURIComponent(htmlUrl)}`);
    if (!res.ok) throw new Error();
    rawHtml = await res.text();
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

  const bodyHtml = processGutenbergHtml(rawHtml, bookId);
  const savedPos = getStoredPosition(bookId);
  const percentComplete = Math.round((savedPos / 100000) * 1000) / 10;

  const bookData = {
    id: bookId,
    title,
    author: authorName,
    coverUrl,
    savedAt: Date.now(),
    position: savedPos,
    percentComplete,
  };

  renderShell(container, title, authorName, bodyHtml);

  const { progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn } = createFixedElements(savedPos);

  const article = container.querySelector('#reader-article');
  const chapterNavList = chapterNav.querySelector('.chapter-nav-list');
  const chapterNavClose = chapterNav.querySelector('.chapter-nav-close');

  // Build chapter nav after article is in DOM
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

  // Jump-to-chapter button: show if first chapter heading is not near the top
  const chapterPattern = /^(chapter|chap\.?\s*[ivxlcdm\d]|part\s+[ivxlcdm\d])/i;
  const firstChapterH2 = Array.from(article.querySelectorAll('h2[id]')).find(h =>
    chapterPattern.test(h.textContent.trim())
  );
  const allH2s = Array.from(article.querySelectorAll('h2[id]'));
  const firstChapterIndex = allH2s.indexOf(firstChapterH2);
  const hasPreamble = firstChapterH2 && firstChapterIndex > 0;
  if (hasPreamble) {
    const clone2 = firstChapterH2.cloneNode(true);
    clone2.querySelectorAll('img, .caption').forEach(el => el.remove());
    const label = clone2.textContent.trim().replace(/\s+/g, ' ').slice(0, 30);
    jumpBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${escapeHtml(label)}`;
    jumpBtn.classList.remove('hidden');
    jumpBtn.addEventListener('click', () => {
      firstChapterH2.scrollIntoView({ behavior: 'smooth', block: 'start' });
      jumpBtn.classList.add('hidden');
    });
    const hideJumpOnScroll = () => {
      if (firstChapterH2.getBoundingClientRect().top < window.innerHeight) {
        jumpBtn.classList.add('hidden');
        window.removeEventListener('scroll', hideJumpOnScroll);
      }
    };
    window.addEventListener('scroll', hideJumpOnScroll, { passive: true });
  }

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

  let scrollTimer = null;
  let lastPct = -1;
  function onScroll() {
    const pct = calcProgressPercent();
    if (Math.abs(pct - lastPct) >= 0.1) {
      progressBar.style.width = `${pct}%`;
      progressBar.setAttribute('aria-valuenow', pct.toFixed(1));
      lastPct = pct;
    }
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
      [progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn].forEach(el => el.remove());
      if (typeof hideSettingsSaveButton === 'function') hideSettingsSaveButton();
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('main-content'), { childList: true });

  if (typeof showSettingsSaveButton === 'function') {
    showSettingsSaveButton(bookData, () => upsertLibraryBook(bookData));
  }
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
