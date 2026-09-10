(() => {
  const chapters = [...document.querySelectorAll('.project-chapters a[href^="#"]')]
    .map(link => ({ link, target: document.getElementById(link.hash.slice(1)) }))
    .filter(chapter => chapter.target);
  if (!chapters.length) return;

  for (const chapter of chapters) {
    if (chapter.target.id !== 'intro') continue;
    chapter.link.href = '#top';
    chapter.link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', '#top');
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
      });
    });
  }

  const rail = document.querySelector('.project-rail');
  const layout = document.querySelector('.project-page > .main-divider');
  const content = layout.querySelector('.content-section');
  const hero = document.querySelector('.project-hero');
  const desktop = window.matchMedia('(min-width: 75rem)');
  const opening = document.querySelector('.project-page .intro-opening');
  const navigation = rail.querySelector('.project-chapters');
  let railOffset = 0;
  const firstTextTop = element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects()[0].top;
  };
  const alignRail = () => {
    if (!opening) return;
    if (!desktop.matches) {
      navigation.style.removeProperty('transform');
      railOffset = 0;
      return;
    }
    // Measure the centered link at the page's starting position, independent
    // of both its current translation and the sticky rail's scroll position.
    const layoutTop = layout.getBoundingClientRect().top + window.scrollY;
    const centeredTextTop = firstTextTop(chapters[0].link) - railOffset
      + layoutTop - rail.getBoundingClientRect().top;
    const openingTop = firstTextTop(opening) + window.scrollY;
    const progress = Math.min(1, Math.max(0, window.scrollY / 240));
    const eased = progress * progress * (3 - 2 * progress);
    railOffset = (openingTop - centeredTextTop) * (1 - eased);
    navigation.style.transform = `translateY(${railOffset}px)`;
  };
  const placeRail = () => {
    if (desktop.matches) layout.insertBefore(rail, content);
    else hero.before(rail);
  };
  placeRail();
  desktop.addEventListener('change', placeRail);

  let scheduled = false;
  const update = () => {
    scheduled = false;
    alignRail();
    let current = chapters[0].target.id === 'intro' ? chapters[0] : null;
    // Activate sections as their headings enter the upper third of the viewport.
    const activationTop = Math.max(112, window.innerHeight / 3);
    for (const chapter of chapters) {
      if (chapter.target.getBoundingClientRect().top <= activationTop) current = chapter;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = chapters[chapters.length - 1];
    }
    for (const chapter of chapters) {
      if (chapter === current) chapter.link.setAttribute('aria-current', 'location');
      else chapter.link.removeAttribute('aria-current');
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('load', schedule);
  window.addEventListener('pageshow', schedule);
  document.fonts.ready.then(schedule);
  update();
})();
