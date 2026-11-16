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
  const desktop = window.matchMedia('(min-width: 75rem)');
  const opening = document.querySelector('.project-page .intro-opening');
  const navigation = rail.querySelector('.project-chapters');
  let railOffset = 0;
  const baselineMarker = element => {
    if (!element) return null;
    // An empty inline block's bottom edge sits on the first text baseline.
    // Its zero dimensions preserve the text's size, line height, and wrapping.
    const marker = document.createElement('span');
    marker.className = 'project-baseline-marker';
    marker.setAttribute('aria-hidden', 'true');
    // Keep indentation before the marker so it cannot become a visible space
    // between the marker and the first word.
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      const start = text.textContent.search(/\S/);
      if (start < 0) continue;
      const range = document.createRange();
      range.setStart(text, start);
      range.collapse(true);
      range.insertNode(marker);
      break;
    }
    return marker;
  };
  const linkBaseline = baselineMarker(chapters[0].link);
  const openingBaseline = baselineMarker(opening);
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
    const centeredBaseline = linkBaseline.getBoundingClientRect().bottom - railOffset
      + layoutTop - rail.getBoundingClientRect().top;
    const openingTextBaseline = openingBaseline.getBoundingClientRect().bottom + window.scrollY;
    const progress = Math.min(1, Math.max(0, window.scrollY / 240));
    const eased = progress * progress * (3 - 2 * progress);
    railOffset = (openingTextBaseline - centeredBaseline) * (1 - eased);
    navigation.style.transform = `translateY(${railOffset}px)`;
  };
  let scheduled = false;
  const update = () => {
    scheduled = false;
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
    alignRail();
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
  document.fonts.addEventListener('loadingdone', schedule);
  // Re-align when either text size changes independently, including CSS edits.
  const sizeObserver = new ResizeObserver(schedule);
  sizeObserver.observe(chapters[0].link);
  if (opening) sizeObserver.observe(opening);
  update();
})();
