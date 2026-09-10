document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('lightbox');
    if (!box) return;
    const image = document.getElementById('lightbox-image');
    const zoom = document.getElementById('lightbox-zoom');
    const close = document.getElementById('lightbox-close');
    const controls = box.querySelector('.lightbox-controls');
    const navs = ['lightbox-prev-nav', 'lightbox-next-nav'].map(id => document.getElementById(id));
    const counter = document.createElement('div');
    counter.className = 'lightbox-counter';
    box.appendChild(counter);
    let onNavigate = null;
    let images = [], index = 0, request = 0, ready = false;
    let zoomed = false, scale = 1, x = 0, y = 0;
    let gesture = null, dragged = false;
    let previousFocus, previousOverflow, background = [];
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Image viewer');
    image.draggable = false;

    // Keep the fitted layout fixed: zoom and pan only change this transform.
    function render() {
        const maxX = Math.max(0, (image.offsetWidth * scale - box.clientWidth) / 2);
        const maxY = Math.max(0, (image.offsetHeight * scale - box.clientHeight) / 2);
        x = Math.max(-maxX, Math.min(maxX, x));
        y = Math.max(-maxY, Math.min(maxY, y));
        image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        image.classList.toggle('is-zoomed', zoomed);
        zoom.querySelector('span').textContent = zoomed ? 'zoom_out' : 'zoom_in';
        zoom.setAttribute('aria-label', zoomed ? 'Zoom out' : 'Zoom in');
        zoom.setAttribute('aria-pressed', String(zoomed));
        zoom.disabled = !ready;
        navs.forEach(nav => { if (nav) nav.style.display = zoomed || images.length < 2 ? 'none' : ''; });
        counter.textContent = `${index + 1} / ${images.length}`;
        counter.style.display = onNavigate && !zoomed && images.length > 1 ? 'block' : 'none';
    }
    function endGesture() {
        const active = gesture;
        gesture = null;
        if (active && image.hasPointerCapture(active.id)) image.releasePointerCapture(active.id);
        image.classList.remove('is-dragging');
    }
    function reset() {
        endGesture();
        zoomed = false;
        scale = 1;
        x = y = 0;
        render();
    }
    function fit() {
        const width = box.clientWidth, height = box.clientHeight;
        let maxWidth = width * (width <= 692 ? 0.95 : 0.85);
        const maxHeight = height * 0.82;
        const ratio = image.naturalWidth / image.naturalHeight;
        const fittedHeight = Math.min(image.naturalHeight, maxHeight, maxWidth / ratio);
        const toolbar = controls.getBoundingClientRect();
        if (width > 692 && (height - fittedHeight) / 2 < toolbar.bottom) {
            maxWidth = Math.min(maxWidth, Math.max(1, 2 * toolbar.left - width));
        }
        const factor = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
        image.style.width = `${image.naturalWidth * factor}px`;
        image.style.height = `${image.naturalHeight * factor}px`;
    }
    async function showImage() {
        const token = ++request, selected = images[index];
        ready = false;
        image.style.visibility = 'hidden';
        image.classList.remove('has-transparency');
        image.classList.add('is-loading');
        reset();
        const preload = new Image();
        preload.src = selected.src;
        try {
            const [, transparent] = await Promise.all([
                preload.decode(), window.imageHasTransparency(selected.src),
            ]);
            if (token !== request) return;
            image.classList.toggle('has-transparency', transparent);
            image.src = selected.src;
            image.alt = selected.alt;
            await image.decode();
            if (token !== request) return;
            fit();
            image.getBoundingClientRect();
            image.classList.remove('is-loading');
            ready = true;
            image.style.visibility = '';
            render();
        } catch {
            if (token !== request) return;
            image.removeAttribute('src');
            image.alt = 'This image could not be loaded.';
            image.classList.remove('is-loading');
            image.style.visibility = '';
        }
    }
    function open(group, selectedIndex, syncSelection = null) {
        images = group;
        index = selectedIndex;
        onNavigate = syncSelection;
        dragged = false;
        previousFocus = document.activeElement;
        previousOverflow = document.body.style.overflow;
        background = [...document.body.children].filter(el => el !== box && !el.contains(box) && !el.inert);
        background.forEach(el => { el.inert = true; });
        document.body.style.overflow = 'hidden';
        box.hidden = false;
        box.classList.add('active');
        close.focus();
        showImage();
    }
    function dismiss() {
        ++request;
        ready = false;
        images = [];
        onNavigate = null;
        reset();
        box.classList.remove('active');
        box.hidden = true;
        background.forEach(el => { el.inert = false; });
        document.body.style.overflow = previousOverflow;
        previousFocus?.focus();
    }
    function navigate(direction) {
        if (zoomed || images.length < 2) return;
        index = (index + direction + images.length) % images.length;
        onNavigate?.(index);
        showImage();
    }
    function toggleZoom() {
        if (!ready) return;
        endGesture();
        zoomed = !zoomed;
        scale = zoomed ? (box.clientWidth <= 834 ? 1.75 : 1.7) : 1;
        x = y = 0;
        render();
    }
    // Carousels supply their images and a selection callback to this same viewer.
    box.addEventListener('lightbox:open', event => {
        const { images, index, onNavigate } = event.detail;
        open(images, index, onNavigate);
    });
    document.querySelectorAll('.image-board').forEach(board => {
        const items = [...board.querySelectorAll('.image-item')].filter(item => item.querySelector('img'));
        const group = items.map(item => {
            const img = item.querySelector('img');
            return { src: img.currentSrc || img.src, alt: img.alt };
        });
        items.forEach((item, i) => item.addEventListener('click', () => open(group, i)));
    });
    close.addEventListener('click', dismiss);
    zoom.addEventListener('click', toggleZoom);
    document.getElementById('lightbox-prev')?.addEventListener('click', () => navigate(-1));
    document.getElementById('lightbox-next')?.addEventListener('click', () => navigate(1));
    box.addEventListener('click', event => {
        if (event.target === box || event.target.classList.contains('lightbox-content')) dismiss();
    });
    image.addEventListener('click', () => {
        if (!dragged) toggleZoom();
        dragged = false;
    });
    // One pointer implementation handles mouse, pen, and touch.
    image.addEventListener('pointerdown', event => {
        if (!ready || !event.isPrimary || event.button !== 0) return;
        dragged = false;
        if (zoomed) {
            const live = new DOMMatrixReadOnly(getComputedStyle(image).transform);
            scale = live.a; x = live.e; y = live.f;
            image.classList.add('is-dragging');
            render();
        }
        gesture = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
        image.setPointerCapture(event.pointerId);
    });
    image.addEventListener('pointermove', event => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
        if (Math.hypot(dx, dy) > 5) dragged = true;
        if (!zoomed || !dragged) return;
        x = gesture.x + dx; y = gesture.y + dy;
        render();
    });
    image.addEventListener('pointerup', event => {
        if (!gesture || event.pointerId !== gesture.id) return;
        const dx = event.clientX - gesture.startX, dy = event.clientY - gesture.startY;
        endGesture();
        if (zoomed) {
            scale = box.clientWidth <= 834 ? 1.75 : 1.7;
            render();
        } else if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            navigate(dx > 0 ? -1 : 1);
        }
    });
    function cancelGesture() {
        if (!gesture) return;
        dragged = true;
        endGesture();
        scale = zoomed ? (box.clientWidth <= 834 ? 1.75 : 1.7) : 1;
        render();
    }
    image.addEventListener('pointercancel', cancelGesture);
    image.addEventListener('lostpointercapture', cancelGesture);
    document.addEventListener('keydown', event => {
        if (box.hidden) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            zoomed ? toggleZoom() : dismiss();
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            navigate(event.key === 'ArrowLeft' ? -1 : 1);
        } else if (event.key === 'Tab') {
            const buttons = [...box.querySelectorAll('button')].filter(el => !el.disabled && el.getClientRects().length);
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        }
    });
    window.addEventListener('resize', () => {
        if (box.hidden || !ready) return;
        reset();
        fit();
    });
});

/* Preserve thumbnail aspect-ratio sizing. */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.image-item').forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;
        const maxHeight = getComputedStyle(container).getPropertyValue('--thumb-max-height').trim();
        if (!maxHeight) return;
        const fit = () => {
            if (!img.naturalWidth || !img.naturalHeight) return;
            container.style.aspectRatio = img.naturalWidth / img.naturalHeight;
            container.style.maxHeight = maxHeight;
            container.classList.add('js-aspect-fixed');
        };
        img.complete ? fit() : img.addEventListener('load', fit, { once: true });
    });
});
