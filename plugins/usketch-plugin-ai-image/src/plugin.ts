import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { fileToBase64, resizeImage, validateImage } from "./image-utils.js";
import type { ImageOptions } from "./types.js";

const DEFAULT_PROMPT =
	"Analyze this image and recreate its structure as editable shapes on the canvas. Create rectangles, ellipses, and text shapes that match the layout.";

export function createAiImagePlugin(options: ImageOptions): UsketchPlugin {
	const { boardId, maxSizeMB = 4, maxDimension = 2048 } = options;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-image",
		name: "AI Image",

		setup(ctx: PluginContext) {
			/** Process an image file: validate, resize, convert, and emit ai:request */
			async function processImageFile(file: File): Promise<void> {
				const validation = validateImage(file, maxSizeMB);
				if (!validation.valid) {
					ctx.events.emit("ai:status", {
						status: "error",
						message: validation.error,
					});
					return;
				}

				try {
					let dataUrl = await fileToBase64(file);
					dataUrl = await resizeImage(dataUrl, maxDimension);

					ctx.events.emit("ai:request", {
						prompt: DEFAULT_PROMPT,
						boardId,
						image: dataUrl,
					});
				} catch (err) {
					ctx.events.emit("ai:status", {
						status: "error",
						message: err instanceof Error ? err.message : "Failed to process image",
					});
				}
			}

			/** Handle paste events with image data */
			function handlePaste(event: ClipboardEvent): void {
				const items = event.clipboardData?.items;
				if (!items) return;

				for (const item of items) {
					if (item.type.startsWith("image/")) {
						const file = item.getAsFile();
						if (file) {
							event.preventDefault();
							processImageFile(file);
							return;
						}
					}
				}
			}

			/** Handle image:upload event — open file picker */
			function handleUpload(): void {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "image/*";
				input.style.display = "none";

				input.addEventListener("change", () => {
					const file = input.files?.[0];
					if (file) {
						processImageFile(file);
					}
					input.remove();
				});

				document.body.appendChild(input);
				input.click();
			}

			window.addEventListener("paste", handlePaste);
			const unsubUpload = ctx.events.on("image:upload", handleUpload);

			cleanup = () => {
				window.removeEventListener("paste", handlePaste);
				unsubUpload();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}
