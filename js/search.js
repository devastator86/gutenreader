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

async function fetchBooks(query) {
  const url = new URL(GUTENDEX_BASE);
  url.searchParams.set('search', query);
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

function renderInitialState() {
  return `
    <div class="state-block">
      <div class="state-block-icon" aria-hidden="true">&#x1F50D;</div>
      <p class="state-block-body">Search 70,000+ free classic books.</p>
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
        <p class="search-hero-subtitle">Free books from Project Gutenberg.</p>
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

  const doSearch = debounce(async function (query) {
    query = query.trim();
    if (query === lastQuery) return;
    lastQuery = query;

    if (!query) {
      setStatus('');
      showResults(renderInitialState());
      return;
    }

    showResults(renderLoading());
    setStatus('');

    try {
      const data = await fetchBooks(query);

      if (query !== lastQuery) return;

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
    showResults(renderInitialState());
  });

  results.addEventListener('click', e => {
    const card = e.target.closest('.book-card');
    if (!card) return;
    window.location.hash = `reader/${card.dataset.id}`;
  });

  showResults(renderInitialState());
  input.focus();

  if (params && params.query) {
    input.value = params.query;
    updateClearBtn();
    doSearch(params.query);
  }
}
