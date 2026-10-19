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
    if (seeking || progress.matches(':hover') || seek.matches(':focus-visible:not(.pointer-focused)')) return;
    progressHideTimer = setTimeout(() => {
      if (!seeking && !progress.matches(':hover') && !seek.matches(':focus-visible:not(.pointer-focused)')) {
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
    if (!mouseControls.matches || video.paused || seeking || stage.matches(':hover') || stage.querySelector(':focus-visible:not(.pointer-focused)')) return;
    hideTimer = setTimeout(() => {
      if (!video.paused && !seeking && !stage.matches(':hover') && !stage.querySelector(':focus-visible:not(.pointer-focused)')) {
        figure.classList.add('controls-hidden');
      }
    }, 500);
  };
  stage.addEventListener('pointerenter', showControls);
  stage.addEventListener('pointerleave', scheduleHide);
  stage.addEventListener('focusin', showControls);
  stage.addEventListener('focusout', () => setTimeout(scheduleHide, 0));
  let progressFrame;
  let displayedTime = video.currentTime;
  const hasVideoFrames = typeof video.requestVideoFrameCallback === 'function';
  const updateProgress = (playbackTime = displayedTime) => {
    displayedTime = playbackTime;
    const fraction = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(1, Math.max(0, playbackTime / video.duration)) : 0;
    progressFill.style.transform = `scaleX(${fraction})`;
    progress.classList.toggle('is-near-start', fraction < 0.02);
    if (!seeking && pendingSeek === null) seek.value = fraction * 100;
    seek.setAttribute('aria-valuetext', `${Math.round(playbackTime)} seconds`);
  };
  const requestSeek = () => {
    const fraction = Number(seek.value) / 100;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      pendingSeek = null;
      updateProgress(fraction * video.duration);
      video.currentTime = fraction * video.duration;
    } else {
      pendingSeek = fraction;
      progressFill.style.transform = `scaleX(${fraction})`;
      progress.classList.toggle('is-near-start', fraction < 0.02);
      if (video.networkState === video.NETWORK_EMPTY) video.load();
    }
  };
  let seekPointer = null;
  let lastPointerValue = null;
  const seekFromPointer = (event) => {
    const bounds = progress.getBoundingClientRect();
    if (!bounds.width) return;
    seek.value = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * 100;
    const value = Number(seek.value);
    if (value === lastPointerValue) return;
    lastPointerValue = value;
    requestSeek();
  };
  // Own mouse, touch and pen dragging consistently, without the native range
  // drag competing with pointer capture on WebKit.
  progress.addEventListener('pointerdown', (event) => {
    if (seekPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    seekPointer = event.pointerId;
    lastPointerValue = null;
    seeking = true;
    seek.classList.add('pointer-focused');
    seek.focus({ preventScroll: true });
    showProgress();
    showControls();
    progress.classList.add('is-seeking');
    progress.setPointerCapture(event.pointerId);
    seekFromPointer(event);
  });
  progress.addEventListener('pointermove', (event) => {
    if (event.pointerId !== seekPointer) return;
    event.preventDefault();
    seekFromPointer(event);
  });
  const finishSeeking = (event) => {
    if (event.pointerId !== seekPointer) return;
    if (event.type === 'pointerup') seekFromPointer(event);
    seekPointer = null;
    seeking = false;
    if (progress.hasPointerCapture(event.pointerId)) progress.releasePointerCapture(event.pointerId);
    scheduleProgressHide();
    progress.classList.remove('is-seeking');
    updateProgress();
    scheduleHide();
    updateToggleVisibility();
  };
  progress.addEventListener('pointerup', finishSeeking);
  progress.addEventListener('pointercancel', finishSeeking);
  progress.addEventListener('lostpointercapture', finishSeeking);
  // Native range input remains available for keyboard and assistive technology.
  seek.addEventListener('input', requestSeek);
  seek.addEventListener('keydown', () => seek.classList.remove('pointer-focused'));
  seek.addEventListener('blur', () => seek.classList.remove('pointer-focused'));
  video.addEventListener('loadedmetadata', () => {
    if (pendingSeek !== null && Number.isFinite(video.duration)) {
      const target = pendingSeek * video.duration;
      pendingSeek = null;
      updateProgress(target);
      video.currentTime = target;
    }
  });
  // Follow presented frames so Safari's currentTime updates cannot freeze the
  // bar while the video itself keeps moving. Older browsers use the original loop.
  const animateProgress = (now, frame) => {
    if (!video.seeking && !seeking && (frame || !hasVideoFrames)) {
      updateProgress(frame ? frame.mediaTime : video.currentTime);
    }
    if (!video.paused) {
      progressFrame = hasVideoFrames
        ? video.requestVideoFrameCallback(animateProgress)
        : requestAnimationFrame(animateProgress);
    }
  };
  const stopProgress = () => {
    if (hasVideoFrames) video.cancelVideoFrameCallback(progressFrame);
    else cancelAnimationFrame(progressFrame);
  };
  video.addEventListener('play', () => {
    stopProgress();
    animateProgress();
  });
  video.addEventListener('pause', () => {
    stopProgress();
    updateProgress();
  });
  video.addEventListener('timeupdate', () => {
    if ((!hasVideoFrames || video.paused) && !video.seeking && !seeking) updateProgress(video.currentTime);
  });
  // Discard callbacks queued before a seek. Keep the requested position on
  // release until a frame from the completed seek supplies the new media time.
  video.addEventListener('seeking', stopProgress);
  video.addEventListener('seeked', () => {
    stopProgress();
    if (video.paused) updateProgress(video.currentTime);
    else animateProgress();
  });
  video.addEventListener('loadedmetadata', () => updateProgress());
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
