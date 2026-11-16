(() => {
  // Add project filenames here to enable the image-readiness notice.
  // Example: 'sewing-project.html', 'calendar-project.html'
  // An empty list disables the notice for every project.
  const projectsWithImageNotice = [];
  const project = window.location.pathname.split('/').pop();
  if (!projectsWithImageNotice.includes(project)) return;

  const popup = document.createElement('dialog');
  if (typeof popup.showModal !== 'function') return;
  popup.className = 'project-popup';
  popup.dataset.popupKey = `${project}-finishing-touches-seen`;
  popup.setAttribute('aria-labelledby', 'popup-title');
  popup.setAttribute('aria-describedby', 'popup-description');
  popup.innerHTML = `
    <h2 id="popup-title">Still getting picture-ready 👀</h2>
    <p id="popup-description">
      The write-up is ready but the visuals need a little more time! Feel free to poke around in the meantime.
    </p>
    <form method="dialog">
      <button type="submit" autofocus>Take a peek</button>
    </form>
  `;

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

  document.body.append(popup);
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
