(() => {
  const links = [...document.querySelectorAll('header a.nav-link')];
  const storageKey = 'portfolio-nav-pointer';
  let arrival;

  // Carry the pointer state across a full page load, where browsers may
  // not recompute :hover until the mouse moves again.
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    sessionStorage.removeItem(storageKey);
    if (saved && saved.href === location.href && Date.now() - saved.time < 10000) {
      arrival = links.find(link => link.href === saved.href);
      if (arrival && saved.keyboard) {
        arrival.focus({ preventScroll: true });
      } else if (arrival) {
        const box = arrival.getBoundingClientRect();
        if (saved.x >= box.left && saved.x <= box.right &&
            saved.y >= box.top && saved.y <= box.bottom) {
          arrival.classList.add('nav-link--arrival');
        }
      }
    }
  } catch { /* Hover and focus still work when storage is unavailable. */ }

  function clearArrival(event) {
    if (!arrival) return;
    if (event?.type === 'pointermove' && arrival.contains(event.target)) return;
    arrival.classList.remove('nav-link--arrival');
    arrival = null;
  }
  document.addEventListener('pointermove', clearArrival, { passive: true });
  document.addEventListener('pointerdown', clearArrival, { passive: true });
  document.addEventListener('keydown', clearArrival);
  window.addEventListener('blur', clearArrival);
  links.forEach(link => {
    link.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          href: link.href, x: event.clientX, y: event.clientY,
          keyboard: event.detail === 0, time: Date.now()
        }));
      } catch { /* Navigation does not depend on storage. */ }
    });
  });
})();
