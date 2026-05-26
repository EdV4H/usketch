import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { fileToBase64, resizeImage, validateImage } from "./image-utils.js";
import type { ImageOptions } from "./types.js";

export function createAiImagePlugin(options: ImageOptions): UsketchPlugin {
	const { maxSizeMB = 4, maxDimension = 2048 } = options;

	return {
		id: "usketch-plugin-ai-image",
		name: "AI Image",

		setup(ctx: PluginContext) {
			/** 画像をimageシェイプとしてキャンバスに配置 (image:upload event 経由のみ) */
			async function placeImageShape(file: File): Promise<void> {
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

					// 配置位置: 現在のビューポート中央
					const viewport = ctx.store.getViewport();
					const centerX = -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
					const centerY = -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

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

			// Drop and paste are handled by `usketch-plugin-shape-image` via the
			// external-content registry (`ctx.externalContent`). This plugin only
			// owns the explicit `image:upload` event (file picker entry point).
			const unsubUpload = ctx.events.on("image:upload", handleUpload);

			return () => {
				unsubUpload();
			};
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
