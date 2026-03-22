/** Convert File to base64 data URL */
export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

/** Resize image if exceeds maxDim, returns data URL */
export async function resizeImage(dataUrl: string, maxDim: number): Promise<string> {
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
			resolve(canvas.toDataURL("image/png"));
		};
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
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
