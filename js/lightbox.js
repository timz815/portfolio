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
    
    // State flags
    let imageReady = false; // Whether current image is fully loaded and dimensions cached
    let isTransitioning = false; // Whether we're in the middle of an image swap
    
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

    // Container dimensions for layout stability
    let containerWidth = 0;
    let containerHeight = 0;

    function getZoomScale() {
        // Guard against unloaded image
        if (cachedImgWidth === 0 || cachedImgHeight === 0) {
            return 1.5; // Fallback safe value
        }
        
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

    function setContainerSizeFromImage() {
        // Set fixed container dimensions based on current image to prevent layout shift
        const maxVh = 90; // Match your CSS max-height: 90vh
        const maxVw = 90; // Match your CSS max-width: 90vw
        
        // Calculate target display size while maintaining aspect ratio
        const targetWidth = Math.min(naturalImgWidth, window.innerWidth * maxVw / 100);
        const targetHeight = Math.min(naturalImgHeight, window.innerHeight * maxVh / 100);
        
        // Adjust to maintain aspect ratio if one dimension is constrained
        const aspectRatio = naturalImgWidth / naturalImgHeight;
        let finalWidth, finalHeight;
        
        if (targetWidth / targetHeight > aspectRatio) {
            // Width is too large, constrain by height
            finalHeight = targetHeight;
            finalWidth = targetHeight * aspectRatio;
        } else {
            // Height is too large, constrain by width
            finalWidth = targetWidth;
            finalHeight = targetWidth / aspectRatio;
        }
        
        // Apply fixed dimensions to container
        lightboxContent.style.width = `${finalWidth}px`;
        lightboxContent.style.height = `${finalHeight}px`;
        
        // Store for later use
        containerWidth = finalWidth;
        containerHeight = finalHeight;
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
                imageReady = false; // New image not ready yet
                isTransitioning = false;
                
                // Update UI to show loading state
                lightboxZoom.style.opacity = '0.5';
                lightboxZoom.style.pointerEvents = 'none';
                
                updateLightbox(true); // Open immediately
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
            if (isZoomed || !hasMultipleImages || isTransitioning || !imageReady) return;
            currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
            imageReady = false;
            isTransitioning = true;
            lightboxZoom.style.opacity = '0.5';
            lightboxZoom.style.pointerEvents = 'none';
            updateLightbox();
        });
    }

    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isZoomed || !hasMultipleImages || isTransitioning || !imageReady) return;
            currentIndex = (currentIndex + 1) % currentImages.length;
            imageReady = false;
            isTransitioning = true;
            lightboxZoom.style.opacity = '0.5';
            lightboxZoom.style.pointerEvents = 'none';
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
        
        // Reset container styles
        lightboxContent.style.width = '';
        lightboxContent.style.height = '';
    }

    function toggleZoom() {
        // Prevent zoom if image isn't ready
        if (!imageReady) return;
        
        const wasZoomed = isZoomed;
        isZoomed = !isZoomed;
        updateNavVisibility();
        
        if (isZoomed) {
            // Zooming IN
            if (!wasZoomed) {
                // First time zooming, ensure dimensions are fresh
                cacheDimensions();
            }
            
            translateX = 0;
            translateY = 0;
            targetX = 0;
            targetY = 0;

            lightboxImage.classList.add('is-zoomed');
            lightboxImage.style.cursor = 'grab';
            lightboxZoom.querySelector('span').textContent = 'zoom_out';
            
            // Remove fixed container dimensions when zoomed
            lightboxContent.style.width = '';
            lightboxContent.style.height = '';
            
            // Apply zoom transform
            requestTransformUpdate();
        } else {
            // Zooming OUT
            lightboxImage.style.cursor = 'zoom-in';
            lightboxZoom.querySelector('span').textContent = 'zoom_in';
            
            lightboxImage.classList.remove('is-zoomed');
            lightboxImage.style.transform = '';
            
            // Restore fixed container dimensions
            setContainerSizeFromImage();
        }
    }

    function resetZoom() {
        if (!isZoomed) return;
        
        isZoomed = false;
        translateX = 0;
        translateY = 0;
        targetX = 0;
        targetY = 0;
        needsUpdate = false;

        updateNavVisibility();
        
        lightboxImage.style.cursor = 'zoom-in';
        lightboxZoom.querySelector('span').textContent = 'zoom_in';
        lightboxImage.classList.remove('is-zoomed');
        lightboxImage.style.transform = '';
        
        // Restore fixed container dimensions
        setContainerSizeFromImage();
    }

    lightboxZoom.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleZoom();
    });

    // Image Click - Toggle zoom if not dragging
    lightboxImage.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!hasDragged && imageReady) {
            toggleZoom();
        }
    });

    // Mouse Drag
    let initialTranslateX = 0, initialTranslateY = 0;
    
    lightboxImage.addEventListener('mousedown', (e) => {
        if (!isZoomed || !imageReady) return;
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
        if (!isZoomed || !imageReady) return;
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

    // Update displayed image with smooth transition
    function updateLightbox(isOpen = false) {
        // If zoomed, reset first
        if (isZoomed) {
            resetZoom();
        }
        
        performImageSwap(isOpen);
    }

    function performImageSwap(isOpen = false) {
        const newSrc = currentImages[currentIndex].src;
        const newAlt = currentImages[currentIndex].alt;
        
        // Preload image to get dimensions
        const preload = new Image();
        preload.src = newSrc;
        
        preload.onload = () => {
            // Get natural dimensions from preload
            naturalImgWidth = preload.naturalWidth;
            naturalImgHeight = preload.naturalHeight;
            
            // Set container size based on new image dimensions
            setContainerSizeFromImage();
            
            // Now swap the image
            if (isOpen) {
                // First open - just show image
                lightboxImage.src = newSrc;
                lightboxImage.alt = newAlt;
                
                requestAnimationFrame(() => {
                    cacheDimensions();
                    imageReady = true;
                    isTransitioning = false;
                    lightboxZoom.style.opacity = '1';
                    lightboxZoom.style.pointerEvents = 'auto';
                });
            } else {
                // Transition between images - fade out/in
                lightboxImage.style.opacity = '0';
                
                const onFadeOutComplete = () => {
                    lightboxImage.removeEventListener('transitionend', onFadeOutComplete);
                    
                    // Swap image
                    lightboxImage.src = newSrc;
                    lightboxImage.alt = newAlt;
                    
                    // Cache new dimensions and fade in
                    requestAnimationFrame(() => {
                        cacheDimensions();
                        lightboxImage.style.opacity = '1';
                        
                        // Mark as ready after fade in completes
                        setTimeout(() => {
                            imageReady = true;
                            isTransitioning = false;
                            lightboxZoom.style.opacity = '1';
                            lightboxZoom.style.pointerEvents = 'auto';
                        }, 50);
                    });
                };
                
                lightboxImage.addEventListener('transitionend', onFadeOutComplete, { once: true });
                
                // Fallback in case transitionend doesn't fire
                setTimeout(() => {
                    if (!imageReady) {
                        onFadeOutComplete();
                    }
                }, 300);
            }
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

        if (isZoomed || !hasMultipleImages || isTransitioning || !imageReady) return;

        switch (e.key) {
            case 'ArrowLeft':
                currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
                imageReady = false;
                isTransitioning = true;
                lightboxZoom.style.opacity = '0.5';
                lightboxZoom.style.pointerEvents = 'none';
                updateLightbox();
                break;
            case 'ArrowRight':
                currentIndex = (currentIndex + 1) % currentImages.length;
                imageReady = false;
                isTransitioning = true;
                lightboxZoom.style.opacity = '0.5';
                lightboxZoom.style.pointerEvents = 'none';
                updateLightbox();
                break;
        }
    });

    // Touch swipe navigation
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        if (isZoomed || !hasMultipleImages || isTransitioning || !imageReady) return;
        touchStartX = e.changedTouches[0].screenX;
    });

    lightbox.addEventListener('touchend', (e) => {
        if (isZoomed || !hasMultipleImages || isTransitioning || !imageReady) return;
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
        
        imageReady = false;
        isTransitioning = true;
        lightboxZoom.style.opacity = '0.5';
        lightboxZoom.style.pointerEvents = 'none';
        updateLightbox();
    }

    // Update bounds on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (!lightbox.classList.contains('active')) return;
        
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (imageReady) {
                if (isZoomed) {
                    cacheDimensions();
                    requestTransformUpdate();
                } else {
                    // Recalculate container size for new window dimensions
                    setContainerSizeFromImage();
                }
            }
        }, 100);
    });

    /* ---------- FOCUS-TRAP ---------- */
    const FOCUSABLE_SELECTOR =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    let lastFocusedElement = null;

    function trapFocus(e) {
      if (!lightbox.classList.contains('active')) return;
      
      // Always trap focus when lightbox is open, regardless of zoom state
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

/* ====== ADD THESE CSS RULES ====== */
/*
Add to your existing CSS:

.lightbox-content {
    transition: width 0.2s ease, height 0.2s ease;
}

.lightbox-image {
    transition: opacity 0.2s ease, transform 0.2s ease;
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.lightbox-image.is-zoomed {
    transition: transform 0.2s ease;
    max-width: none;
    max-height: none;
    object-fit: cover;
}
*/

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
