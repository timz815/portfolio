(() => {
const motionRoots = [...document.querySelectorAll('[data-motion-root]')];
// Preserve refresh as a fresh entrance; internal navigation uses the session flag.
const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
try {
  if (!isReload && sessionStorage.getItem('homeIntroSeen') === '1') return;
  // Every entry page consumes the intro opportunity for this session.
  sessionStorage.setItem('homeIntroSeen', '1');
} catch {
  // Storage may be disabled; the page and its entrance still work normally.
}
if (!motionRoots.length) return;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const INTRO_START_DELAY = 300;
const WORKS_ENTRANCE_DISTANCE = '2rem';
const WORKS_ENTRANCE_DELAY = 200;
const WORKS_ENTRANCE_DURATION = 2000;

function shouldReleaseTitleLayers() {
  // These optional browser hints are a conservative resource policy, not a
  // device benchmark. Missing hints preserve the normal, stable rendering path.
  const connection = navigator.connection;
  return (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 2) ||
    connection?.saveData === true ||
    ['slow-2g', '2g', '3g'].includes(connection?.effectiveType);
}
const works = document.querySelector('#works');
let hasLeftPage = false;
const stopMotions = new Set();
window.addEventListener('pagehide', () => {
  hasLeftPage = true;
  stopMotions.forEach(stop => stop());
  revealWorks(false);
  works?.getAnimations().forEach(animation => animation.cancel());
});
const worksMotionPreference = window.matchMedia(REDUCED_MOTION_QUERY);
if (works && document.querySelector('[data-motion-root]') &&
    Element.prototype.animate && !worksMotionPreference.matches) {
  works.classList.add('works-awaiting-intro');
}

function revealWorks(animate = true) {
  if (!works?.classList.contains('works-awaiting-intro')) return;
  works.classList.remove('works-awaiting-intro');
  if (!animate || worksMotionPreference.matches) return;
  // Animate the section wrapper so tab-panel transitions stay independent.
  try {
    const entrance = works.animate([
      { opacity: 0, transform: `translateY(${WORKS_ENTRANCE_DISTANCE})` },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      delay: WORKS_ENTRANCE_DELAY,
      duration: WORKS_ENTRANCE_DURATION,
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'backwards'
    });
    const stop = () => {
      if (worksMotionPreference.matches) entrance.cancel();
    };
    worksMotionPreference.addEventListener('change', stop);
    const cleanup = () => worksMotionPreference.removeEventListener('change', stop);
    entrance.finished.then(cleanup, cleanup);
  } catch {
    // The section remains visible if animation is unavailable.
  }
}

function unwrapWords(container) {
  container.querySelectorAll('.motion-intro__word').forEach(word => {
    const inner = word.firstElementChild;
    word.replaceWith(...inner.childNodes);
  });
  container.normalize();
}

// These word boxes own layout and remain after the entrance. Animation only
// changes their visual transforms; completion must never rebuild inline text.
// Whitespace stays inline so the browser can wrap between animated words.
function prepareWords(container, wholePhrase = false) {
  unwrapWords(container);
  const phrases = wholePhrase ? [container] : container.querySelectorAll('[data-animation]');
  for (const phrase of phrases) {
    const walker = document.createTreeWalker(phrase, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    let node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: text.length });
      text += node.textContent;
    }
    // Work backwards so extracting a word cannot invalidate earlier offsets.
    for (const match of [...text.matchAll(/\S+/gu)].reverse()) {
      const start = match.index;
      const end = start + match[0].length;
      const first = nodes.find(entry => entry.start + entry.node.length > start);
      const last = nodes.find(entry => entry.start + entry.node.length >= end);
      const range = document.createRange();
      range.setStart(first.node, start - first.start);
      range.setEnd(last.node, end - last.start);
      const word = document.createElement('span');
      word.className = 'motion-intro__word';
      const inner = document.createElement('span');
      inner.className = 'motion-intro__word-inner';
      inner.append(range.extractContents());
      word.append(inner);
      range.insertNode(word);
    }
  }
}

function wordGroups(flow) {
  const groups = [];
  for (const word of flow.querySelectorAll('.motion-intro__word')) {
    const phrase = word.closest('[data-animation]');
    const rect = word.getBoundingClientRect();
    let group = groups.at(-1);
    if (!group || group.style !== phrase.dataset.animation || Math.abs(group.top - rect.top) >= 1) {
      group = { style: phrase.dataset.animation, phrase, top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, words: [] };
      groups.push(group);
    }
    group.right = Math.max(group.right, rect.right);
    group.bottom = Math.max(group.bottom, rect.bottom);
    group.words.push({ word, rect });
  }
  return groups;
}

// Each word uses the group's pivot, expressed in that word's coordinates.
// Equal transforms therefore move a whole line fragment as one object without
// putting those words inside an unbreakable phrase box.
function groupOrigin(origin, group, rect) {
  const parts = origin.split(/\s+/);
  const position = (part, size) => {
    if (part === 'left' || part === 'top') return 0;
    if (part === 'right' || part === 'bottom') return size;
    if (!part || part === 'center') return size / 2;
    return part.endsWith('%') ? parseFloat(part) * size / 100 : parseFloat(part);
  };
  return `${group.left - rect.left + position(parts[0], group.right - group.left)}px ${group.top - rect.top + position(parts[1], group.bottom - group.top)}px`;
}

function initMotion(root) {
  const title = root.querySelector('.motion-intro__title');
  const flow = title?.querySelector('.motion-intro__title-flow');
  const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
  if (!flow || !Element.prototype.animate || reducedMotion.matches) {
    revealWorks(false);
    return;
  }

  let animations = [];
  let frame;
  let startedAt;
  let finished = false;
  let dirty = true;
  let resizeObserver;
  let mutationObserver;
  const supportingAnimations = [];

  const finish = (animateWorks = true) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    // Keep the visual handoff stable by default, but prioritize resources on
    // constrained devices/connections and when motion is interrupted.
    if (!animateWorks || shouldReleaseTitleLayers()) {
      animations.forEach(animation => animation.cancel());
      title.classList.remove('has-motion-layout');
    }
    supportingAnimations.forEach(animation => animation.cancel());
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    window.removeEventListener('resize', refresh);
    document.fonts?.removeEventListener('loadingdone', refresh);
    reducedMotion.removeEventListener('change', onMotionPreference);
    stopMotions.delete(stopMotion);
    // Word boxes stay in place on both paths so cleanup cannot change wrapping.
    title.classList.remove('is-animating');
    root.dataset.entrancePhase = '4';
    revealWorks(animateWorks);
  };
  const stopMotion = () => finish(false);
  stopMotions.add(stopMotion);

  const observeText = () => mutationObserver?.observe(flow, {
    childList: true, characterData: true, attributes: true, attributeFilter: ['data-animation'], subtree: true
  });

  const render = () => {
    if (finished) return;
    mutationObserver?.disconnect();
    animations.forEach(animation => animation.cancel());
    animations = [];
    try {
      if (dirty) {
        prepareWords(flow);
        // Keep the intrinsic preferred-line measurement on identical word metrics.
        title.querySelectorAll('.motion-intro__title-measure > span').forEach(phrase => prepareWords(phrase, true));
        dirty = false;
      }
      const groups = wordGroups(flow);
      if (!groups.length) return finish();
      const elapsed = startedAt === undefined ? 0 : performance.now() - startedAt;
      for (const [index, group] of groups.entries()) {
        const style = getComputedStyle(group.phrase);
        const value = name => style.getPropertyValue(name).trim();
        const milliseconds = name => {
          const time = value(name);
          return parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
        };
        const duration = milliseconds('--title-piece-entry-duration');
        const delay = INTRO_START_DELAY + milliseconds('--title-piece-entry-delay');
        for (const { word, rect } of group.words) {
          const inner = word.firstElementChild;
          word.dataset.motionGroup = index;
          word.style.transformOrigin = groupOrigin(value('--title-piece-transform-origin'), group, rect);
          inner.style.transformOrigin = groupOrigin(value('--animated-word-transform-origin'), group, rect);
          // Keep glyphs off filtered offscreen surfaces: blur combined with
          // nested 3D transforms can expose dark sampling edges between words.
          animations.push(word.animate([
            { opacity: 0, transform: value('--title-piece-entry-transform') },
            { opacity: 1, transform: 'translateZ(0)' }
          ], { duration, delay, easing: value('--title-piece-entry-easing'), fill: 'both' }));
          // Preserve the original 900ms inner motion, then hold its identity
          // transform until the outer bounce ends. Dropping the inner effect
          // while its parent is still moving makes Chrome re-rasterize glyphs.
          // Match the leading translateZ at both ends so scale/rotate keep
          // interpolating individually instead of becoming a decomposed matrix.
          const innerEntry = value('--animated-word-entry-transform');
          animations.push(inner.animate([
            { transform: innerEntry === 'none' ? 'translateZ(0)' : `translateZ(0) ${innerEntry}`, offset: 0, easing: value('--animated-word-entry-easing') },
            { transform: 'translateZ(0)', offset: Math.min(900, duration) / duration },
            { transform: 'translateZ(0)', offset: 1 }
          ], { duration, delay, easing: 'linear', fill: 'both' }));
        }
      }
      animations.forEach(animation => { animation.currentTime = elapsed; });
      title.classList.add('has-motion-layout', 'is-animating');
      startedAt ??= performance.now();
      settle(animations);
      observeText();
    } catch (error) {
      finish(false);
      console.warn('Title animation skipped:', error);
    }
  };

  async function settle(currentAnimations) {
    try {
      await Promise.all([...currentAnimations, ...supportingAnimations].map(animation => animation.finished));
      if (!finished && animations === currentAnimations) finish();
    } catch {
      // Reflow and reduced motion cancel obsolete effects.
    }
  }

  function refresh() {
    if (finished) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  }
  function onMotionPreference() {
    if (reducedMotion.matches) finish(false);
  }

  for (const [element, delay, duration, offset] of [
    [document.querySelector('#top'), 0, 450, '0rem'],
    [root.querySelector('.motion-intro__subtitle'), INTRO_START_DELAY + 860 + parseFloat(getComputedStyle(title).getPropertyValue('--intro-subtitle-entry-delay')), 700, '.625rem']
  ]) {
    if (element) supportingAnimations.push(element.animate(
      [{ opacity: 0, transform: `translateX(${offset})` }, { opacity: 1, transform: 'none' }],
      { duration, delay, easing: getComputedStyle(element).getPropertyValue('--supporting-content-easing').trim(), fill: 'backwards' }
    ));
  }
  render();
  if (finished) return;
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(title);
  }
  if ('MutationObserver' in window) {
    mutationObserver = new MutationObserver(() => { dirty = true; refresh(); });
    observeText();
  }
  window.addEventListener('resize', refresh, { passive: true });
  document.fonts?.addEventListener('loadingdone', refresh);
  reducedMotion.addEventListener('change', onMotionPreference);
}

const startMotion = () => {
  // A cached page must not start a delayed entrance when Back restores it.
  if (hasLeftPage) return;
  motionRoots.forEach(initMotion);
};
if (document.fonts?.ready) {
  document.fonts.ready.then(startMotion, startMotion);
} else {
  startMotion();
}


})();
