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

    let currentIndex = 0;
    let currentImages = []; // Current set of images to cycle through
    let hasMultipleImages = false; // Whether current group has multiple images
    
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
                images: group,
                hasMultiple: group.length > 1
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

    function getZoomScale() {
        // Target: natural pixel size, clamped so image never exceeds 1.5x the viewport
        const maxScaleX = (window.innerWidth * 1.5) / cachedImgWidth;
        const maxScaleY = (window.innerHeight * 1.5) / cachedImgHeight;
        const maxScale = Math.min(maxScaleX, maxScaleY);

        // Scale needed to show image at natural size
        const naturalScale = naturalImgWidth / cachedImgWidth;

        // Use natural scale if it fits within 1.5x viewport, otherwise cap it
        // Floor of 1.5 ensures we always zoom even if natural size is smaller
        return Math.min(Math.max(naturalScale, 1.5), maxScale);
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
        const imgWidth = cachedImgWidth * SCALE;
        const imgHeight = cachedImgHeight * SCALE;
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
                hasMultipleImages = group.hasMultiple;
                hasDragged = false;
                updateLightbox();
                lightbox.classList.add('active');
                enableFocusTrap();
                document.body.style.overflow = 'hidden';
                updateNavVisibility();
                // Cache dimensions immediately so getZoomScale() is never working with stale zeroes
                requestAnimationFrame(() => cacheDimensions());
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
            if (isZoomed || !hasMultipleImages) return;
            currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
            updateLightbox();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isZoomed || !hasMultipleImages) return;
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
        updateNavVisibility();
        lightbox.classList.remove('active');
        disableFocusTrap();
        document.body.style.overflow = '';
    }


    function toggleZoom() {
        const wasZoomed = isZoomed;
        isZoomed = !isZoomed;
        updateNavVisibility();
        const SCALE = getZoomScale();

        if (isZoomed) {
            // Zooming IN
            translateX = 0;
            translateY = 0;
            targetX = 0;
            targetY = 0;

            lightboxImage.classList.add('is-zoomed');
            lightboxImage.style.cursor = 'grab';
            lightboxZoom.querySelector('span').textContent = 'zoom_out';
            cacheDimensions();

            // Calculate the current scale before zooming
            const currentScale = calculateFinalScale();

            // Animate from current constrained scale to zoomed scale
            animateZoom(currentScale, SCALE, 0, 0, 0, 0);
        } else {
            // Zooming OUT
            const currentTransX = translateX;
            const currentTransY = translateY;

            // Calculate what scale the image will be at when constrained
            const finalScale = calculateFinalScale();

            // State reset
            translateX = 0;
            translateY = 0;
            targetX = 0;
            targetY = 0;

            lightboxImage.style.cursor = 'zoom-in';
            lightboxZoom.querySelector('span').textContent = 'zoom_in';

            // Animate to the constrained scale, then cleanup
            animateZoom(SCALE, finalScale, currentTransX, currentTransY, 0, 0, () => {
                lightboxImage.classList.remove('is-zoomed');
                lightboxImage.style.transform = ''; // Clear inline transform
            });
        }
    }

    function calculateFinalScale() {
        // Use NATURAL dimensions, not cached display dimensions
        const naturalWidth = naturalImgWidth;
        const naturalHeight = naturalImgHeight;
        
        // Temporarily remove is-zoomed to read unzoomed CSS values
        const wasZoomed = lightboxImage.classList.contains('is-zoomed');
        if (wasZoomed) {
            lightboxImage.classList.remove('is-zoomed');
        }
        
        // Get the computed max-width and max-height from CSS
        const computedStyle = window.getComputedStyle(lightboxImage);
        const maxWidth = parseFloat(computedStyle.maxWidth);
        const maxHeight = parseFloat(computedStyle.maxHeight);
        
        // Restore is-zoomed if it was there
        if (wasZoomed) {
            lightboxImage.classList.add('is-zoomed');
        }
        
        // Calculate scale to fit within constraints
        const scaleX = maxWidth / naturalWidth;
        const scaleY = maxHeight / naturalHeight;
        
        return Math.min(scaleX, scaleY, 1);
    }

    function animateZoom(startScale, endScale, startX, startY, endX, endY, onComplete) {
        const duration = 250; // ms
        const startTime = performance.now();
        
        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            
            const currentScale = startScale + (endScale - startScale) * eased;
            const currentX = startX + (endX - startX) * eased;
            const currentY = startY + (endY - startY) * eased;
            
            lightboxImage.style.transform = 
                `translate(${currentX}px, ${currentY}px) scale(${currentScale})`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        }
        
        requestAnimationFrame(animate);
    }

    function resetZoom() {
        if (!isZoomed) return;
        const SCALE = getZoomScale();
        
        // Use the stored clamped values
        const currentTransX = translateX;
        const currentTransY = translateY;
        
        // Calculate final scale
        const finalScale = calculateFinalScale();
        
        isZoomed = false;
        translateX = 0;
        translateY = 0;
        targetX = 0;
        targetY = 0;
        needsUpdate = false;

        updateNavVisibility();
        
        lightboxImage.style.cursor = 'zoom-in';
        lightboxZoom.querySelector('span').textContent = 'zoom_in';
        
        // Animate zoom out from actual position
        animateZoom(SCALE, finalScale, currentTransX, currentTransY, 0, 0, () => {
            lightboxImage.classList.remove('is-zoomed');
            lightboxContent.classList.remove('is-zoomed');
            lightboxImage.style.transform = '';
        });
    }

    lightboxZoom.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleZoom();
    });

    // Image Click - Toggle zoom if not dragging
    lightboxImage.addEventListener('click', (e) => {
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
        const shouldHideNav = isZoomed || !hasMultipleImages;
        
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

        if (isZoomed || !hasMultipleImages) return;

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
        if (isZoomed || !hasMultipleImages) return;
        touchStartX = e.changedTouches[0].screenX;
    });

    lightbox.addEventListener('touchend', (e) => {
        if (isZoomed || !hasMultipleImages) return;
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

    // Update bounds on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (!isZoomed) return;
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            cacheDimensions();
            requestTransformUpdate();
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
