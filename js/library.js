/* ─── Library ───────────────────────────────────────────────────── */

const SVG_BOOK_LIB = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`;

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

function removeFromLibrary(bookId) {
  const library = getLibrary().filter(b => b.id !== bookId);
  saveLibrary(library);
}

/* ─── Render ────────────────────────────────────────────────────── */

function renderLibraryCard(book) {
  const pct = Math.min(100, Math.max(0, book.percentComplete || 0));
  const coverHtml = book.coverUrl
    ? `<img src="${escapeHtml(book.coverUrl)}" alt="" loading="lazy">`
    : `<div class="book-cover-placeholder" aria-hidden="true">${SVG_BOOK_LIB}</div>`;

  return `
    <div class="library-card" data-id="${book.id}">
      <button
        class="library-card-open book-card"
        data-id="${book.id}"
        aria-label="Open ${escapeHtml(book.title)}"
      >
        <div class="book-cover">${coverHtml}</div>
        <div class="book-meta">
          <span class="book-title">${escapeHtml(book.title)}</span>
          <span class="book-author">${escapeHtml(book.author || 'Unknown author')}</span>
          <span class="book-year library-progress-label">${pct > 0 ? `${pct.toFixed(0)}% read` : 'Not started'}</span>
        </div>
      </button>
      <div class="library-progress-bar" aria-hidden="true">
        <div class="library-progress-fill" style="width:${pct}%"></div>
      </div>
      <button
        class="library-remove-btn"
        data-id="${book.id}"
        aria-label="Remove ${escapeHtml(book.title)} from library"
        title="Remove from library"
      ><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11"/></svg></button>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="state-block">
      <div class="state-block-icon">${SVG_BOOK_LIB}</div>
      <p class="state-block-title">Your library is empty</p>
      <p class="state-block-body">Save books while reading and they'll appear here.</p>
    </div>
  `;
}

/* ─── Init ──────────────────────────────────────────────────────── */

function initLibrary(container) {
  const library = getLibrary();

  container.innerHTML = `
    <div class="search-view library-view">
      <div class="search-hero">
        <h1 class="search-hero-title">Your Library</h1>
        <p class="search-hero-subtitle">${library.length} saved book${library.length !== 1 ? 's' : ''}</p>
      </div>
      <div id="library-list">
        ${library.length > 0 ? `<div class="book-grid">${library.map(renderLibraryCard).join('')}</div>` : renderEmpty()}
      </div>
    </div>
  `;

  container.addEventListener('click', e => {
    const openBtn = e.target.closest('.library-card-open');
    if (openBtn) {
      window.location.hash = `reader/${openBtn.dataset.id}`;
      return;
    }

    const removeBtn = e.target.closest('.library-remove-btn');
    if (removeBtn) {
      const id = parseInt(removeBtn.dataset.id, 10);
      removeFromLibrary(id);

      const card = container.querySelector(`.library-card[data-id="${id}"]`);
      if (card) card.remove();

      const remaining = getLibrary();
      const subtitle = container.querySelector('.search-hero-subtitle');
      if (subtitle) subtitle.textContent = `${remaining.length} saved book${remaining.length !== 1 ? 's' : ''}`;

      const grid = container.querySelector('.book-grid');
      if (grid && !grid.children.length) {
        document.getElementById('library-list').innerHTML = renderEmpty();
      }
    }
  });
}
