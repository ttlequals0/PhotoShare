// Browser-side HEIC decoder fallback. The gallery view already serves
// HEIC inside <picture><source type="image/heic"><img src=".jpg"></picture>
// so Safari gets the HEIC and Chrome/Firefox get the JPEG sidecar. This
// module covers the long tail: direct HEIC links shared elsewhere, items
// where the JPEG sidecar somehow didn't generate, etc.
//
// We lazy-load libheif-js only when an <img data-heic-src="..."> reports
// a decode error. Bundle stays light for the common path.

let heifDecoder = null;

async function getDecoder() {
    if (!heifDecoder) {
        const mod = await import('libheif-js');
        heifDecoder = new mod.default.HeifDecoder();
    }
    return heifDecoder;
}

async function decodeHeic(url) {
    const decoder = await getDecoder();
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`fetch ${url} -> ${response.status}`);
    const buffer = await response.arrayBuffer();
    const images = decoder.decode(buffer);
    if (!images.length) throw new Error('no images decoded');

    const image = images[0];
    const width = image.get_width();
    const height = image.get_height();

    return new Promise((resolve, reject) => {
        image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, displayData => {
            if (!displayData) {
                reject(new Error('libheif display failed'));
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(new ImageData(displayData.data, width, height), 0, 0);
            canvas.toBlob(blob => {
                if (!blob) reject(new Error('canvas toBlob failed'));
                else resolve(URL.createObjectURL(blob));
            }, 'image/jpeg', 0.92);
        });
    });
}

function bindFallback() {
    // Single delegated error handler. Catches img-decode failures on any
    // element annotated with data-heic-src.
    document.addEventListener('error', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLImageElement)) return;
        if (!target.dataset.heicSrc) return;
        if (target.dataset.heicFallbackTried === '1') return;
        target.dataset.heicFallbackTried = '1';

        try {
            const blobUrl = await decodeHeic(target.dataset.heicSrc);
            target.src = blobUrl;
        } catch (err) {
            console.warn('HEIC fallback failed:', err);
        }
    }, true); // useCapture so we see <img> errors before they're swallowed
}

export default function init() {
    bindFallback();
}
