/* ─── State ─────────────────────────────────────────────────────── */

const state = {
  currentView: null,
  currentBookId: null,
};

/* ─── Prefs ─────────────────────────────────────────────────────── */

function loadPrefs() {
  try {
    const raw = localStorage.getItem('gutenreader_prefs');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem('gutenreader_prefs', JSON.stringify(prefs));
  } catch { /* storage unavailable */ }
}

function applyPrefs() {
  const prefs = loadPrefs();
  const root = document.documentElement;
  root.dataset.theme = prefs.theme || 'sepia';
  root.dataset.fontSize = prefs.fontSize || 'normal';
  root.dataset.font = prefs.font || 'serif';
  root.dataset.lineWidth = prefs.lineWidth || 'normal';
}

/* ─── Router ─────────────────────────────────────────────────────── */

function navigate(view, params = {}) {
  state.currentView = view;

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });

  const main = document.getElementById('main-content');
  main.innerHTML = '';

  if (view === 'search') {
    renderSearch(main, params);
  } else if (view === 'library') {
    renderLibrary(main);
  } else if (view === 'reader') {
    state.currentBookId = params.id;
    renderReader(main, params);
  }
}

function handleHashChange() {
  const hash = window.location.hash.slice(1);

  if (!hash || hash === 'search') {
    navigate('search');
    return;
  }

  if (hash === 'library') {
    navigate('library');
    return;
  }

  const readerMatch = hash.match(/^reader\/(\d+)$/);
  if (readerMatch) {
    navigate('reader', { id: parseInt(readerMatch[1], 10) });
    return;
  }

  navigate('search');
}

/* ─── Stubs (replaced by feature-specific files) ──────────────── */

function renderSearch(container, params) {
  if (typeof initSearch === 'function') {
    initSearch(container, params);
  }
}

function renderLibrary(container) {
  if (typeof initLibrary === 'function') {
    initLibrary(container);
  }
}

function renderReader(container, params) {
  if (typeof initReader === 'function') {
    initReader(container, params);
  }
}

/* ─── Init ──────────────────────────────────────────────────────── */

function init() {
  applyPrefs();
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}

document.addEventListener('DOMContentLoaded', init);
