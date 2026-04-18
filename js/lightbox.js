/* ====== LIGHTBOX ====== */
document.addEventListener('DOMContentLoaded', function() {
    const imageBoards = document.querySelectorAll('.image-board');
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxZoom = document.getElementById('lightbox-zoom');
    const lightboxContent = document.querySelector('.lightbox-content');
    const lightboxPrev = document.getElementById('lightbox-prev');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxPrevNav = document.getElementById('lightbox-prev-nav');
    const lightboxNextNav = document.getElementById('lightbox-next-nav');
    const lightboxControls = document.querySelector('.lightbox-controls');

    let currentIndex = 0;
    let currentImages = [];
    
    // Group images by their parent image-board
    const imageGroups = [];
    imageBoards.forEach(board => {
        const items = board.querySelectorAll('.image-item');
        if (items.length > 0) {
            const group = Array.from(items).map(item => ({
                src: item.querySelector('img').src,
                alt: item.querySelector('img').alt,
                element: item
            }));
            imageGroups.push({
                board: board,
                images: group
            });
        }
    });

    // Zoom & Pan State
    let isZoomed = false;
    let isDragging = false;
    let hasDragged = false;
    let startX, startY;
    let translateX = 0, translateY = 0; // Final clamped position
    let targetX = 0, targetY = 0; // Target position before clamping
    let needsUpdate = false;
    const DRAG_THRESHOLD = 5;
    
    // Cache dimensions to avoid constant getBoundingRect calls
    let cachedImgWidth = 0;
    let cachedImgHeight = 0;
    let naturalImgWidth = 0;
    let naturalImgHeight = 0;
    let preZoomScale = 1;
    let animationId = null;
    let liveScale = 1, liveTransX = 0, liveTransY = 0;

    function getZoomScale() {
        if (!cachedImgWidth || !naturalImgWidth) {
            return window.innerWidth <= 834 ? 1.5 : 1.7;
        }
        const factor = window.innerWidth <= 834 ? 1.5 : 1.7;
        // Scale relative to display size so zoom is consistent regardless of image resolution
        return (cachedImgWidth * factor) / naturalImgWidth;
    }

    function cacheDimensions() {
        const rect = lightboxImage.getBoundingClientRect();
        cachedImgWidth = rect.width;
        cachedImgHeight = rect.height;
        // Also store natural dimensions
        naturalImgWidth = lightboxImage.naturalWidth;
        naturalImgHeight = lightboxImage.naturalHeight;
    }

    function applyTransform() {
        if (!isZoomed) {
            lightboxImage.style.transform = '';
            needsUpdate = false;
            return;
        }

        const SCALE = getZoomScale();
        const imgWidth = naturalImgWidth * SCALE;
        const imgHeight = naturalImgHeight * SCALE;
        const vpWidth = window.innerWidth;
        const vpHeight = window.innerHeight;

        // Calculate max boundaries (how far we can pan)
        const maxX = Math.max((imgWidth - vpWidth) / 2, 0);
        const maxY = Math.max((imgHeight - vpHeight) / 2, 0);

        // Clamp to boundaries and STORE the clamped values
        translateX = Math.min(maxX, Math.max(-maxX, targetX));
        translateY = Math.min(maxY, Math.max(-maxY, targetY));

        // Apply transform
        lightboxImage.style.transform = 
            `translate(${translateX}px, ${translateY}px) scale(${SCALE})`;

        needsUpdate = false;
    }

    function requestTransformUpdate() {
        if (!needsUpdate) {
            needsUpdate = true;
            requestAnimationFrame(applyTransform);
        }
    }

    // Open lightbox
    imageGroups.forEach(group => {
        group.images.forEach((img, indexInGroup) => {
            img.element.addEventListener('click', () => {
                currentImages = group.images;
                currentIndex = indexInGroup;
                hasDragged = false;
                updateLightbox();
                lightbox.classList.add('active');
                enableFocusTrap();
                document.body.style.overflow = 'hidden';
                updateNavVisibility();
            });
        });
    });

    // Close lightbox
    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
    });

    // Navigation buttons
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isZoomed || currentImages.length <= 1) return;
            currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
            updateLightbox();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isZoomed || currentImages.length <= 1) return;
            currentIndex = (currentIndex + 1) % currentImages.length;
            updateLightbox();
        });
    }

    // Click background to close
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeLightbox();
        }
    });

    function closeLightbox() {
        if (isZoomed) resetZoom();
        lightboxImage.style.maxWidth = '';
        updateNavVisibility();
        lightbox.classList.remove('active');
        disableFocusTrap();
        document.body.style.overflow = '';
    }


    function toggleZoom() {
        isZoomed = !isZoomed;
        updateNavVisibility();

        if (isZoomed) {
            translateX = 0;
            translateY = 0;
            targetX = 0;
            targetY = 0;

            const alreadyZoomed = lightboxImage.classList.contains('is-zoomed');
            if (!alreadyZoomed) {
                cacheDimensions();
                preZoomScale = cachedImgWidth / naturalImgWidth;
            }
            const factor = window.innerWidth <= 834 ? 1.5 : 1.7;
            const SCALE = preZoomScale * factor;
            const startScale = alreadyZoomed ? liveScale : preZoomScale;
            const startX     = alreadyZoomed ? liveTransX : 0;
            const startY     = alreadyZoomed ? liveTransY : 0;

            lightboxImage.style.maxWidth = '';
            lightboxImage.classList.add('is-zoomed');
            lightboxImage.style.transform = `translate(${startX}px, ${startY}px) scale(${startScale})`;
            lightboxImage.style.cursor = 'grab';
            lightboxZoom.querySelector('span').textContent = 'zoom_out';

            animateZoom(startScale, SCALE, startX, startY, 0, 0);
        } else {
            const factor = window.innerWidth <= 834 ? 1.5 : 1.7;
            const SCALE = preZoomScale * factor;
            const wasAnimating = animationId !== null;
            const startScale = wasAnimating ? liveScale  : SCALE;
            const startX     = wasAnimating ? liveTransX : translateX;
            const startY     = wasAnimating ? liveTransY : translateY;

            translateX = 0;
            translateY = 0;
            targetX = 0;
            targetY = 0;

            lightboxImage.style.cursor = 'zoom-in';
            lightboxZoom.querySelector('span').textContent = 'zoom_in';

            animateZoom(startScale, preZoomScale, startX, startY, 0, 0, () => {
                lightboxImage.classList.remove('is-zoomed');
                lightboxImage.style.transform = '';
                if (lightbox.classList.contains('active')) applyToolbarConstraint();
            });
        }
    }

    function animateZoom(startScale, endScale, startX, startY, endX, endY, onComplete) {
        if (animationId !== null) { cancelAnimationFrame(animationId); animationId = null; }
        const duration = 250;
        const startTime = performance.now();
        function animate(currentTime) {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            liveScale  = startScale + (endScale - startScale) * eased;
            liveTransX = startX    + (endX    - startX)    * eased;
            liveTransY = startY    + (endY    - startY)    * eased;
            lightboxImage.style.transform =
                `translate(${liveTransX}px, ${liveTransY}px) scale(${liveScale})`;
            if (progress < 1) animationId = requestAnimationFrame(animate);
            else { animationId = null; if (onComplete) onComplete(); }
        }
        animationId = requestAnimationFrame(animate);
    }

    function resetZoom() {
        if (!isZoomed) return;
        const factor = window.innerWidth <= 834 ? 1.5 : 1.7;
        const SCALE = preZoomScale * factor;
        const wasAnimating = animationId !== null;
        const startScale = wasAnimating ? liveScale  : SCALE;
        const startX     = wasAnimating ? liveTransX : translateX;
        const startY     = wasAnimating ? liveTransY : translateY;

        isZoomed = false;
        translateX = 0;
        translateY = 0;
        targetX = 0;
        targetY = 0;
        needsUpdate = false;

        updateNavVisibility();

        lightboxImage.style.cursor = 'zoom-in';
        lightboxZoom.querySelector('span').textContent = 'zoom_in';

        animateZoom(startScale, preZoomScale, startX, startY, 0, 0, () => {
            lightboxImage.classList.remove('is-zoomed');
            lightboxContent.classList.remove('is-zoomed');
            lightboxImage.style.transform = '';
            if (lightbox.classList.contains('active')) applyToolbarConstraint();
        });
    }

    lightboxZoom.addEventListener('click', (e) => {
        if (currentImages.length === 0) return;
        e.stopPropagation();
        toggleZoom();
    });

    // Image Click - Toggle zoom if not dragging
    lightboxImage.addEventListener('click', (e) => {
        if (currentImages.length === 0) return;
        e.stopPropagation();
        if (!hasDragged) {
            toggleZoom();
        }
    });

    // Mouse Drag
    let initialTranslateX = 0, initialTranslateY = 0;
    
    lightboxImage.addEventListener('mousedown', (e) => {
        if (!isZoomed) return;
        isDragging = true;
        hasDragged = false;
        startX = e.clientX;
        startY = e.clientY;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
        lightboxImage.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            hasDragged = true;
        }
        
        targetX = initialTranslateX + dx;
        targetY = initialTranslateY + dy;
        
        requestTransformUpdate();
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            lightboxImage.style.cursor = isZoomed ? 'grab' : 'zoom-in';
        }
    });

    // Touch Drag
    lightboxImage.addEventListener('touchstart', (e) => {
        if (!isZoomed) return;
        isDragging = true;
        hasDragged = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
    }, {passive: false});

    lightboxImage.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            hasDragged = true;
        }
        
        targetX = initialTranslateX + dx;
        targetY = initialTranslateY + dy;
        
        requestTransformUpdate();
    }, {passive: false});

    lightboxImage.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Update displayed image with crossfade
    function updateLightbox() {
        // If zoomed, reset first and wait for animation
        if (isZoomed) {
            resetZoom();
            setTimeout(() => performImageSwap(), 260);
        } else {
            performImageSwap();
        }
    }

    function performImageSwap() {
        const newSrc = currentImages[currentIndex].src;
        const newAlt = currentImages[currentIndex].alt;
        
        // Preload image to avoid dimension race conditions
        const preload = new Image();
        preload.src = newSrc;
        
        // Fade out current image
        lightboxImage.style.opacity = '0';
        
        preload.onload = () => {
            // Wait for fade out to complete
            setTimeout(() => {
                lightboxImage.src = newSrc;
                lightboxImage.alt = newAlt;
                
                // Cache dimensions after image is set
                requestAnimationFrame(() => {
                    cacheDimensions();
                    applyToolbarConstraint();
                    // Fade in new image
                    lightboxImage.style.opacity = '1';
                    if (isZoomed) requestTransformUpdate();
                });
            }, 50);
        };
        
        // If image is already cached, onload fires immediately
        if (preload.complete) {
            preload.onload();
        }
    }

    function updateNavVisibility() {
        // Hide arrows if zoomed OR if there's only one image in the group
        const shouldHideNav = isZoomed || currentImages.length <= 1;
        
        if (lightboxPrevNav) {
            lightboxPrevNav.style.display = shouldHideNav ? 'none' : '';
        }
        if (lightboxNextNav) {
            lightboxNextNav.style.display = shouldHideNav ? 'none' : '';
        }
    }


    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') {
            if (isZoomed) {
                toggleZoom();
            } else {
                closeLightbox();
            }
            return;
        }

        if (isZoomed || currentImages.length <= 1) return;

        switch (e.key) {
            case 'ArrowLeft':
                currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
                updateLightbox();
                break;
            case 'ArrowRight':
                currentIndex = (currentIndex + 1) % currentImages.length;
                updateLightbox();
                break;
        }
    });

    // Touch swipe navigation
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        if (isZoomed || currentImages.length <= 1) return;
        touchStartX = e.changedTouches[0].screenX;
    });

    lightbox.addEventListener('touchend', (e) => {
        if (isZoomed || currentImages.length <= 1) return;
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;
        if (Math.abs(swipeDistance) < 50) return;

        if (swipeDistance > 0) {
            currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        } else {
            currentIndex = (currentIndex + 1) % currentImages.length;
        }
        updateLightbox();
    }

    function applyToolbarConstraint() {
        // On mobile controls overlay content — no constraint needed
        if (window.innerWidth <= 692) {
            lightboxImage.style.maxWidth = '';
            lightboxImage.style.maxHeight = '';
            return;
        }

        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const toolbarRect = lightboxControls.getBoundingClientRect();

        // Compute the displayed image size given current CSS constraints (85vw × 82vh)
        const aspect = naturalImgWidth / naturalImgHeight;
        const cssMaxW = vpW * 0.85;
        const cssMaxH = vpH * 0.82;
        let dispW, dispH;
        if (aspect > cssMaxW / cssMaxH) {
            dispW = Math.min(cssMaxW, naturalImgWidth);
            dispH = dispW / aspect;
        } else {
            dispH = Math.min(cssMaxH, naturalImgHeight);
            dispW = dispH * aspect;
        }

        // Centered image bounds
        const imgTop   = vpH / 2 - dispH / 2;
        const imgRight = vpW / 2 + dispW / 2;

        if (imgTop < toolbarRect.bottom && imgRight > toolbarRect.left) {
            // Constrain width so right edge clears the toolbar (symmetric = stays centered)
            const safeMaxW = 2 * toolbarRect.left - vpW;
            lightboxImage.style.maxWidth = `${safeMaxW}px`;
        } else {
            lightboxImage.style.maxWidth = '';
        }
    }

    // Update bounds on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (!isZoomed) {
                applyToolbarConstraint();
            } else {
                cacheDimensions();
                requestTransformUpdate();
            }
        }, 100);
    });

    /* ---------- FOCUS-TRAP ---------- */
    const FOCUSABLE_SELECTOR =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    let lastFocusedElement = null;

    function trapFocus(e) {
      if (!lightbox.classList.contains('active')) return;
      if (!isZoomed) return; // Only trap focus when zoomed

      const focusable = [...lightbox.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;

      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function enableFocusTrap() {
        lastFocusedElement = document.activeElement;
        document.addEventListener('keydown', trapFocus);
        
        // Remove background from tab order
        document.querySelectorAll('body > *:not(#lightbox)').forEach(el => {
            el.setAttribute('inert', '');
        });
    }

    function disableFocusTrap() {
        document.removeEventListener('keydown', trapFocus);
        
        // Restore background tab order
        document.querySelectorAll('body > *:not(#lightbox)').forEach(el => {
            el.removeAttribute('inert');
        });
        
        if (lastFocusedElement?.focus) lastFocusedElement.focus();
    }

});

/* ---------- THUMBNAIL ASPECT RATIO FIX ---------- */
document.addEventListener('DOMContentLoaded', function() {
    const imageItems = document.querySelectorAll('.image-item');
    
    imageItems.forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;
        
        const styles = getComputedStyle(container);
        const maxHeight = styles.getPropertyValue('--thumb-max-height').trim();
        
        if (maxHeight) {
            const fixAspectRatio = () => {
                const naturalRatio = img.naturalWidth / img.naturalHeight;
                container.style.aspectRatio = naturalRatio;
                container.style.maxHeight = maxHeight;
                
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                
                container.classList.add('js-aspect-fixed');
            };
            
            img.complete ? fixAspectRatio() : (img.onload = fixAspectRatio);
        }
    });
});
