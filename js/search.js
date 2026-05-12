/* ─── Gutendex Search ───────────────────────────────────────────── */

const GUTENDEX_BASE = 'https://gutendex.com/books/';

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
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
      <div class="state-block-icon" aria-hidden="true">&#x26A0;</div>
      <p class="state-block-title">Search failed</p>
      <p class="state-block-body">${message}</p>
    </div>
  `;
}

function renderEmpty(query) {
  return `
    <div class="state-block">
      <div class="state-block-icon" aria-hidden="true">&#x1F4DA;</div>
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
    : `<div class="book-cover-placeholder" aria-hidden="true">&#x1F4D6;</div>`;

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
        <h2 class="discovery-title">Most popular</h2>
        <div class="discovery-books" id="popular-books">
          <div class="state-block" role="status">
            <div class="spinner" aria-hidden="true"></div>
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBookCard(book) {
  const cover = getCoverUrl(book.formats);
  const author = getAuthorName(book.authors);
  const year = getBirthYear(book.authors);
  const textUrl = getTextUrl(book.formats);

  const coverHtml = cover
    ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">`
    : `<div class="book-cover-placeholder" aria-hidden="true">&#x1F4D6;</div>`;

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
        <input
          type="search"
          class="search-input"
          id="search-input"
          placeholder="Search by title, author, or keyword…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Search books"
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

  const doSearch = debounce(async function (query, fetchParams = {}) {
    query = query.trim();
    const cacheKey = query + JSON.stringify(fetchParams);
    if (cacheKey === lastQuery) return;
    lastQuery = cacheKey;

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

      const count = data.count;
      setStatus(
        count > data.results.length
          ? `Showing ${data.results.length} of ${count.toLocaleString()} results`
          : `${count.toLocaleString()} result${count !== 1 ? 's' : ''}`
      );
      showResults(renderResults(data.results));
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
    }).catch(() => {
      const el = results.querySelector('#popular-books');
      if (el) el.innerHTML = '';
    });

    // Wire genre and author chips
    results.querySelectorAll('.discovery-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.dataset.type === 'genre') {
          input.value = '';
          updateClearBtn();
          setStatus('');
          lastQuery = '';
          doSearch.cancel && doSearch.cancel();
          lastQuery = 'genre:' + chip.dataset.topic;
          showResults(renderLoading());
          fetchBooks('', { topic: chip.dataset.topic }).then(data => {
            if (!data.results || !data.results.length) { showResults(renderEmpty(chip.textContent)); return; }
            setStatus(`${data.count.toLocaleString()} results`);
            showResults(renderResults(data.results));
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
