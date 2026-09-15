(() => {
  const popup = document.querySelector('dialog[data-popup-key]');
  if (!popup || typeof popup.showModal !== 'function') return;

  // Match the opening animation: refresh starts fresh, while navigation
  // back to this project within the same session skips the popup.
  const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  try {
    const key = popup.dataset.popupKey;
    if (!isReload && sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
  } catch {
    // The popup still works when browser storage is unavailable.
  }

  popup.showModal();
  window.addEventListener('pagehide', () => popup.close());
})();
