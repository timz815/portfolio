(function () {
  // Add the progressive enhancement hook
  document.documentElement.classList.add('js');

  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = Array.from(tabs).map(tab =>
    document.getElementById(tab.getAttribute('aria-controls'))
  );

  // JS-only behavior: hide inactive panels
  panels.forEach((panel, index) => {
    tabs[index].tabIndex = tabs[index].getAttribute('aria-selected') === 'true' ? 0 : -1;
    if (tabs[index].getAttribute('aria-selected') === 'false') {
      panel.hidden = true;
    }
  });

  let exitTimer;
  let entranceTimer;
  const animationClasses = [
    'slide-out-left', 'slide-out-right', 'animating-in-right', 'animating-in-left'
  ];

  function switchTab(newTab) {
    const currentIndex = Array.from(tabs).findIndex(tab =>
      tab.getAttribute('aria-selected') === 'true'
    );
    const newIndex = Array.from(tabs).indexOf(newTab);
    if (newIndex === currentIndex) return;

    clearTimeout(exitTimer);
    clearTimeout(entranceTimer);
    panels.forEach(panel => panel.classList.remove(...animationClasses));

    // Selection is immediate, so another input always starts from current state.
    tabs.forEach((tab, index) => {
      tab.setAttribute('aria-selected', String(index === newIndex));
      tab.tabIndex = index === newIndex ? 0 : -1;
    });

    const currentPanel = panels.find(panel => !panel.hidden);
    const newPanel = panels[newIndex];
    // Reversing an unfinished exit returns to the panel still on screen.
    if (currentPanel === newPanel) return;
    const goingRight = newIndex > currentIndex;
    currentPanel.classList.add(goingRight ? 'slide-out-left' : 'slide-out-right');

    exitTimer = setTimeout(() => {
      panels.forEach(panel => {
        panel.hidden = panel !== newPanel;
        panel.classList.remove(...animationClasses);
      });
      newPanel.classList.add(goingRight ? 'animating-in-right' : 'animating-in-left');
      entranceTimer = setTimeout(() => {
        newPanel.classList.remove(...animationClasses);
      }, 300);
    }, 300);
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') === 'false') {
        switchTab(tab);
        tab.focus();
      }
    });

    tab.addEventListener('keydown', e => {
      let targetTab = null;

      if (e.key === 'ArrowRight') {
        targetTab = tabs[1];
      } else if (e.key === 'ArrowLeft') {
        targetTab = tabs[0];
      }

      if (targetTab && targetTab !== tab) {
        e.preventDefault();
        switchTab(targetTab);
        targetTab.focus();
      }
    });
  });
})();
