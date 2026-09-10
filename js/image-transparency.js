// Share one alpha check per source between the carousel and the lightbox.
window.imageHasTransparency = (() => {
    const checks = new Map();
    async function inspect(src) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = src;
        try {
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 256;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            // Read at native resolution in small tiles, including partial alpha.
            for (let y = 0; y < image.naturalHeight; y += 256) {
                for (let x = 0; x < image.naturalWidth; x += 256) {
                    const width = Math.min(256, image.naturalWidth - x);
                    const height = Math.min(256, image.naturalHeight - y);
                    context.clearRect(0, 0, 256, 256);
                    context.drawImage(image, x, y, width, height, 0, 0, width, height);
                    const pixels = context.getImageData(0, 0, width, height).data;
                    for (let i = 3; i < pixels.length; i += 4) {
                        if (pixels[i] < 255) return true;
                    }
                }
            }
            return false;
        } catch {
            // An unreadable/CORS-blocked image can still be displayed normally.
            return false;
        }
    }
    return src => {
        if (!checks.has(src)) checks.set(src, inspect(src));
        return checks.get(src);
    };
})();
