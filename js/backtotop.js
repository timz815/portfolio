"use strict";

(function () {
    const btn = document.createElement("button");
    btn.textContent = "Back to top";
    btn.setAttribute("aria-label", "Back to top");

    Object.assign(btn.style, {
        position: "fixed",
        top: "1rem",
        left: "50%",
        transform: "translateX(-50%) translateY(-120%)",
        background: "#222",
        color: "#fff",
        border: "none",
        borderRadius: "2rem",
        padding: "0.5rem 1.25rem",
        fontSize: "0.9rem",
        cursor: "pointer",
        zIndex: "9999",
        transition: "transform 0.3s ease, opacity 0.3s ease",
        opacity: "0",
        whiteSpace: "nowrap",
    });

    document.body.appendChild(btn);

    let hideTimer = null;
    let visible = false;
    let lastScrollY = window.scrollY;
    let scrollUpStartY = null;
    let scrollDownStartY = null;
    let scrollStopTimer = null;

    const UP_THRESHOLD = 700;
    const MIN_SCROLL_Y = 100;
    const DOWN_THRESHOLD = 25;

    function show() {
        visible = true;
        btn.style.transform = "translateX(-50%) translateY(0)";
        btn.style.opacity = "1";
    }

    function hide() {
        visible = false;
        btn.style.transform = "translateX(-50%) translateY(-120%)";
        btn.style.opacity = "0";
    }

    function resetTimer() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 4000);
    }

    window.addEventListener("scroll", () => {
        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
            scrollUpStartY = null;
        }, 150);

        const currentScrollY = window.scrollY;
        const scrollingUp = currentScrollY < lastScrollY;

        if (!scrollingUp) {
            scrollUpStartY = null;
            if (scrollDownStartY === null) scrollDownStartY = lastScrollY;
            const downDistance = currentScrollY - scrollDownStartY;
            if (downDistance >= DOWN_THRESHOLD) {
                scrollDownStartY = null;
                hide();
                clearTimeout(hideTimer);
            }
        } else {
            scrollDownStartY = null;
            if (currentScrollY < MIN_SCROLL_Y) {
                hide();
                clearTimeout(hideTimer);
                scrollUpStartY = null;
            } else {
                if (scrollUpStartY === null) scrollUpStartY = lastScrollY;
                const upDistance = scrollUpStartY - currentScrollY;
                if (upDistance >= UP_THRESHOLD) {
                    if (!visible) show();
                    resetTimer();
                }
            }
        }

        lastScrollY = currentScrollY;
    }, { passive: true });

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        hide();
        clearTimeout(hideTimer);
        scrollUpStartY = null;
        scrollDownStartY = null;
    });

    btn.addEventListener("mouseenter", () => {
        clearTimeout(hideTimer);
    });

    btn.addEventListener("mouseleave", () => {
        if (visible) resetTimer();
    });
})();
