/**
 * Biosphera - Small DOM helpers for the instrument chrome.
 *
 * The v2 markup gives every action button an inline <svg class="icon"> plus a
 * .btn-label span. Writing `button.innerText = ...` destroys both, so all
 * label and state updates go through these helpers instead.
 */

/** Swap the icon of a button that contains `<svg class="icon"><use href="#..."/></svg>`. */
export function setIcon(button, symbolId) {
  if (!button) return;
  const use = button.querySelector('svg.icon use');
  if (!use) return;
  use.setAttribute('href', `#${symbolId}`);
}

/** Update only the text label, leaving the icon intact. */
export function setLabel(button, text) {
  if (!button) return;
  const label = button.querySelector('.btn-label');
  if (label) {
    label.textContent = text;
    return;
  }
  // Fallback for simple buttons with no dedicated label span
  button.textContent = text;
}

/** Reflect an on/off state for assistive tech. */
export function setPressed(element, pressed) {
  if (!element) return;
  element.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

let lastFocused = null;

/** Show a modal backdrop and move focus into it. */
export function openModal(modal) {
  if (!modal) return;
  lastFocused = document.activeElement;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  const target = modal.querySelector('[autofocus]') ||
    modal.querySelector('.modal-body input, .modal-body button, .modal-footer button') ||
    modal.querySelector('.modal-header .btn-icon');
  if (target) {
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }
}

/**
 * Close a modal and notify its owner through a `modal:close` event, so
 * modules with running animation loops can clean up on Escape or backdrop
 * clicks as well as on their own close button.
 */
export function closeModal(modal) {
  if (!modal || modal.style.display === 'none') return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  modal.dispatchEvent(new CustomEvent('modal:close'));
  if (lastFocused && typeof lastFocused.focus === 'function') {
    const el = lastFocused;
    lastFocused = null;
    requestAnimationFrame(() => el.focus({ preventScroll: true }));
  }
}

/** Escape and backdrop clicks dismiss whichever modal is on top. */
export function setupModalDismissal() {
  const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
  for (const backdrop of backdrops) {
    backdrop.setAttribute('aria-hidden', backdrop.style.display === 'flex' ? 'false' : 'true');
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = backdrops.filter((m) => m.style.display !== 'none');
    if (open.length === 0) return;
    e.preventDefault();
    closeModal(open[open.length - 1]);
  });
}

/** True when any modal is currently on screen (used to mute global hotkeys). */
export function isModalOpen() {
  return Array.from(document.querySelectorAll('.modal-backdrop'))
    .some((m) => m.style.display === 'flex');
}
