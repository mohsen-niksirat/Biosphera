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

/** Return visible focusable descendants inside a container. */
function getFocusableElements(container) {
  if (!container) return [];
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');
  return Array.from(container.querySelectorAll(selector)).filter((el) => {
    if (el.hidden) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/** Show a modal backdrop and move focus into it. */
export function openModal(modal) {
  if (!modal) return;
  if (modal.style.display !== 'flex') {
    lastFocused = document.activeElement;
  }
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  const dialog = modal.querySelector('.modal-dialog') || modal;
  const focusables = getFocusableElements(dialog);
  const target = modal.querySelector('[autofocus]') ||
    modal.querySelector('.modal-body input:not([hidden]), .modal-body textarea:not([hidden]), .modal-body button:not([hidden]), .modal-footer button:not([hidden])') ||
    focusables[0] ||
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

/** Escape, backdrop clicks, and Tab focus trapping for open modals. */
export function setupModalDismissal() {
  const backdrops = Array.from(document.querySelectorAll('.modal-backdrop'));
  for (const backdrop of backdrops) {
    backdrop.setAttribute('aria-hidden', backdrop.style.display === 'flex' ? 'false' : 'true');
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  }

  document.addEventListener('keydown', (e) => {
    const open = backdrops.filter((m) => m.style.display === 'flex');
    if (open.length === 0) return;
    const topModal = open[open.length - 1];

    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal(topModal);
      return;
    }

    if (e.key === 'Tab') {
      const dialog = topModal.querySelector('.modal-dialog') || topModal;
      const focusables = getFocusableElements(dialog);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !dialog.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

function runInstrumentDialog({
  title = 'Confirm',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  showCancel = true,
  danger = false,
  inputValue = null
}) {
  const modal = document.getElementById('instrument-dialog');
  if (!modal) return Promise.resolve(false);

  const elTitle = document.getElementById('dialog-title');
  const elMsg = document.getElementById('dialog-message');
  const elInput = document.getElementById('dialog-input');
  const btnCancel = document.getElementById('dialog-cancel');
  const btnConfirm = document.getElementById('dialog-confirm');
  const btnClose = document.getElementById('dialog-close');

  if (elTitle) elTitle.textContent = title;
  if (elMsg) elMsg.textContent = message;

  if (elInput) {
    if (inputValue !== null) {
      elInput.hidden = false;
      elInput.value = inputValue;
    } else {
      elInput.hidden = true;
      elInput.value = '';
    }
  }

  if (btnCancel) {
    btnCancel.hidden = !showCancel;
    btnCancel.textContent = cancelLabel;
  }

  if (btnConfirm) {
    btnConfirm.textContent = confirmLabel;
    btnConfirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      btnConfirm?.removeEventListener('click', onConfirm);
      btnCancel?.removeEventListener('click', onCancel);
      btnClose?.removeEventListener('click', onCancel);
      modal.removeEventListener('modal:close', onModalClose);
      closeModal(modal);
      resolve(result);
    };

    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);
    const onModalClose = () => finish(false);

    btnConfirm?.addEventListener('click', onConfirm);
    btnCancel?.addEventListener('click', onCancel);
    btnClose?.addEventListener('click', onCancel);
    modal.addEventListener('modal:close', onModalClose);

    openModal(modal);
    if (elInput && !elInput.hidden) {
      requestAnimationFrame(() => elInput.select());
    }
  });
}

/** In-app confirmation dialog replacing window.confirm(). */
export function showConfirm(options) {
  return runInstrumentDialog({
    title: options.title || 'Confirm Action',
    message: options.message || '',
    confirmLabel: options.confirmLabel || 'Confirm',
    cancelLabel: options.cancelLabel || 'Cancel',
    showCancel: true,
    danger: Boolean(options.danger)
  });
}

/** In-app alert dialog replacing window.alert(). */
export function showAlert(options) {
  return runInstrumentDialog({
    title: options.title || 'Notice',
    message: options.message || '',
    confirmLabel: options.okLabel || 'OK',
    showCancel: false
  }).then(() => {});
}

/** In-app copyable text dialog replacing window.prompt() for read-only export strings. */
export function showCopyDialog(options) {
  return runInstrumentDialog({
    title: options.title || 'Copy Value',
    message: options.message || '',
    confirmLabel: options.okLabel || 'Done',
    showCancel: false,
    inputValue: options.value ?? ''
  }).then(() => {});
}

/** True when any modal is currently on screen (used to mute global hotkeys). */
export function isModalOpen() {
  return Array.from(document.querySelectorAll('.modal-backdrop'))
    .some((m) => m.style.display === 'flex');
}
