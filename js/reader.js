/* placeholder — implemented in feature/reader */
function initReader(container, params) {
  container.innerHTML = `
    <div class="reader-view">
      <div class="state-block">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-block-body">Loading book…</p>
      </div>
    </div>
  `;
}
