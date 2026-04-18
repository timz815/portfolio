"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* ===================== LIGHTBOX SETUP ===================== */
    const lightbox        = document.getElementById("lightbox");
    const lightboxImage   = document.getElementById("lightbox-image");
    const lightboxClose   = document.getElementById("lightbox-close");
    const lightboxZoom    = document.getElementById("lightbox-zoom");
    const lightboxContent = document.querySelector(".lightbox-content");
    const lightboxPrev    = document.getElementById("lightbox-prev");
    const lightboxNext    = document.getElementById("lightbox-next");
    const lightboxPrevNav = document.getElementById("lightbox-prev-nav");
    const lightboxNextNav = document.getElementById("lightbox-next-nav");
    const lightboxControls = document.querySelector(".lightbox-controls");

    // Inject lightbox counter (top-left, carousel sessions only)
    const lightboxCounter = document.createElement("div");
    lightboxCounter.className = "lightbox-counter";
    lightbox.appendChild(lightboxCounter);

    function updateLightboxCounter() {
        if (!activeCarousel || isZoomed) { lightboxCounter.style.display = 'none'; return; }
        const total = activeCarousel.images.length;
        if (total <= 1) { lightboxCounter.style.display = 'none'; return; }
        lightboxCounter.textContent = `${activeCarousel.currentIndex + 1} / ${total}`;
        lightboxCounter.style.display = 'block';
    }

    // Tracks whichever carousel instance opened the lightbox
    let activeCarousel = null;

    // Zoom & pan state
    let isZoomed = false;
    let isDragging = false;
    let hasDragged = false;
    let startX, startY;
    let translateX = 0, translateY = 0;
    let targetX = 0, targetY = 0;
    let needsUpdate = false;
    let initialTranslateX = 0, initialTranslateY = 0;
    const DRAG_THRESHOLD = 5;

    let cachedImgWidth = 0, cachedImgHeight = 0;
    let naturalImgWidth = 0, naturalImgHeight = 0;
    let preZoomScale = 1;
    let animationId = null;
    let liveScale = 1, liveTransX = 0, liveTransY = 0;

    function getZoomScale() {
        if (!cachedImgWidth || !naturalImgWidth) {
            return window.innerWidth <= 834 ? 1.5 : 1.7;
        }
        const factor = window.innerWidth <= 834 ? 1.5 : 1.7;
        return (cachedImgWidth * factor) / naturalImgWidth;
    }

    function cacheDimensions() {
        const rect = lightboxImage.getBoundingClientRect();
        cachedImgWidth  = rect.width;
        cachedImgHeight = rect.height;
        naturalImgWidth  = lightboxImage.naturalWidth;
        naturalImgHeight = lightboxImage.naturalHeight;
    }

    function applyTransform() {
        if (!isZoomed) {
            lightboxImage.style.transform = '';
            needsUpdate = false;
            return;
        }
        const SCALE = getZoomScale();
        const imgWidth  = naturalImgWidth  * SCALE;
        const imgHeight = naturalImgHeight * SCALE;
        const maxX = Math.max((imgWidth  - window.innerWidth)  / 2, 0);
        const maxY = Math.max((imgHeight - window.innerHeight) / 2, 0);
        translateX = Math.min(maxX, Math.max(-maxX, targetX));
        translateY = Math.min(maxY, Math.max(-maxY, targetY));
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

    function updateNavVisibility() {
        const count = activeCarousel ? activeCarousel.images.length : 0;
        const hide = isZoomed || count <= 1;
        if (lightboxPrevNav) lightboxPrevNav.style.display = hide ? 'none' : '';
        if (lightboxNextNav) lightboxNextNav.style.display = hide ? 'none' : '';
    }

    function performImageSwap(src, alt) {
        const preload = new Image();
        preload.src = src;
        lightboxImage.style.opacity = '0';
        const doSwap = () => {
            setTimeout(() => {
                lightboxImage.src = src;
                lightboxImage.alt = alt;
                requestAnimationFrame(() => {
                    cacheDimensions();
                    applyToolbarConstraint();
                    lightboxImage.style.opacity = '1';
                    if (isZoomed) requestTransformUpdate();
                });
            }, 50);
        };
        preload.onload = doSwap;
        if (preload.complete) doSwap();
    }

    function applyToolbarConstraint() {
        if (window.innerWidth <= 692) {
            lightboxImage.style.maxWidth = '';
            return;
        }
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const toolbarRect = lightboxControls.getBoundingClientRect();
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
        const imgTop   = vpH / 2 - dispH / 2;
        const imgRight = vpW / 2 + dispW / 2;
        if (imgTop < toolbarRect.bottom && imgRight > toolbarRect.left) {
            lightboxImage.style.maxWidth = `${2 * toolbarRect.left - vpW}px`;
        } else {
            lightboxImage.style.maxWidth = '';
        }
    }

    function lightboxNavigate(index) {
        if (!activeCarousel) return;
        const images = activeCarousel.images;
        activeCarousel.currentIndex = ((index % images.length) + images.length) % images.length;
        // Keep carousel thumbnails in sync
        activeCarousel.updateDisplay(activeCarousel.currentIndex, true);
        updateLightboxCounter();
        const { src, alt } = images[activeCarousel.currentIndex];
        if (isZoomed) {
            resetZoom();
            setTimeout(() => performImageSwap(src, alt), 260);
        } else {
            performImageSwap(src, alt);
        }
    }

    function toggleZoom() {
        isZoomed = !isZoomed;
        updateNavVisibility();
        updateLightboxCounter();

        if (isZoomed) {
            translateX = targetX = translateY = targetY = 0;

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
            translateX = targetX = translateY = targetY = 0;
            lightboxImage.style.cursor = 'zoom-in';
            lightboxZoom.querySelector('span').textContent = 'zoom_in';
            animateZoom(startScale, preZoomScale, startX, startY, 0, 0, () => {
                lightboxImage.classList.remove('is-zoomed');
                lightboxImage.style.transform = '';
                if (lightbox.classList.contains('active')) applyToolbarConstraint();
            });
        }
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
        translateX = targetX = translateY = targetY = 0;
        needsUpdate = false;
        updateNavVisibility();
        updateLightboxCounter();
        lightboxImage.style.cursor = 'zoom-in';
        lightboxZoom.querySelector('span').textContent = 'zoom_in';
        animateZoom(startScale, preZoomScale, startX, startY, 0, 0, () => {
            lightboxImage.classList.remove('is-zoomed');
            lightboxImage.style.transform = '';
            if (lightbox.classList.contains('active')) applyToolbarConstraint();
        });
    }

    function closeLightbox() {
        if (isZoomed) resetZoom();
        lightboxImage.style.maxWidth = '';
        activeCarousel = null;
        updateNavVisibility();
        updateLightboxCounter();
        lightbox.classList.remove("active");
        disableFocusTrap();
        document.body.style.overflow = "";
    }

    // Lightbox controls
    lightboxClose.addEventListener("click", (e) => {
        e.stopPropagation();
        closeLightbox();
    });

    lightboxZoom.addEventListener("click", (e) => {
        if (!activeCarousel) return;
        e.stopPropagation();
        toggleZoom();
    });

    lightboxImage.addEventListener("click", (e) => {
        if (!activeCarousel) return;
        e.stopPropagation();
        if (!hasDragged) toggleZoom();
    });

    lightbox.addEventListener("click", (e) => {
        if (e.target === lightbox || e.target === lightboxContent) closeLightbox();
    });

    if (lightboxPrev) {
        lightboxPrev.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!isZoomed && activeCarousel) lightboxNavigate(activeCarousel.currentIndex - 1);
        });
    }
    if (lightboxNext) {
        lightboxNext.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!isZoomed && activeCarousel) lightboxNavigate(activeCarousel.currentIndex + 1);
        });
    }

    // Mouse drag
    lightboxImage.addEventListener("mousedown", (e) => {
        if (!isZoomed) return;
        isDragging = true;
        hasDragged = false;
        startX = e.clientX; startY = e.clientY;
        initialTranslateX = translateX; initialTranslateY = translateY;
        lightboxImage.style.cursor = "grabbing";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) hasDragged = true;
        targetX = initialTranslateX + dx;
        targetY = initialTranslateY + dy;
        requestTransformUpdate();
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            lightboxImage.style.cursor = isZoomed ? "grab" : "zoom-in";
        }
    });

    // Touch drag
    lightboxImage.addEventListener("touchstart", (e) => {
        if (!isZoomed) return;
        isDragging = true; hasDragged = false;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        initialTranslateX = translateX; initialTranslateY = translateY;
    }, { passive: false });

    lightboxImage.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) hasDragged = true;
        targetX = initialTranslateX + dx;
        targetY = initialTranslateY + dy;
        requestTransformUpdate();
    }, { passive: false });

    lightboxImage.addEventListener("touchend", () => { isDragging = false; });

    // Touch swipe in lightbox
    let touchStartX = 0, touchEndX = 0;
    lightbox.addEventListener("touchstart", (e) => {
        if (isZoomed) return;
        touchStartX = e.changedTouches[0].screenX;
    });
    lightbox.addEventListener("touchend", (e) => {
        if (isZoomed || !activeCarousel) return;
        touchEndX = e.changedTouches[0].screenX;
        const dist = touchEndX - touchStartX;
        if (Math.abs(dist) < 50) return;
        lightboxNavigate(dist > 0 ? activeCarousel.currentIndex - 1 : activeCarousel.currentIndex + 1);
    });

    // Keyboard
    document.addEventListener("keydown", (e) => {
        if (!lightbox.classList.contains("active")) return;
        if (e.key === "Escape") {
            isZoomed ? toggleZoom() : closeLightbox();
            return;
        }
        if (isZoomed || !activeCarousel) return;
        if (e.key === "ArrowLeft")  lightboxNavigate(activeCarousel.currentIndex - 1);
        if (e.key === "ArrowRight") lightboxNavigate(activeCarousel.currentIndex + 1);
    });

    // Resize
    let resizeTimeout;
    window.addEventListener("resize", () => {
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

    /* ---------- FOCUS TRAP ---------- */
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    let lastFocused = null;

    function trapFocus(e) {
        if (!lightbox.classList.contains("active") || !isZoomed) return;
        const focusable = [...lightbox.querySelectorAll(FOCUSABLE)];
        if (!focusable.length || e.key !== "Tab") return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    function enableFocusTrap() {
        lastFocused = document.activeElement;
        document.addEventListener("keydown", trapFocus);
        document.querySelectorAll("body > *:not(#lightbox)").forEach(el => el.setAttribute("inert", ""));
    }

    function disableFocusTrap() {
        document.removeEventListener("keydown", trapFocus);
        document.querySelectorAll("body > *:not(#lightbox)").forEach(el => el.removeAttribute("inert"));
        if (lastFocused?.focus) lastFocused.focus();
    }


    /* ===================== CAROUSEL (per instance) ===================== */
    function initCarousel(container) {
        const displayImg    = container.querySelector(".gallery-image img");
        const galleryFrame  = container.querySelector(".gallery-frame");
        const thumbWrapper  = container.querySelector(".thumbnail-viewport");
        const thumbButtons  = [...container.querySelectorAll(".thumbnail-item")];
        const mainPrev      = container.querySelector(".nav-arrow.prev");
        const mainNext      = container.querySelector(".nav-arrow.next");
        const thumbPrev     = container.querySelector(".thumb-nav-arrow.prev");
        const thumbNext     = container.querySelector(".thumb-nav-arrow.next");
        const thumbnailMain = container.querySelector(".thumbnail-main");
        
        let swipeStartX = 0;

        // Instance object — also used by lightbox to navigate
        const instance = {
            currentIndex: 0,
            images: thumbButtons.map(btn => ({
                src: btn.querySelector("img").src,
                alt: btn.querySelector("img").alt
            })),
            updateDisplay,
        };

        function updateDisplay(index, skipScroll) {
            instance.currentIndex = index;

            displayImg.style.opacity = 0;
            setTimeout(() => {
                displayImg.src = instance.images[index].src;
                displayImg.alt = instance.images[index].alt;
                displayImg.style.opacity = 1;
            }, 120);

            thumbButtons.forEach((btn, i) => {
                btn.setAttribute("aria-selected", i === index);
            });

            if (!skipScroll) {
                thumbButtons[index].scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "center"
                });
            }
        }

        function scrollThumbs(direction) {
            const thumb = thumbButtons[0];
            if (!thumb) return;
            const gap  = parseFloat(getComputedStyle(container.querySelector(".thumbnail-row")).gap) || 0;
            const step = (thumb.offsetWidth + gap) * 5;
            const maxScroll = thumbWrapper.scrollWidth - thumbWrapper.clientWidth;
            thumbWrapper.scrollLeft = direction === "next"
                ? Math.min(thumbWrapper.scrollLeft + step, maxScroll)
                : Math.max(thumbWrapper.scrollLeft - step, 0);
        }

        thumbButtons.forEach((btn, index) => {
            btn.addEventListener("click", () => updateDisplay(index));
        });

        mainPrev.addEventListener("click", () =>
            updateDisplay((instance.currentIndex - 1 + thumbButtons.length) % thumbButtons.length)
        );
        mainNext.addEventListener("click", () =>
            updateDisplay((instance.currentIndex + 1) % thumbButtons.length)
        );

        thumbPrev.addEventListener("click", () => scrollThumbs("prev"));
        thumbNext.addEventListener("click", () => scrollThumbs("next"));

        thumbnailMain.addEventListener("touchstart", () => {
            thumbnailMain.classList.add("touch-active");
            clearTimeout(thumbnailMain._hideTimer);
            thumbnailMain._hideTimer = setTimeout(() => {
                thumbnailMain.classList.remove("touch-active");
            }, 2000);
        });

        function updateThumbArrows() {
            const visible = window.innerWidth > 550 &&
                            thumbWrapper.scrollWidth > thumbWrapper.clientWidth;
            thumbnailMain.classList.toggle("arrows-visible", visible);
        }

        updateThumbArrows();
        window.addEventListener("resize", updateThumbArrows);
        window.addEventListener("load", updateThumbArrows);

        // Open lightbox
        galleryFrame.addEventListener("click", () => {
            hasDragged = false;
            activeCarousel = instance;
            const { src, alt } = instance.images[instance.currentIndex];
            performImageSwap(src, alt);
            lightbox.classList.add("active");
            enableFocusTrap();
            document.body.style.overflow = "hidden";
            updateNavVisibility();
            updateLightboxCounter();
        });

        // Swipe on main image
        galleryFrame.addEventListener("touchstart", (e) => {
            swipeStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        galleryFrame.addEventListener("touchend", (e) => {
            const dist = e.changedTouches[0].screenX - swipeStartX;
            if (Math.abs(dist) < 20) return;
            const newIndex = dist > 0
                ? (instance.currentIndex - 1 + instance.images.length) % instance.images.length
                : (instance.currentIndex + 1) % instance.images.length;
            updateDisplay(newIndex);
        });

        updateDisplay(0, true);
    }

    /* ===================== INIT ALL CAROUSELS ===================== */
    document.querySelectorAll(".gallery-main").forEach(initCarousel);

});