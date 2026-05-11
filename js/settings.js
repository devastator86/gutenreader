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

/* ─── Settings Panel ────────────────────────────────────────────── */

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

  // Close
  function closePanel() {
    panel.classList.remove('open');
    document.body.style.overflow = '';
    const trigger = document.getElementById('settings-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  panel.querySelector('#settings-close').addEventListener('click', closePanel);
  panel.querySelector('#settings-backdrop').addEventListener('click', closePanel);

  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePanel();
  });

  // Clear library
  panel.querySelector('#settings-clear-library').addEventListener('click', () => {
    try { localStorage.removeItem('gutenreader_library'); } catch { /* unavailable */ }
    panel.querySelector('#settings-clear-library').textContent = 'Cleared';
    setTimeout(() => {
      panel.querySelector('#settings-clear-library').textContent = 'Clear library';
    }, 2000);
  });

  // Reset prefs
  panel.querySelector('#settings-reset-prefs').addEventListener('click', () => {
    try { localStorage.setItem('gutenreader_prefs', JSON.stringify(SETTINGS_DEFAULTS)); } catch { /* unavailable */ }
    if (typeof applyPrefs === 'function') applyPrefs();
    panel.querySelectorAll('[data-pref]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === SETTINGS_DEFAULTS[btn.dataset.pref]);
    });
  });

  return panel;
}

function showSettingsSaveButton(bookData, onSave) {
  const panel = createSettingsPanel();
  const section = panel.querySelector('#settings-save-section');
  const btn = panel.querySelector('#settings-save-book');
  if (!section || !btn) return;
  section.style.display = '';
  btn.textContent = 'Save to library';
  btn.classList.remove('active');
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
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
  const trigger = document.getElementById('settings-trigger');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  panel.querySelector('.settings-close').focus();
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
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/>
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.42 1.42M13.36 13.36l1.42 1.42M3.22 14.78l1.42-1.42M13.36 4.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;
  btn.addEventListener('click', openSettingsPanel);
  nav.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', initSettings);
