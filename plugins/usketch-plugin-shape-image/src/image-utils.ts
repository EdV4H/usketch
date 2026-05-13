/** Convert File to base64 data URL */
export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

/**
 * Resize an image data URL if it exceeds `maxDim` along the longest side.
 * Preserves the source MIME type (`image/jpeg`, `image/webp`, …) so a JPEG
 * stays a JPEG instead of being re-encoded as a PNG — which would inflate
 * board payloads (especially photos), since `validateImage` only checks the
 * pre-resize `File.size`.
 *
 * `quality` is applied for lossy encoders (JPEG / WebP); PNG ignores it.
 * MIME types the canvas can't encode fall back to JPEG.
 */
export async function resizeImage(
	dataUrl: string,
	maxDim: number,
	quality = 0.85,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const { width, height } = img;

			if (width <= maxDim && height <= maxDim) {
				resolve(dataUrl);
				return;
			}

			const scale = Math.min(maxDim / width, maxDim / height);
			const newWidth = Math.round(width * scale);
			const newHeight = Math.round(height * scale);

			const canvas = document.createElement("canvas");
			canvas.width = newWidth;
			canvas.height = newHeight;

			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas context"));
				return;
			}

			ctx.drawImage(img, 0, 0, newWidth, newHeight);
			const outputMime = pickOutputMime(dataUrl);
			resolve(canvas.toDataURL(outputMime, quality));
		};
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}

/**
 * Return a MIME the canvas can encode that preserves the source format.
 * Falls back to `image/jpeg` for formats `HTMLCanvasElement.toDataURL` cannot
 * emit (HEIC, AVIF in older browsers, SVG, …).
 */
function pickOutputMime(dataUrl: string): "image/png" | "image/jpeg" | "image/webp" {
	const match = /^data:(image\/[^;]+);/.exec(dataUrl);
	const sourceMime = match?.[1]?.toLowerCase();
	if (sourceMime === "image/png") return "image/png";
	if (sourceMime === "image/webp") return "image/webp";
	// Treat everything else (including jpeg / heic / svg / avif) as jpeg.
	return "image/jpeg";
}

/** Validate image file type and size */
export function validateImage(file: File, maxSizeMB: number): { valid: boolean; error?: string } {
	if (!file.type.startsWith("image/")) {
		return { valid: false, error: `Invalid file type: ${file.type}. Expected an image.` };
	}

	const maxBytes = maxSizeMB * 1024 * 1024;
	if (file.size > maxBytes) {
		return {
			valid: false,
			error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is ${maxSizeMB}MB.`,
		};
	}

	return { valid: true };
}

/** Read the natural pixel dimensions of an image data URL. */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}
