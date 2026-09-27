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
  popup.addEventListener('click', event => {
    if (event.target !== popup) return;
    const bounds = popup.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) {
      popup.close();
    }
  });
  window.addEventListener('pagehide', () => popup.close());
})();
