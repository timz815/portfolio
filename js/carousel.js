"use strict";

document.addEventListener("DOMContentLoaded", () => {

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

        instance.images.forEach(({ src }) => {
            const image = new Image();
            image.src = src;
        });

        function updateDisplay(index, skipScroll) {
            instance.currentIndex = index;

            displayImg.src = instance.images[index].src;
            displayImg.alt = instance.images[index].alt;
            displayImg.classList.remove('has-transparency');
            const src = displayImg.src;
            window.imageHasTransparency(src).then(transparent => {
                if (displayImg.src === src) displayImg.classList.toggle('has-transparency', transparent);
            });

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

        function updateThumbArrowState() {
            const maxScroll = thumbWrapper.scrollWidth - thumbWrapper.clientWidth;
            const atStart = thumbWrapper.scrollLeft <= 1;
            const atEnd = thumbWrapper.scrollLeft >= maxScroll - 1;

            thumbPrev.disabled = atStart;
            thumbNext.disabled = atEnd;
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
            updateThumbArrowState();
        }

        updateThumbArrows();
        thumbWrapper.addEventListener("scroll", updateThumbArrowState);
        window.addEventListener("resize", updateThumbArrows);
        window.addEventListener("load", updateThumbArrows);

        // The shared viewer owns zoom, pan, loading, and lightbox controls.
        galleryFrame.addEventListener("click", () => {
            document.getElementById("lightbox").dispatchEvent(new CustomEvent("lightbox:open", {
                detail: {
                    images: instance.images,
                    index: instance.currentIndex,
                    onNavigate: index => updateDisplay(index, true),
                },
            }));
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
