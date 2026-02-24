(function () {
  // Add the progressive enhancement hook
  document.documentElement.classList.add('js');

  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = Array.from(tabs).map(tab =>
    document.getElementById(tab.getAttribute('aria-controls'))
  );

  // JS-only behavior: hide inactive panels
  panels.forEach((panel, index) => {
    if (tabs[index].getAttribute('aria-selected') === 'false') {
      panel.hidden = true;
    }
  });

  function switchTab(newTab) {
    const currentTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const currentPanel = document.getElementById(currentTab.getAttribute('aria-controls'));
    const newPanel = document.getElementById(newTab.getAttribute('aria-controls'));
    
    // Determine slide direction
    const currentIndex = Array.from(tabs).indexOf(currentTab);
    const newIndex = Array.from(tabs).indexOf(newTab);
    const goingRight = newIndex > currentIndex;
    
    // Slide out current panel
    currentPanel.classList.add(goingRight ? 'slide-out-left' : 'slide-out-right');
    
    // Wait for exit animation
    setTimeout(() => {
      // Update ARIA
      currentTab.setAttribute('aria-selected', 'false');
      newTab.setAttribute('aria-selected', 'true');
      
      // Hide old panel, reset its animation classes
      currentPanel.hidden = true;
      currentPanel.classList.remove('slide-out-left', 'slide-out-right');
      
      // Show new panel with entrance animation
      newPanel.hidden = false;
      newPanel.classList.add(goingRight ? 'animating-in-right' : 'animating-in-left');
      
      // Clean up animation class after it completes
      setTimeout(() => {
        newPanel.classList.remove('animating-in-right', 'animating-in-left');
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

// (function () {
//   // 1. Add the progressive enhancement hook
//   document.documentElement.classList.add('js');

//   const tabs = document.querySelectorAll('[role="tab"]');
//   const panels = Array.from(tabs).map(tab =>
//     document.getElementById(tab.getAttribute('aria-controls'))
//   );

//   // 2. JS-only behavior: hide inactive panels
//   panels.forEach((panel, index) => {
//     if (tabs[index].getAttribute('aria-selected') === 'false') {
//       panel.hidden = true;
//     }
//   });

//   function switchTab(newTab) {
//     const currentTab = document.querySelector(
//       '[role="tab"][aria-selected="true"]'
//     );

//     currentTab.setAttribute('aria-selected', 'false');
//     currentTab.tabIndex = -1;

//     newTab.setAttribute('aria-selected', 'true');
//     newTab.tabIndex = 0;

//     const currentPanel = document.getElementById(
//       currentTab.getAttribute('aria-controls')
//     );
//     const newPanel = document.getElementById(
//       newTab.getAttribute('aria-controls')
//     );

//     currentPanel.hidden = true;
//     newPanel.hidden = false;
//   }

//   tabs.forEach(tab => {
//     tab.addEventListener('click', () => {
//       if (tab.getAttribute('aria-selected') === 'false') {
//         switchTab(tab);
//         tab.focus();
//       }
//     });

//     tab.addEventListener('keydown', e => {
//       let targetTab = null;

//       if (e.key === 'ArrowRight') {
//         targetTab = tabs[1];
//       } else if (e.key === 'ArrowLeft') {
//         targetTab = tabs[0];
//       }

//       if (targetTab && targetTab !== tab) {
//         e.preventDefault();
//         switchTab(targetTab);
//         targetTab.focus();
//       }
//     });
//   });
// })();
