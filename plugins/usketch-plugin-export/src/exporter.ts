import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import satori from "satori";

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

let fontCache: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
	if (fontCache) return fontCache;
	// Inter Regular ttf（Satoriはwoff2非対応、ttf/otfのみ）
	const res = await fetch(
		"https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
	);
	fontCache = await res.arrayBuffer();
	return fontCache;
}

/** HTMLシェイプをSatoriでSVG文字列に変換（foreignObject不使用、taint安全） */
async function htmlShapeToSvg(element: ReactNode, shape: ShapeData): Promise<string> {
	const fontData = await loadFont();
	const svg = await satori(element as React.ReactElement, {
		width: shape.width,
		height: shape.height,
		fonts: [
			{
				name: "Inter",
				data: fontData,
				weight: 400,
				style: "normal",
			},
		],
	});
	// SatoriのSVGからルート<svg>タグを除去し、中身をグループ化
	const inner = svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>$/, "");
	return `<g transform="translate(${shape.x}, ${shape.y})">${inner}</g>`;
}

/**
 * シェイプデータからSVG文字列を構築してエクスポートする。
 *
 * - SVGシェイプ → renderToStaticMarkupでSVG要素化
 * - HTMLシェイプ → SVGエクスポート: foreignObject、PNGエクスポート: Satori
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
	const useSatori = options.format === "png"; // PNG時のみSatori使用

	const shapeElements: string[] = [];
	for (const shape of shapes.values()) {
		const def = shapeRegistry.get(shape.type);
		if (!def) continue;

		const element = def.render(shape);

		if (def.renderTarget === "html") {
			if (useSatori) {
				// PNG: SatoriでHTMLをSVGに変換（taint安全）
				const svgMarkup = await htmlShapeToSvg(element, shape);
				shapeElements.push(svgMarkup);
			} else {
				// SVG: foreignObjectでHTMLを埋め込み（ブラウザで正常表示される）
				const markup = renderToStaticMarkup(element);
				shapeElements.push(
					`<foreignObject x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}">
<div xmlns="http://www.w3.org/1999/xhtml">${markup}</div>
</foreignObject>`,
				);
			}
		} else {
			const markup = renderToStaticMarkup(element);
			shapeElements.push(markup);
		}
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
