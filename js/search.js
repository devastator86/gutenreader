/* ─── Gutendex Search ───────────────────────────────────────────── */

const SVG_BOOK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`;
const SVG_WARN = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

const GUTENDEX_BASE = 'https://gutendex.com/books/';

function debounce(fn, delay) {
  let timer;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  }
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

function getTextUrl(formats) {
  return formats['text/plain; charset=utf-8']
    || formats['text/plain']
    || null;
}

function getCoverUrl(formats) {
  return formats['image/jpeg'] || null;
}

function getAuthorName(authors) {
  if (!authors || !authors.length) return 'Unknown author';
  return authors.map(a => a.name).join(', ');
}

function getBirthYear(authors) {
  if (!authors || !authors.length) return null;
  return authors[0].birth_year;
}

async function fetchBooks(query, params = {}) {
  const url = new URL(GUTENDEX_BASE);
  if (query) url.searchParams.set('search', query);
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.topic) url.searchParams.set('topic', params.topic);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

/* ─── Render Helpers ────────────────────────────────────────────── */

function renderLoading() {
  return `
    <div class="state-block" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-block-body">Searching Project Gutenberg…</p>
    </div>
  `;
}

function renderError(message) {
  return `
    <div class="state-block" role="alert">
      <div class="state-block-icon">${SVG_WARN}</div>
      <p class="state-block-title">Search failed</p>
      <p class="state-block-body">${message}</p>
    </div>
  `;
}

function renderEmpty(query) {
  return `
    <div class="state-block">
      <div class="state-block-icon">${SVG_BOOK}</div>
      <p class="state-block-title">No results for &#x201C;${escapeHtml(query)}&#x201D;</p>
      <p class="state-block-body">Try a different title, author, or keyword.</p>
    </div>
  `;
}

const GENRES = [
  { label: 'Fiction', topic: 'fiction' },
  { label: 'Mystery', topic: 'mystery' },
  { label: 'Science Fiction', topic: 'science fiction' },
  { label: 'Poetry', topic: 'poetry' },
  { label: 'Philosophy', topic: 'philosophy' },
  { label: 'History', topic: 'history' },
  { label: 'Romance', topic: 'love stories' },
  { label: 'Adventure', topic: 'adventure stories' },
];

const AUTHORS = [
  'Jane Austen', 'Charles Dickens', 'Mark Twain',
  'Leo Tolstoy', 'Arthur Conan Doyle', 'Oscar Wilde',
  'Edgar Allan Poe', 'H.G. Wells', 'Jules Verne',
];

function renderBookCardCompact(book) {
  const cover = getCoverUrl(book.formats);
  const author = getAuthorName(book.authors);

  const coverHtml = cover
    ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">`
    : `<div class="book-cover-placeholder" aria-hidden="true">${SVG_BOOK}</div>`;

  return `
    <button
      class="book-card book-card--compact"
      data-id="${book.id}"
      data-title="${escapeHtml(book.title)}"
      data-author="${escapeHtml(author)}"
      data-cover="${cover ? escapeHtml(cover) : ''}"
      aria-label="Open ${escapeHtml(book.title)} by ${escapeHtml(author)}"
    >
      <div class="book-cover">${coverHtml}</div>
      <span class="book-title">${escapeHtml(book.title)}</span>
    </button>
  `;
}

function renderDiscovery() {
  const genreChips = GENRES.map(g =>
    `<button class="discovery-chip" data-type="genre" data-topic="${escapeHtml(g.topic)}">${escapeHtml(g.label)}</button>`
  ).join('');

  const authorChips = AUTHORS.map(a =>
    `<button class="discovery-chip" data-type="author" data-query="${escapeHtml(a)}">${escapeHtml(a)}</button>`
  ).join('');

  return `
    <div class="discovery">
      <section class="discovery-section">
        <div class="discovery-section-header">
          <h2 class="discovery-title">Most popular</h2>
          <button class="discovery-books-arrow hidden" id="popular-arrow-left" aria-label="Scroll left">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="discovery-books-arrow hidden" id="popular-arrow-right" aria-label="Scroll right">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="discovery-books-wrap">
          <div class="discovery-books" id="popular-books">
            <div class="state-block" role="status" aria-label="Loading popular books">
              <div class="spinner" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </section>
      <section class="discovery-section">
        <h2 class="discovery-title">Browse by genre</h2>
        <div class="discovery-chips">${genreChips}</div>
      </section>
      <section class="discovery-section">
        <h2 class="discovery-title">Popular authors</h2>
        <div class="discovery-chips">${authorChips}</div>
      </section>
    </div>
  `;
}

function renderBookCard(book) {
  const cover = getCoverUrl(book.formats);
  const author = getAuthorName(book.authors);
  const year = getBirthYear(book.authors);
  const textUrl = getTextUrl(book.formats);

  const coverHtml = cover
    ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">`
    : `<div class="book-cover-placeholder" aria-hidden="true">${SVG_BOOK}</div>`;

  return `
    <button
      class="book-card"
      data-id="${book.id}"
      data-title="${escapeHtml(book.title)}"
      data-author="${escapeHtml(author)}"
      data-cover="${cover ? escapeHtml(cover) : ''}"
      data-text-url="${textUrl ? escapeHtml(textUrl) : ''}"
      aria-label="Open ${escapeHtml(book.title)} by ${escapeHtml(author)}"
    >
      <div class="book-cover">${coverHtml}</div>
      <div class="book-meta">
        <span class="book-title">${escapeHtml(book.title)}</span>
        <span class="book-author">${escapeHtml(author)}</span>
        ${year ? `<span class="book-year">b. ${year}</span>` : ''}
      </div>
    </button>
  `;
}

function renderResults(books) {
  return `
    <div class="book-grid" role="list">
      ${books.map(book => `<div role="listitem">${renderBookCard(book)}</div>`).join('')}
    </div>
  `;
}

/* ─── Search View Init ──────────────────────────────────────────── */

function initSearch(container, params) {
  container.innerHTML = `
    <div class="search-view">
      <div class="search-hero">
        <h1 class="search-hero-title">Classic literature,<br>beautifully read.</h1>
        <p class="search-hero-subtitle">Read 70,000+ free classic books from Project Gutenberg.</p>
      </div>
      <form class="search-form" role="search" aria-label="Search books">
        <label for="search-input" class="visually-hidden">Search books</label>
        <input
          type="search"
          class="search-input"
          id="search-input"
          placeholder="Search by title, author, or keyword…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        >
        <button type="button" class="search-clear" aria-label="Clear search">&#x2715;</button>
      </form>
      <div class="search-status" id="search-status" aria-live="polite" aria-atomic="true"></div>
      <div id="search-results"></div>
    </div>
  `;

  const input = container.querySelector('#search-input');
  const clearBtn = container.querySelector('.search-clear');
  const status = container.querySelector('#search-status');
  const results = container.querySelector('#search-results');

  let lastQuery = '';

  function updateClearBtn() {
    clearBtn.classList.toggle('visible', input.value.length > 0);
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function showResults(html) {
    results.innerHTML = html;
  }

  let nextPageUrl = null;
  let shownCount = 0;
  let totalCount = 0;

  function updateStatus() {
    if (shownCount > 0) {
      setStatus(
        shownCount < totalCount
          ? `Showing ${shownCount} of ${totalCount.toLocaleString()} results`
          : `${totalCount.toLocaleString()} result${totalCount !== 1 ? 's' : ''}`
      );
    }
  }

  function appendResults(books) {
    const grid = results.querySelector('.book-grid');
    if (!grid) return;
    const frag = document.createDocumentFragment();
    books.forEach(book => {
      const div = document.createElement('div');
      div.setAttribute('role', 'listitem');
      div.innerHTML = renderBookCard(book);
      frag.appendChild(div);
    });
    grid.appendChild(frag);
  }

  function renderLoadMore() {
    const existing = results.querySelector('.search-load-more');
    if (existing) existing.remove();
    if (!nextPageUrl) return;
    const btn = document.createElement('button');
    btn.className = 'search-load-more';
    btn.textContent = 'Load more';
    btn.addEventListener('click', async () => {
      btn.textContent = 'Loading…';
      btn.disabled = true;
      try {
        const res = await fetch(nextPageUrl);
        if (!res.ok) throw new Error();
        const data = await res.json();
        nextPageUrl = data.next || null;
        shownCount += data.results.length;
        appendResults(data.results);
        updateStatus();
        renderLoadMore();
      } catch {
        btn.textContent = 'Load more';
        btn.disabled = false;
      }
    });
    results.appendChild(btn);
  }

  const doSearch = debounce(async function (query, fetchParams = {}) {
    query = query.trim();
    const cacheKey = query + JSON.stringify(fetchParams);
    if (cacheKey === lastQuery) return;
    lastQuery = cacheKey;
    nextPageUrl = null;
    shownCount = 0;
    totalCount = 0;

    if (!query && !fetchParams.sort && !fetchParams.topic) {
      setStatus('');
      showDiscovery();
      return;
    }

    showResults(renderLoading());
    setStatus('');

    try {
      const data = await fetchBooks(query, fetchParams);

      if (cacheKey !== lastQuery) return;

      if (!data.results || data.results.length === 0) {
        setStatus('');
        showResults(renderEmpty(query));
        return;
      }

      nextPageUrl = data.next || null;
      shownCount = data.results.length;
      totalCount = data.count;
      updateStatus();
      showResults(renderResults(data.results));
      renderLoadMore();
    } catch (err) {
      showResults(renderError('Could not reach Gutendex. Check your connection and try again.'));
    }
  }, 300);

  function showDiscovery() {
    showResults(renderDiscovery());
    // Load popular books
    fetchBooks('', { sort: 'popular' }).then(data => {
      const el = results.querySelector('#popular-books');
      if (!el) return;
      if (!data.results || !data.results.length) {
        el.innerHTML = '';
        return;
      }
      const row = document.createElement('div');
      row.className = 'discovery-books-row';
      row.innerHTML = data.results.slice(0, 10).map(renderBookCardCompact).join('');
      el.innerHTML = '';
      el.appendChild(row);

      const arrowLeft = results.querySelector('#popular-arrow-left');
      const arrowRight = results.querySelector('#popular-arrow-right');
      const cardWidth = 100 + 16; // card width + gap

      function updateArrows() {
        const atStart = el.scrollLeft <= 4;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4;
        arrowLeft.classList.toggle('hidden', atStart);
        arrowRight.classList.toggle('hidden', atEnd);
      }

      arrowLeft.addEventListener('click', () => {
        el.scrollBy({ left: -cardWidth * 3, behavior: 'smooth' });
      });
      arrowRight.addEventListener('click', () => {
        el.scrollBy({ left: cardWidth * 3, behavior: 'smooth' });
      });
      el.addEventListener('scroll', updateArrows, { passive: true });
      updateArrows();
    }).catch(() => {
      const el = results.querySelector('#popular-books');
      if (el) el.innerHTML = '';
    });

    // Wire genre and author chips
    results.querySelectorAll('.discovery-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.dataset.type === 'genre') {
          doSearch.cancel();
          input.value = '';
          updateClearBtn();
          setStatus('');
          nextPageUrl = null;
          shownCount = 0;
          totalCount = 0;
          const genreKey = 'genre:' + chip.dataset.topic;
          lastQuery = genreKey;
          showResults(renderLoading());
          fetchBooks('', { topic: chip.dataset.topic }).then(data => {
            if (lastQuery !== genreKey) return;
            if (!data.results || !data.results.length) { showResults(renderEmpty(chip.textContent)); return; }
            nextPageUrl = data.next || null;
            shownCount = data.results.length;
            totalCount = data.count;
            updateStatus();
            showResults(renderResults(data.results));
            renderLoadMore();
          }).catch(() => showResults(renderError('Could not reach Gutendex.')));
        } else {
          input.value = chip.dataset.query;
          updateClearBtn();
          lastQuery = '';
          doSearch(chip.dataset.query);
        }
      });
    });
  }

  input.addEventListener('input', () => {
    updateClearBtn();
    doSearch(input.value);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    input.focus();
    updateClearBtn();
    lastQuery = '';
    setStatus('');
    showDiscovery();
  });

  results.addEventListener('click', e => {
    const card = e.target.closest('.book-card');
    if (!card) return;
    window.location.hash = `reader/${card.dataset.id}`;
  });

  showDiscovery();
  input.focus();

  if (params && params.query) {
    input.value = params.query;
    updateClearBtn();
    doSearch(params.query);
  }
}
