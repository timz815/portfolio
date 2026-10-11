document.querySelectorAll('[data-local-video]').forEach((figure) => {
  const video = figure.querySelector('video');
  const videoLabel = video.getAttribute('aria-label') || 'video';
  const toggle = figure.querySelector('.local-video-toggle');
  const playIcon = toggle.querySelector('.local-video-play-icon');
  const pauseIcon = toggle.querySelector('.local-video-pause-icon');
  const status = figure.querySelector('[role="status"]');
  const progress = figure.querySelector('.local-video-progress');
  const progressFill = figure.querySelector('.local-video-progress-fill');
  const seek = figure.querySelector('.local-video-seek');
  let seeking = false;
  let pendingSeek = null;
  let progressHideTimer;
  const showProgress = () => {
    clearTimeout(progressHideTimer);
    progress.classList.add('progress-visible');
  };
  const scheduleProgressHide = () => {
    clearTimeout(progressHideTimer);
    if (seeking || progress.matches(':hover') || seek.matches(':focus-visible')) return;
    progressHideTimer = setTimeout(() => {
      if (!seeking && !progress.matches(':hover') && !seek.matches(':focus-visible')) {
        progress.classList.remove('progress-visible');
      }
    }, 500);
  };
  progress.addEventListener('pointerenter', showProgress);
  progress.addEventListener('pointerleave', scheduleProgressHide);
  seek.addEventListener('focusin', showProgress);
  seek.addEventListener('focusout', scheduleProgressHide);
  const stage = figure.querySelector('.local-video-stage');
  const mouseControls = window.matchMedia('(hover: hover) and (pointer: fine)');
  let toggleHideTimer;
  let inToggleCorner = false;
  const updateToggleVisibility = () => {
    clearTimeout(toggleHideTimer);
    figure.classList.remove('toggle-hidden');
    if (video.paused || !mouseControls.matches || inToggleCorner || toggle.matches(':focus-visible')) return;
    toggleHideTimer = setTimeout(() => {
      if (!video.paused && !inToggleCorner && !toggle.matches(':focus-visible')) figure.classList.add('toggle-hidden');
    }, 2000);
  };
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = stage.getBoundingClientRect();
    const nearCorner = event.clientX >= bounds.right - 80 && event.clientY <= bounds.top + 80;
    if (nearCorner !== inToggleCorner) {
      inToggleCorner = nearCorner;
      updateToggleVisibility();
    }
  });
  stage.addEventListener('pointerenter', updateToggleVisibility);
  stage.addEventListener('pointerleave', () => {
    inToggleCorner = false;
    if (!figure.classList.contains('toggle-hidden')) updateToggleVisibility();
  });
  toggle.addEventListener('focusin', updateToggleVisibility);
  toggle.addEventListener('focusout', updateToggleVisibility);
  let hideTimer;
  const showControls = () => {
    clearTimeout(hideTimer);
    figure.classList.remove('controls-hidden');
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    if (!mouseControls.matches || video.paused || seeking || stage.matches(':hover') || stage.querySelector(':focus-visible')) return;
    hideTimer = setTimeout(() => {
      if (!video.paused && !seeking && !stage.matches(':hover') && !stage.querySelector(':focus-visible')) {
        figure.classList.add('controls-hidden');
      }
    }, 500);
  };
  stage.addEventListener('pointerenter', showControls);
  stage.addEventListener('pointerleave', scheduleHide);
  stage.addEventListener('focusin', showControls);
  stage.addEventListener('focusout', () => setTimeout(scheduleHide, 0));
  let progressFrame;
  const updateProgress = () => {
    const fraction = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(1, Math.max(0, video.currentTime / video.duration)) : 0;
    progressFill.style.transform = `scaleX(${fraction})`;
    progress.classList.toggle('is-near-start', fraction < 0.02);
    if (!seeking && pendingSeek === null) seek.value = fraction * 100;
    seek.setAttribute('aria-valuetext', `${Math.round(video.currentTime)} seconds`);
  };
  seek.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') return;
    seeking = true;
    showProgress();
    showControls();
    progress.classList.add('is-seeking');
    seek.setPointerCapture(event.pointerId);
    if (video.readyState === 0) video.load();
  });
  const finishSeeking = () => {
    seeking = false;
    scheduleProgressHide();
    progress.classList.remove('is-seeking');
    updateProgress();
    scheduleHide();
    updateToggleVisibility();
  };
  let touchSeekPointer = null;
  const seekFromPointer = (event) => {
    const bounds = progress.getBoundingClientRect();
    seek.value = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100;
    seek.dispatchEvent(new Event('input'));
  };
  progress.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    touchSeekPointer = event.pointerId;
    seeking = true;
    showProgress();
    showControls();
    progress.classList.add('is-seeking');
    progress.setPointerCapture(event.pointerId);
    if (video.readyState === 0) video.load();
    seekFromPointer(event);
  });
  progress.addEventListener('pointermove', (event) => {
    if (event.pointerId !== touchSeekPointer) return;
    event.preventDefault();
    seekFromPointer(event);
  });
  const finishTouchSeeking = (event) => {
    if (event.pointerId !== touchSeekPointer) return;
    touchSeekPointer = null;
    finishSeeking();
  };
  progress.addEventListener('pointerup', finishTouchSeeking);
  progress.addEventListener('pointercancel', finishTouchSeeking);
  progress.addEventListener('lostpointercapture', finishTouchSeeking);
  seek.addEventListener('pointerup', finishSeeking);
  seek.addEventListener('pointercancel', finishSeeking);
  seek.addEventListener('lostpointercapture', finishSeeking);
  seek.addEventListener('input', () => {
    const fraction = Number(seek.value) / 100;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = fraction * video.duration;
      updateProgress();
    } else {
      pendingSeek = fraction;
      progressFill.style.transform = `scaleX(${fraction})`;
      progress.classList.toggle('is-near-start', fraction < 0.02);
      if (video.networkState === video.NETWORK_EMPTY) video.load();
    }
  });
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null && Number.isFinite(video.duration)) {
      video.currentTime = pendingSeek * video.duration;
      pendingSeek = null;
      updateProgress();
    }
  });
  const animateProgress = () => {
    updateProgress();
    if (!video.paused) progressFrame = requestAnimationFrame(animateProgress);
  };
  video.addEventListener('play', () => {
    cancelAnimationFrame(progressFrame);
    animateProgress();
  });
  video.addEventListener('pause', () => {
    cancelAnimationFrame(progressFrame);
    updateProgress();
  });
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('loadedmetadata', updateProgress);
  progress.hidden = false;
  seek.disabled = false;
  updateProgress();

  const sync = () => {
    const paused = video.paused;
    figure.classList.toggle('is-playing', !paused);
    playIcon.toggleAttribute('hidden', !paused);
    pauseIcon.toggleAttribute('hidden', paused);
    toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${videoLabel}`);
    scheduleHide();
    updateToggleVisibility();
  };

  const togglePlayback = async () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    try {
      await video.play();
      status.hidden = true;
    } catch {
      status.textContent = 'Unable to play this video. Please try again.';
      status.hidden = false;
      sync();
    }
  };
  toggle.addEventListener('click', togglePlayback);
  stage.addEventListener('click', (event) => {
    if (event.target.closest('.local-video-toggle, .local-video-progress')) return;
    togglePlayback();
  });
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || !stage.matches(':hover')) return;
    const target = event.target;
    if (target.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
    event.preventDefault();
    if (!event.repeat) togglePlayback();
  });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  video.addEventListener('ended', sync);
  video.controls = false;
  toggle.hidden = false;
  sync();

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
    });
    observer.observe(video);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
  });
});
