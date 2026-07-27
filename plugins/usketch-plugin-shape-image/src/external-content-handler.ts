import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import type {
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ExternalContentOf,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { fileToBase64, getImageDimensions, resizeImage, validateImage } from "./image-utils.js";
import {
	isSvgFile,
	isSvgUrl,
	readFileAsText,
	sanitizeSvg,
	svgIntrinsicSize,
	svgToDataUri,
} from "./svg-utils.js";

/** Resolve the shared asset store lazily (undefined if the plugin isn't wired). */
export type GetAssetStore = () => AssetStore | undefined;

export interface ImageFileHandlerOptions {
	/**
	 * Max accepted size per file. Default 4 (MB). Larger files are rejected and
	 * the handler emits an `ai:status` error event so the host UI can surface
	 * the failure.
	 */
	maxSizeMB?: number;
	/** Resize threshold in pixels for the longest dimension. Default 2048. */
	maxDimension?: number;
	/** Default 0 (lowest, so third-party plugins win). */
	order?: number;
	/** Cap on the displayed shape width/height in world units. Default 400. */
	maxRenderedSize?: number;
	/** Horizontal gap (world units) when laying out multiple files. Default 20. */
	gap?: number;
}

/**
 * Default external-content handler that turns a drop / paste of image files
 * into image shapes on the canvas. Registered at `order: 0` (lowest) so
 * any third-party plugin can override by registering with a higher order.
 *
 * The shape is placed centered on the current viewport because the
 * external-content payload intentionally does not carry a drop/paste world
 * point — handlers decide their own placement strategy. A future canvas-engine
 * read API may expose the last pointer position for handlers that want it.
 */
export function createImageFileHandler(
	options: ImageFileHandlerOptions = {},
	getAssets?: GetAssetStore,
): ExternalContentHandler<"file"> {
	const {
		maxSizeMB = 4,
		maxDimension = 2048,
		order = 0,
		maxRenderedSize = 400,
		gap = 20,
	} = options;

	return {
		id: "usketch-plugin-shape-image:image-file",
		kind: "file",
		order,
		match: (content) =>
			content.files.length > 0 && content.files.every((f) => f.type.startsWith("image/")),
		handle: async (content, ctx) => {
			const base = viewportCenterToWorld(ctx);
			let offsetX = 0;
			for (const file of content.files) {
				await placeImageShape(file, ctx, {
					worldPoint: { x: base.x + offsetX, y: base.y },
					maxSizeMB,
					maxDimension,
					maxRenderedSize,
					assets: getAssets?.(),
				});
				offsetX += maxRenderedSize + gap;
			}
		},
	};
}

/**
 * Convert the visible screen center to world coordinates using the current
 * viewport. The world-space center is `viewport-screen-center / zoom - viewport-origin`,
 * accounting for pan and zoom so dropped/pasted images land where the user
 * is actually looking — not at an arbitrary screen-space point.
 */
function viewportCenterToWorld(ctx: ExternalContentHandlerCtx): { x: number; y: number } {
	const vp = ctx.store.getViewport();
	const screenW = typeof window !== "undefined" ? window.innerWidth : 0;
	const screenH = typeof window !== "undefined" ? window.innerHeight : 0;
	return {
		x: (screenW / 2 - vp.x) / vp.zoom,
		y: (screenH / 2 - vp.y) / vp.zoom,
	};
}

interface PlaceOptions {
	worldPoint: { x: number; y: number };
	maxSizeMB: number;
	maxDimension: number;
	maxRenderedSize: number;
	assets?: AssetStore;
}

async function placeImageShape(
	file: File,
	ctx: ExternalContentHandlerCtx,
	opts: PlaceOptions,
): Promise<void> {
	const validation = validateImage(file, opts.maxSizeMB);
	if (!validation.valid) {
		// Same status channel ai-image used. Hosts that subscribe still see errors.
		ctx.events.emit("ai:status", { status: "error", message: validation.error });
		return;
	}

	let dataUrl: string;
	let dimensions: { width: number; height: number };
	let mimeType = file.type;

	if (isSvgFile(file)) {
		// Keep SVG as vector: sanitize the markup and embed it as an SVG data URI
		// (no rasterization / JPEG re-encode). Size comes from width/height/viewBox.
		try {
			const raw = await readFileAsText(file);
			const clean = sanitizeSvg(raw);
			if (!clean) {
				ctx.events.emit("ai:status", { status: "error", message: "Invalid or unsafe SVG" });
				return;
			}
			dataUrl = svgToDataUri(clean);
			dimensions = svgIntrinsicSize(clean, opts.maxRenderedSize);
			mimeType = "image/svg+xml";
		} catch (err) {
			ctx.events.emit("ai:status", {
				status: "error",
				message: err instanceof Error ? err.message : "Failed to read SVG",
			});
			return;
		}
	} else {
		try {
			dataUrl = await fileToBase64(file);
			dataUrl = await resizeImage(dataUrl, opts.maxDimension);
		} catch (err) {
			ctx.events.emit("ai:status", {
				status: "error",
				message: err instanceof Error ? err.message : "Failed to process image",
			});
			return;
		}

		try {
			dimensions = await getImageDimensions(dataUrl);
		} catch (err) {
			ctx.events.emit("ai:status", {
				status: "error",
				message: err instanceof Error ? err.message : "Failed to read image",
			});
			return;
		}
	}

	const scale = Math.min(
		opts.maxRenderedSize / dimensions.width,
		opts.maxRenderedSize / dimensions.height,
		1,
	);
	const w = Math.round(dimensions.width * scale);
	const h = Math.round(dimensions.height * scale);

	// Prefer the content-addressed asset store: the shape holds only an assetId,
	// so duplicating it reuses the same asset (no base64 duplication, synced once).
	// Falls back to an inline data URL when no asset store is wired.
	let assetId: string | undefined;
	if (opts.assets) {
		try {
			assetId = await opts.assets.upload("image", dataUrl, {
				w: dimensions.width,
				h: dimensions.height,
				mimeType,
				size: file.size,
			});
		} catch {
			assetId = undefined; // fall back to inline src below
		}
	}

	const id = generateId();
	const shape = {
		id,
		type: "image",
		x: Math.round(opts.worldPoint.x - w / 2),
		y: Math.round(opts.worldPoint.y - h / 2),
		width: w,
		height: h,
		style: {
			fill: "#f5f5f5",
			stroke: "#e0e0e0",
			strokeWidth: 1,
			opacity: 1,
		},
		src: assetId ? "" : dataUrl,
		...(assetId ? { assetId } : {}),
	};

	ctx.commands.execute({
		execute: () => ctx.store.addShape(shape),
		undo: () => ctx.store.deleteShape(id),
	});
	ctx.store.setSelection([id]);
}

export interface ImageUrlHandlerOptions {
	/** Larger than the embed generic handler (order 0) so `.svg` URLs win. Default 5. */
	order?: number;
	/** Default rendered size (world units) for a URL image (no intrinsic size fetch). Default 200. */
	size?: number;
}

/**
 * `kind:"url"` handler: a dropped/pasted `.svg` URL becomes an image shape that
 * renders it via `<img src>` (script-safe by the `<img>` non-scripting context;
 * a remote SVG can't be sanitized locally). Registered above the embed generic
 * URL handler (order 0) so `.svg` links become images, not a generic iframe.
 * Only `.svg` URLs match — other links fall through to embed as before.
 */
export function createImageUrlHandler(
	options: ImageUrlHandlerOptions = {},
): ExternalContentHandler<"url"> {
	const { order = 5, size = 200 } = options;
	return {
		id: "usketch-plugin-shape-image:image-url",
		kind: "url",
		order,
		match: (content) => isSvgUrl(content.url),
		handle: (content, ctx) => {
			const base = viewportCenterToWorld(ctx);
			const id = generateId();
			const shape = {
				id,
				type: "image",
				x: Math.round(base.x - size / 2),
				y: Math.round(base.y - size / 2),
				width: size,
				height: size,
				style: { fill: "#f5f5f5", stroke: "#e0e0e0", strokeWidth: 1, opacity: 1 },
				src: content.url,
			};
			ctx.commands.execute({
				execute: () => ctx.store.addShape(shape),
				undo: () => ctx.store.deleteShape(id),
			});
			ctx.store.setSelection([id]);
		},
	};
}

// Re-export narrowed File content type for test convenience.
export type ImageFileContent = ExternalContentOf<"file">;
