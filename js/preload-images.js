(() => {
  // Keep the base artwork visible until its hover replacement is decoded,
  // including when navigation returns with the pointer already over a card.
  document.querySelectorAll('#works .card').forEach(card => {
    const base = card.querySelector('.card-image:not(.image-hover)');
    const hover = card.querySelector('.image-hover');
    base?.decode?.().catch(() => {});
    if (!hover) return;
    const prepareHover = async () => {
      try {
        if (hover.decode) await hover.decode();
        if (hover.complete && hover.naturalWidth > 0) {
          card.classList.add('has-hover-image');
        }
      } catch {
        // Failed artwork leaves the base image visible and the card usable.
      }
    };
    hover.addEventListener('load', prepareHover, { once: true });
    prepareHover();
  });

  const connection = navigator.connection;
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '')) return;

  // Only one speculative cross-page image: match About's exact URL so its
  // ordinary image request can reuse the browser cache on navigation.
  const aboutImage = new Image();
  aboutImage.fetchPriority = 'low';
  aboutImage.decoding = 'async';
  aboutImage.src = 'https://raw.githubusercontent.com/timz815/portfolio/refs/heads/main/media//duck.jpg';
  aboutImage.decode?.().catch(() => {});
})();
