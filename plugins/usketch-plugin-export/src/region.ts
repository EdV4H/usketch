import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
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
}

/** 回転を考慮した外接矩形が rect と交差するか */
function intersects(shape: ShapeData, rect: RegionRect): boolean {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const rad = ((shape.rotation ?? 0) * Math.PI) / 180;
	const cos = Math.abs(Math.cos(rad));
	const sin = Math.abs(Math.sin(rad));
	const hw = (shape.width * cos + shape.height * sin) / 2;
	const hh = (shape.width * sin + shape.height * cos) / 2;
	return (
		cx + hw > rect.x &&
		cx - hw < rect.x + rect.width &&
		cy + hh > rect.y &&
		cy - hh < rect.y + rect.height
	);
}

/** zIndex(分数インデックス: 辞書順で大きいほど前面) の昇順。未設定は最背面。 */
function byZIndex(a: ShapeData, b: ShapeData): number {
	const za = a.zIndex ?? "";
	const zb = b.zIndex ?? "";
	return za < zb ? -1 : za > zb ? 1 : 0;
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

	const targets = [...shapes.values()]
		.filter((s) => !s.hidden && intersects(s, rect) && (filter ? filter(s) : true))
		.sort(byZIndex);

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
${elements.join("\n")}
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
