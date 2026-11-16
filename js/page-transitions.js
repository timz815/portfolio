(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pages = new Set([
    'index.html', 'about.html', 'calendar-project.html',
    'sewing-project.html', 'translate-project.html', 'wrco-project.html'
  ]);
  let destination = null;
  let leaveTimer;
  let restoreTimer;
  let entranceTimer;

  function reset() {
    clearTimeout(leaveTimer);
    clearTimeout(restoreTimer);
    clearTimeout(entranceTimer);
    destination = null;
    root.classList.remove('page-entering', 'page-leaving');
  }

  function enter() {
    // The homepage already has its own first-visit entrance.
    if (reducedMotion.matches || window.homeIntroEntrance?.pending) return;
    root.classList.add('page-entering');
  }

  // Run from the head before content paints. Without JS, content stays visible.
  enter();
  document.addEventListener('DOMContentLoaded', () => {
    entranceTimer = setTimeout(() => root.classList.remove('page-entering'), 350);
  });

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') ||
        (link.target && link.target.toLowerCase() !== '_self')) return;

    const url = new URL(link.href);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (!pages.has(url.pathname.split('/').pop()) && !url.pathname.endsWith('/')) return;

    event.preventDefault();
    if (destination) return;
    destination = url.href;
    clearTimeout(entranceTimer);
    root.classList.remove('page-entering');
    root.classList.add('page-leaving');
    leaveTimer = setTimeout(() => {
      location.assign(destination);
      // Reveal the old page if loading stalls or navigation is canceled.
      restoreTimer = setTimeout(reset, 2000);
    }, 220);
  });

  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    reset();
    enter();
    entranceTimer = setTimeout(() => root.classList.remove('page-entering'), 350);
  });
})();
