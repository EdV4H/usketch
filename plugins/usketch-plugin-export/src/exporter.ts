import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { renderToStaticMarkup } from "react-dom/server";

/** シェイプ全体のバウンディングボックスを計算 */
function computeBounds(shapes: Map<string, ShapeData>) {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const shape of shapes.values()) {
		minX = Math.min(minX, shape.x);
		minY = Math.min(minY, shape.y);
		maxX = Math.max(maxX, shape.x + shape.width);
		maxY = Math.max(maxY, shape.y + shape.height);
	}

	if (!Number.isFinite(minX)) {
		return { minX: 0, minY: 0, width: 100, height: 100 };
	}

	const padding = 20;
	return {
		minX: minX - padding,
		minY: minY - padding,
		width: maxX - minX + padding * 2,
		height: maxY - minY + padding * 2,
	};
}

export interface ExportOptions {
	format: "png" | "svg";
	pixelRatio?: number;
	background?: string;
}

/**
 * シェイプデータからSVG文字列を構築してエクスポートする。
 * DOMクローンに依存せず、ShapeRegistryのrender関数を使用。
 */
export async function exportCanvas(
	shapes: Map<string, ShapeData>,
	shapeRegistry: ShapeRegistry,
	options: ExportOptions,
): Promise<Blob> {
	if (shapes.size === 0) {
		throw new Error("No shapes to export");
	}

	const bounds = computeBounds(shapes);
	const background = options.background ?? "#ffffff";

	// 各シェイプのSVG要素をrenderToStaticMarkupで文字列化
	const shapeElements: string[] = [];
	for (const shape of shapes.values()) {
		const def = shapeRegistry.get(shape.type);
		if (!def) continue;

		const element = def.render(shape);
		const markup = renderToStaticMarkup(element);
		shapeElements.push(markup);
	}

	const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}">
<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${background}" />
${shapeElements.join("\n")}
</svg>`;

	if (options.format === "svg") {
		return new Blob([svgContent], { type: "image/svg+xml" });
	}

	// PNG: SVGをCanvasに描画してBlobに変換
	const pixelRatio = options.pixelRatio ?? 2;
	const img = new Image();
	const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
	const url = URL.createObjectURL(svgBlob);

	return new Promise<Blob>((resolve, reject) => {
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = bounds.width * pixelRatio;
			canvas.height = bounds.height * pixelRatio;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Failed to get canvas context"));
				return;
			}
			ctx.scale(pixelRatio, pixelRatio);
			ctx.drawImage(img, 0, 0, bounds.width, bounds.height);
			URL.revokeObjectURL(url);

			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error("Failed to create PNG blob"));
				},
				"image/png",
				1,
			);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("Failed to load SVG for PNG conversion"));
		};
		img.src = url;
	});
}

/** Blobをファイルとしてダウンロードする */
export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}
