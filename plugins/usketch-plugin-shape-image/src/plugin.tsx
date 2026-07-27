import { type AssetStore, getAssetStore } from "@edv4h/usketch-plugin-asset-store";
import {
	type BoundingBox,
	DEFAULT_STYLE,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { useCallback, useSyncExternalStore } from "react";
import { createImageFileHandler, createImageUrlHandler } from "./external-content-handler.js";
import type { ImageShapeData } from "./types.js";

// Lazily resolves the shared asset store at render/serialize time (these run
// without a PluginContext). Set in setup, so it's order-independent.
let getAssets: (() => AssetStore | undefined) | null = null;

/** The usable src for an image shape: resolve its assetId, else the inline src. */
function resolveSrc(data: ImageShapeData): string | undefined {
	if (data.assetId) return getAssets?.()?.resolve(data.assetId);
	return data.src || undefined;
}

/** Image body — subscribes to the asset store so a late-arriving (remote) asset re-renders. */
function ImageView({ data }: { data: ImageShapeData }) {
	const assets = getAssets?.();
	const subscribe = useCallback((cb: () => void) => assets?.subscribe(cb) ?? (() => {}), [assets]);
	const src = useSyncExternalStore(subscribe, () => resolveSrc(data));
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: data.style.fill,
				border: `${data.style.strokeWidth}px solid ${data.style.stroke}`,
				borderRadius: 4,
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			{src ? (
				<img
					src={src}
					alt=""
					draggable={false}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "contain",
						pointerEvents: "none",
					}}
				/>
			) : (
				<span style={{ color: "#999", fontSize: 13, fontFamily: "system-ui" }}>No image</span>
			)}
		</div>
	);
}

function render(shape: ShapeData) {
	return <ImageView data={shape as ImageShapeData} />;
}

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { ...data, x, y, width: Math.max(40, width), height: Math.max(40, height) };
}

function createDefault(params: { id: string; x: number; y: number }): ImageShapeData {
	return {
		id: params.id,
		type: "image",
		x: params.x,
		y: params.y,
		width: 200,
		height: 150,
		style: { ...DEFAULT_STYLE, fill: "#f5f5f5", strokeWidth: 1, stroke: "#e0e0e0" },
		src: "",
	};
}

function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const src = resolveSrc(shape as ImageShapeData);
	if (!src) return {};
	// Image `src` can be a base64 Data URL that easily blows past LLM token
	// budgets (and may leak embedded image bytes into prompts). Return a small
	// summary instead — the shape's `type === "image"` already tells the AI
	// this is an image; consumers who actually need pixel data should use
	// `serializeForRecognition`.
	const isDataUrl = src.startsWith("data:");
	return isDataUrl
		? { srcKind: "data", srcLength: src.length }
		: { srcKind: "url", srcOrigin: safeOrigin(src) };
}

function safeOrigin(url: string): string {
	try {
		return new URL(url).origin;
	} catch {
		return "<invalid>";
	}
}

function serializeForRecognition(shape: ShapeData): unknown {
	const src = resolveSrc(shape as ImageShapeData);
	if (!src) return null;
	return { kind: "image", src };
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as ImageShapeData;
	return { assetId: data.assetId ?? "", src: resolveSrc(data) ?? "" };
}

export function createImageShapePlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-image",
		name: "画像",

		setup(ctx: PluginContext) {
			ctx.shapes.register("image", {
				render,
				getBounds,
				hitTest: withRotation(hitTest),
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 40, height: 40 },
				serializeForAi,
				serializeForRecognition,
				debugFields,
			});

			// Resolve the asset store lazily at render/serialize time (order-independent).
			getAssets = () => getAssetStore(ctx);

			// Self-register the default "image file → image shape" external-content
			// handler at order 0. Apps and third-party plugins can override by
			// registering a higher-`order` `kind: "file"` handler. The handler stores
			// imported images in the asset store (content-addressed) when available.
			const unregisterHandler = ctx.externalContent.register(
				createImageFileHandler({}, () => getAssetStore(ctx)),
			);
			// `.svg` URL drop/paste → image shape (above embed's generic URL handler).
			const unregisterUrlHandler = ctx.externalContent.register(createImageUrlHandler());

			return () => {
				unregisterHandler();
				unregisterUrlHandler();
				getAssets = null;
			};
		},
	};
}
