import {
	compareZIndex,
	getShapeAABB,
	type Layer,
	type LayerManager,
	rectsIntersect,
	type ShapeData,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";
import { renderToStaticMarkup } from "react-dom/server";
import { htmlShapeToSvg, type SatoriFont } from "./exporter.js";

export interface RegionRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface ExportRegionOptions {
	/** ボード座標の矩形 */
	rect: RegionRect;
	pixelRatio?: number;
	/** 省略時は透明 */
	background?: string;
	/** false を返したシェイプは描画しない */
	filter?: (shape: ShapeData) => boolean;
	/** HTML シェイプ描画用フォント（日本語フォントなどをホストが渡す）。省略時は Inter(latin) */
	fonts?: SatoriFont[];
	/**
	 * true で背景レイヤー（`Layer.renderExportBackground` を持つレイヤー。bg-grid / bg-dots 等）を
	 * `background` の上・シェイプの下に `order` 昇順で描く。既定 false（背景は `background` のみ）。
	 * true のときは `layers` が必須。
	 */
	includeBackgroundLayers?: boolean;
	/** 背景レイヤーの取得元。通常はホストの `app.layers` を渡す */
	layers?: LayerManager | readonly Layer[];
	/**
	 * 背景レイヤーをどのズームの見た目で描くか。既定 1（ボード座標基準 = 100% 表示の見た目）。
	 * 撮影時の `viewport.zoom` を渡すと画面と同じ見た目（例: グリッド線幅 1px = 1/zoom ボード単位）になる。
	 * グリッド間隔・ドット位置はもともとボード座標固定なので、どちらでも変わらない。
	 */
	backgroundZoom?: number;
}

function renderBackgroundLayers(options: ExportRegionOptions): string[] {
	const { includeBackgroundLayers, layers, rect, backgroundZoom = 1 } = options;
	if (!includeBackgroundLayers) return [];
	if (!layers) {
		throw new Error("exportRegion: includeBackgroundLayers requires `layers` (e.g. app.layers)");
	}
	if (!(backgroundZoom > 0)) {
		throw new Error("exportRegion: backgroundZoom must be a positive number");
	}
	const list = "getLayers" in layers ? layers.getLayers() : layers;
	const markup: string[] = [];
	for (const layer of [...list].sort((a, b) => a.order - b.order)) {
		if (!layer.renderExportBackground) continue;
		const element = layer.renderExportBackground({
			rect,
			zoom: backgroundZoom,
			idPrefix: `usketch-bg-${layer.id.replace(/[^\w-]/g, "_")}`,
		});
		if (element) markup.push(renderToStaticMarkup(element));
	}
	return markup;
}

/**
 * ボード座標の矩形を、画面と同じ z-order・回転で SVG 文字列にする（矩形外はクリップ）。
 * HTML シェイプは Satori で SVG 化する（foreignObject 不使用、taint 安全）。
 */
export async function buildRegionSvg(
	shapes: Map<string, ShapeData>,
	shapeRegistry: ShapeRegistry,
	options: ExportRegionOptions,
): Promise<string> {
	const { rect, background, filter, fonts } = options;
	if (!(rect.width > 0) || !(rect.height > 0)) {
		throw new Error("exportRegion: rect must have positive width and height");
	}

	const backgroundLayers = renderBackgroundLayers(options);

	const targets = [...shapes.values()]
		.filter(
			(s) => !s.hidden && rectsIntersect(getShapeAABB(s), rect) && (filter ? filter(s) : true),
		)
		.sort((a, b) => compareZIndex(a.zIndex, b.zIndex));

	const elements: string[] = [];
	for (const shape of targets) {
		const def = shapeRegistry.get(shape.type);
		if (!def) continue;
		const element = def.render(shape);
		const markup =
			def.renderTarget === "html"
				? await htmlShapeToSvg(element, shape, fonts)
				: renderToStaticMarkup(element);
		const rotation = shape.rotation ?? 0;
		elements.push(
			rotation
				? `<g transform="rotate(${rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})">${markup}</g>`
				: markup,
		);
	}

	const bg = background
		? `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${background}" />`
		: "";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="${rect.x} ${rect.y} ${rect.width} ${rect.height}">
<defs><clipPath id="usketch-region"><rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" /></clipPath></defs>
${bg}
<g clip-path="url(#usketch-region)">
${[...backgroundLayers, ...elements].join("\n")}
</g>
</svg>`;
}

/**
 * ボード座標の矩形を PNG にする。canvas が taint された場合は空白にせずエラーにする。
 */
export async function exportRegion(
	shapes: Map<string, ShapeData>,
	shapeRegistry: ShapeRegistry,
	options: ExportRegionOptions,
): Promise<Blob> {
	const svg = await buildRegionSvg(shapes, shapeRegistry, options);
	const { width, height } = options.rect;
	const pixelRatio = options.pixelRatio ?? 2;

	const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
	try {
		const img = new Image();
		img.crossOrigin = "anonymous";
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error("exportRegion: failed to load SVG"));
			img.src = url;
		});

		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(width * pixelRatio);
		canvas.height = Math.ceil(height * pixelRatio);
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("exportRegion: failed to get canvas context");
		ctx.scale(pixelRatio, pixelRatio);
		ctx.drawImage(img, 0, 0, width, height);

		return await new Promise<Blob>((resolve, reject) => {
			try {
				canvas.toBlob(
					(blob) =>
						blob ? resolve(blob) : reject(new Error("exportRegion: failed to create PNG blob")),
					"image/png",
				);
			} catch (e) {
				// taint 時は SecurityError
				reject(
					new Error(
						`exportRegion: canvas is tainted (cross-origin image without CORS?): ${
							e instanceof Error ? e.message : String(e)
						}`,
					),
				);
			}
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}
