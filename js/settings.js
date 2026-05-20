/* ─── Settings ──────────────────────────────────────────────────── */

const SETTINGS_DEFAULTS = {
  theme: 'sepia',
  fontSize: 'normal',
  font: 'serif',
  lineWidth: 'normal',
};

function getPrefs() {
  try {
    return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem('gutenreader_prefs') || '{}') };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  try {
    localStorage.setItem('gutenreader_prefs', JSON.stringify(prefs));
  } catch { /* storage unavailable */ }
  if (typeof applyPrefs === 'function') applyPrefs();
}

/* ─── Focus trap ────────────────────────────────────────────────── */

function trapFocus(container) {
  const focusable = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function getFocusable() {
    return Array.from(container.querySelectorAll(focusable)).filter(el => !el.closest('[hidden]'));
  }
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const els = getFocusable();
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0];
    const last = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

/* ─── Settings Panel ────────────────────────────────────────────── */

let _settingsTrapCleanup = null;

function createSettingsPanel() {
  const existing = document.getElementById('settings-panel');
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = 'settings-panel';
  panel.className = 'settings-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Settings');
  panel.setAttribute('aria-modal', 'true');

  const prefs = getPrefs();

  panel.innerHTML = `
    <div class="settings-backdrop" id="settings-backdrop"></div>
    <div class="settings-drawer">
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="settings-close" id="settings-close" aria-label="Close settings">&#x2715;</button>
      </div>
      <div class="settings-body">

        <section class="settings-section">
          <h3 class="settings-section-title">Theme</h3>
          <div class="settings-option-group">
            <button class="settings-option-btn ${prefs.theme === 'light' ? 'active' : ''}" data-pref="theme" data-value="light">Light</button>
            <button class="settings-option-btn ${prefs.theme === 'sepia' ? 'active' : ''}" data-pref="theme" data-value="sepia">Sepia</button>
            <button class="settings-option-btn ${prefs.theme === 'dark' ? 'active' : ''}" data-pref="theme" data-value="dark">Dark</button>
          </div>
        </section>

        <section class="settings-section">
          <h3 class="settings-section-title">Text Size</h3>
          <div class="settings-option-group">
            <button class="settings-option-btn ${prefs.fontSize === 'small' ? 'active' : ''}" data-pref="fontSize" data-value="small">Small</button>
            <button class="settings-option-btn ${prefs.fontSize === 'normal' ? 'active' : ''}" data-pref="fontSize" data-value="normal">Normal</button>
            <button class="settings-option-btn ${prefs.fontSize === 'large' ? 'active' : ''}" data-pref="fontSize" data-value="large">Large</button>
          </div>
        </section>

        <section class="settings-section">
          <h3 class="settings-section-title">Font</h3>
          <div class="settings-option-group">
            <button class="settings-option-btn ${prefs.font === 'serif' ? 'active' : ''}" data-pref="font" data-value="serif" style="font-family: 'Lora', serif">Serif</button>
            <button class="settings-option-btn ${prefs.font === 'sans' ? 'active' : ''}" data-pref="font" data-value="sans" style="font-family: 'DM Sans', sans-serif">Sans-serif</button>
          </div>
        </section>

        <section class="settings-section">
          <h3 class="settings-section-title">Line Width</h3>
          <div class="settings-option-group">
            <button class="settings-option-btn ${prefs.lineWidth === 'narrow' ? 'active' : ''}" data-pref="lineWidth" data-value="narrow">Narrow</button>
            <button class="settings-option-btn ${prefs.lineWidth === 'normal' ? 'active' : ''}" data-pref="lineWidth" data-value="normal">Normal</button>
            <button class="settings-option-btn ${prefs.lineWidth === 'wide' ? 'active' : ''}" data-pref="lineWidth" data-value="wide">Wide</button>
          </div>
        </section>

        <section class="settings-section" id="settings-save-section" style="display:none">
          <h3 class="settings-section-title">This book</h3>
          <button class="settings-option-btn" id="settings-save-book" style="width:100%">Save to library</button>
        </section>

        <section class="settings-section settings-section--danger">
          <h3 class="settings-section-title">Data</h3>
          <button class="settings-danger-btn" id="settings-clear-library">Clear library</button>
          <button class="settings-danger-btn" id="settings-reset-prefs">Reset preferences</button>
        </section>

      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Option buttons
  panel.querySelectorAll('[data-pref]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pref;
      const value = btn.dataset.value;
      setPref(key, value);
      panel.querySelectorAll(`[data-pref="${key}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
      });
    });
  });

  function closePanel() {
    if (!panel.classList.contains('open')) return;
    panel.classList.remove('open');
    if (typeof popOverlay === 'function') popOverlay();
    else document.body.style.overflow = '';
    if (_settingsTrapCleanup) { _settingsTrapCleanup(); _settingsTrapCleanup = null; }
    const trigger = document.getElementById('settings-trigger');
    if (trigger) trigger.focus();
  }

  panel.querySelector('#settings-close').addEventListener('click', closePanel);
  panel.querySelector('#settings-backdrop').addEventListener('click', closePanel);

  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
  });

  // Clear library — confirm before destroying
  panel.querySelector('#settings-clear-library').addEventListener('click', () => {
    const btn = panel.querySelector('#settings-clear-library');
    if (btn.dataset.confirm === 'pending') {
      try { localStorage.removeItem('gutenreader_library'); } catch { /* unavailable */ }
      btn.textContent = 'Cleared';
      btn.dataset.confirm = '';
      // Refresh library view if currently visible
      if (typeof state !== 'undefined' && state.currentView === 'library') {
        const main = document.getElementById('main-content');
        if (main && typeof initLibrary === 'function') initLibrary(main);
      }
      setTimeout(() => { btn.textContent = 'Clear library'; }, 2000);
    } else {
      btn.textContent = 'Tap again to confirm';
      btn.dataset.confirm = 'pending';
      setTimeout(() => {
        if (btn.dataset.confirm === 'pending') {
          btn.textContent = 'Clear library';
          btn.dataset.confirm = '';
        }
      }, 3000);
    }
  });

  // Reset prefs — confirm before destroying
  panel.querySelector('#settings-reset-prefs').addEventListener('click', () => {
    const btn = panel.querySelector('#settings-reset-prefs');
    if (btn.dataset.confirm === 'pending') {
      try { localStorage.setItem('gutenreader_prefs', JSON.stringify(SETTINGS_DEFAULTS)); } catch { /* unavailable */ }
      if (typeof applyPrefs === 'function') applyPrefs();
      panel.querySelectorAll('[data-pref]').forEach(b => {
        b.classList.toggle('active', b.dataset.value === SETTINGS_DEFAULTS[b.dataset.pref]);
      });
      btn.textContent = 'Reset';
      btn.dataset.confirm = '';
      setTimeout(() => { btn.textContent = 'Reset preferences'; }, 2000);
    } else {
      btn.textContent = 'Tap again to confirm';
      btn.dataset.confirm = 'pending';
      setTimeout(() => {
        if (btn.dataset.confirm === 'pending') {
          btn.textContent = 'Reset preferences';
          btn.dataset.confirm = '';
        }
      }, 3000);
    }
  });

  return panel;
}

function showSettingsSaveButton(bookData, onSave) {
  const panel = createSettingsPanel();
  const section = panel.querySelector('#settings-save-section');
  const btn = panel.querySelector('#settings-save-book');
  if (!section || !btn) return;
  section.style.display = 'block';
  const alreadySaved = (() => {
    try {
      const lib = JSON.parse(localStorage.getItem('gutenreader_library') || '[]');
      return lib.some(b => b.id === bookData.id);
    } catch { return false; }
  })();
  btn.textContent = alreadySaved ? 'Saved' : 'Save to library';
  btn.classList.toggle('active', alreadySaved);
  btn._saveHandler && btn.removeEventListener('click', btn._saveHandler);
  btn._saveHandler = () => {
    onSave();
    btn.textContent = 'Saved';
    btn.classList.add('active');
  };
  btn.addEventListener('click', btn._saveHandler);
}

function hideSettingsSaveButton() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  const section = panel.querySelector('#settings-save-section');
  if (section) section.style.display = 'none';
}

function openSettingsPanel() {
  const panel = createSettingsPanel();
  if (panel.classList.contains('open')) return;
  panel.classList.add('open');
  if (typeof pushOverlay === 'function') pushOverlay();
  else document.body.style.overflow = 'hidden';
  _settingsTrapCleanup = trapFocus(panel);
  panel.querySelector('.settings-close').focus();
  const trigger = document.getElementById('settings-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

/* ─── Settings Trigger in Header ───────────────────────────────── */

function initSettings() {
  const nav = document.querySelector('.app-nav');
  if (!nav || document.getElementById('settings-trigger')) return;

  const btn = document.createElement('button');
  btn.id = 'settings-trigger';
  btn.className = 'nav-settings-btn';
  btn.setAttribute('aria-label', 'Open settings');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M14.5 9a5.54 5.54 0 01-.07.87l1.5 1.18a.36.36 0 01.08.46l-1.42 2.46a.36.36 0 01-.44.16l-1.77-.71a6.5 6.5 0 01-.75.43l-.27 1.88a.35.35 0 01-.35.3h-2.84a.35.35 0 01-.35-.3L7.46 13.8a6.5 6.5 0 01-.75-.43l-1.77.71a.36.36 0 01-.44-.16L3.08 11.5a.36.36 0 01.08-.46l1.5-1.18A5.72 5.72 0 014.6 9c0-.3.02-.59.07-.87L3.17 6.96a.36.36 0 01-.08-.46L4.51 4.04a.36.36 0 01.44-.16l1.77.71c.24-.16.49-.3.75-.43l.27-1.88A.35.35 0 018.09 2h2.84a.35.35 0 01.35.3l.27 1.88c.26.13.51.27.75.43l1.77-.71a.36.36 0 01.44.16l1.42 2.46a.36.36 0 01-.08.46l-1.5 1.18c.05.28.07.57.07.87z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  btn.addEventListener('click', openSettingsPanel);
  nav.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', initSettings);
