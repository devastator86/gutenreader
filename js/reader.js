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

        <article class="reader-article" id="reader-article">
          ${bodyHtml}
        </article>
      </div>
    </div>
  `;
}

function createFixedElements(savedPos) {
  const percentComplete = Math.round((savedPos / 100000) * 1000) / 10;

  const progressBar = document.createElement('div');
  progressBar.className = 'reader-progress-bar';
  progressBar.id = 'reader-progress-bar';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-label', 'Reading progress');
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

  const timeLabel = document.createElement('div');
  timeLabel.className = 'reader-time-label';
  timeLabel.id = 'reader-time-label';
  timeLabel.setAttribute('aria-hidden', 'true');

  document.body.append(progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn, timeLabel);
  return { progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn, timeLabel };
}

/* ─── Overlay stack tracker (shared with settings) ─────────────── */

let _overlayCount = 0;

function pushOverlay() {
  _overlayCount++;
  document.body.style.overflow = 'hidden';
}

function popOverlay() {
  _overlayCount = Math.max(0, _overlayCount - 1);
  if (_overlayCount === 0) document.body.style.overflow = '';
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
          <div class="state-block-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <p class="state-block-title">Could not load book</p>
          <p class="state-block-body">Check your connection and try again.</p>
          <button class="btn-retry" onclick="fetchAndRenderBook(document.getElementById('main-content'), ${bookId})">Try again</button>
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
          <div class="state-block-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <p class="state-block-title">Could not fetch book</p>
          <p class="state-block-body">Check your connection and try again.</p>
          <button class="btn-retry" onclick="fetchAndRenderBook(document.getElementById('main-content'), ${bookId})">Try again</button>
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

  const { progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn, timeLabel } = createFixedElements(savedPos);

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
        // Save immediately — user may not scroll after jumping to a chapter
        setTimeout(() => {
          const offset = calcScrollOffset();
          savePosition(bookId, offset);
          const pct2 = Math.round((offset / 100000) * 1000) / 10;
          upsertLibraryBook({ ...bookData, position: offset, percentComplete: pct2, savedAt: Date.now() });
        }, 600);
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
    // Hide once the heading has scrolled past the top of the viewport
    const hideJumpOnScroll = () => {
      if (firstChapterH2.getBoundingClientRect().top < 0) {
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
    pushOverlay();
  }

  function closeNav() {
    if (!chapterNav.classList.contains('open')) return;
    chapterNav.classList.remove('open');
    chapterNavBackdrop.classList.remove('visible');
    contentsBtn.setAttribute('aria-expanded', 'false');
    popOverlay();
  }

  contentsBtn.addEventListener('click', () => chapterNav.classList.contains('open') ? closeNav() : openNav());
  chapterNavClose.addEventListener('click', closeNav);
  chapterNavBackdrop.addEventListener('click', closeNav);

  // Restore scroll position after images have loaded to get accurate page height
  if (savedPos > 0) {
    // First rough restore so the user isn't left at the top while images load
    requestAnimationFrame(() => scrollToOffset(savedPos));
    // Then do a precise restore once layout settles
    const imgs = Array.from(article.querySelectorAll('img'));
    if (imgs.length > 0) {
      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded >= imgs.length) scrollToOffset(savedPos);
      };
      imgs.forEach(img => {
        if (img.complete) { loaded++; }
        else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); }
      });
      if (loaded >= imgs.length) scrollToOffset(savedPos);
    }
  }

  const totalChars = article.textContent.length;
  const charsPerMin = 1500;

  let scrollTimer = null;
  let lastPct = -1;
  function onScroll() {
    const pct = calcProgressPercent();
    if (Math.abs(pct - lastPct) >= 0.1) {
      progressBar.style.width = `${pct}%`;
      progressBar.setAttribute('aria-valuenow', pct.toFixed(1));
      lastPct = pct;

      const remaining = totalChars * (1 - pct / 100);
      const minsLeft = Math.round(remaining / charsPerMin);
      if (pct >= 1 && minsLeft > 0) {
        timeLabel.textContent = minsLeft < 60
          ? `~${minsLeft} min left`
          : `~${Math.round(minsLeft / 60)} hr left`;
        timeLabel.classList.add('visible');
      } else {
        timeLabel.classList.remove('visible');
      }
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

  function cleanupReader() {
    window.removeEventListener('scroll', onScroll);
    clearTimeout(scrollTimer);
    // Force close nav before removing — ensures overlay counter is balanced
    closeNav();
    [progressBar, contentsBtn, chapterNav, chapterNavBackdrop, jumpBtn, timeLabel].forEach(el => {
      if (el.parentNode) el.remove();
    });
    if (typeof hideSettingsSaveButton === 'function') hideSettingsSaveButton();
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById('reader-view')) {
      cleanupReader();
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
