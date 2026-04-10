import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { fileToBase64, resizeImage, validateImage } from "./image-utils.js";
import type { ImageOptions } from "./types.js";

export function createAiImagePlugin(options: ImageOptions): UsketchPlugin {
	const { maxSizeMB = 4, maxDimension = 2048 } = options;
	let cleanup: (() => void) | undefined;

	return {
		id: "usketch-plugin-ai-image",
		name: "AI Image",

		setup(ctx: PluginContext) {
			/** 画像をimageシェイプとしてキャンバスに配置 */
			async function placeImageShape(
				file: File,
				dropWorldPoint?: { x: number; y: number },
			): Promise<void> {
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

					// 配置位置: ドロップ位置があればそこ、なければビューポート中央
					let centerX: number;
					let centerY: number;
					if (dropWorldPoint) {
						centerX = dropWorldPoint.x;
						centerY = dropWorldPoint.y;
					} else {
						const viewport = ctx.store.getViewport();
						centerX = -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
						centerY = -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;
					}

					// 画像サイズを取得してアスペクト比を維持
					const { width, height } = await getImageDimensions(dataUrl);
					const maxSize = 400;
					const scale = Math.min(maxSize / width, maxSize / height, 1);
					const w = Math.round(width * scale);
					const h = Math.round(height * scale);

					const id = generateId();
					const shape = {
						id,
						type: "image",
						x: Math.round(centerX - w / 2),
						y: Math.round(centerY - h / 2),
						width: w,
						height: h,
						style: {
							fill: "#f5f5f5",
							stroke: "#e0e0e0",
							strokeWidth: 1,
							opacity: 1,
						},
						src: dataUrl,
					};

					ctx.commands.execute({
						execute: () => ctx.store.addShape(shape),
						undo: () => ctx.store.deleteShape(id),
					});
					ctx.store.setSelection([id]);
				} catch (err) {
					ctx.events.emit("ai:status", {
						status: "error",
						message: err instanceof Error ? err.message : "Failed to process image",
					});
				}
			}

			/** Handle paste events with image data */
			function handlePaste(event: ClipboardEvent): void {
				// テキスト入力中はスキップ
				const tag = (event.target as HTMLElement)?.tagName;
				if (
					tag === "INPUT" ||
					tag === "TEXTAREA" ||
					(event.target as HTMLElement)?.isContentEditable
				) {
					return;
				}

				const items = event.clipboardData?.items;
				if (!items) return;

				for (const item of items) {
					if (item.type.startsWith("image/")) {
						const file = item.getAsFile();
						if (file) {
							event.preventDefault();
							placeImageShape(file);
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

				const removeInput = () => input.remove();

				input.addEventListener("change", () => {
					const file = input.files?.[0];
					if (file) {
						placeImageShape(file);
					}
					removeInput();
				});
				// キャンセル時にもDOMから除去
				input.addEventListener("cancel", removeInput);

				document.body.appendChild(input);
				input.click();
			}

			/** Handle file drop on canvas */
			const unsubDrop = ctx.events.on("canvas:drop", async (data) => {
				const imageFiles = Array.from(data.files).filter((f) => f.type.startsWith("image/"));
				if (imageFiles.length === 0) return;

				const maxRenderedWidth = 400;
				const gap = 20;
				let offsetX = 0;
				for (const file of imageFiles) {
					await placeImageShape(file, { x: data.worldPoint.x + offsetX, y: data.worldPoint.y });
					offsetX += maxRenderedWidth + gap;
				}
			});

			window.addEventListener("paste", handlePaste);
			const unsubUpload = ctx.events.on("image:upload", handleUpload);

			cleanup = () => {
				window.removeEventListener("paste", handlePaste);
				unsubUpload();
				unsubDrop();
			};
		},

		teardown() {
			cleanup?.();
		},
	};
}

/** 画像の実寸サイズを取得 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error("Failed to load image"));
		img.src = dataUrl;
	});
}
