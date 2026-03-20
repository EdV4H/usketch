import type { ShapeData } from "@edv4h/usketch-shared";
import { toPng, toSvg } from "html-to-image";

/** シェイプ全体のバウンディングボックスを計算 */
function computeBounds(shapes: Map<string, ShapeData>): {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
} {
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
		return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
	}

	const padding = 20;
	return {
		minX: minX - padding,
		minY: minY - padding,
		maxX: maxX + padding,
		maxY: maxY + padding,
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
 * キャンバスのシェイプレイヤーをエクスポートする。
 * canvasContainer はCanvas コンポーネントのルートDIV要素。
 */
export async function exportCanvas(
	canvasContainer: HTMLElement,
	shapes: Map<string, ShapeData>,
	options: ExportOptions,
): Promise<Blob> {
	const bounds = computeBounds(shapes);
	const pixelRatio = options.pixelRatio ?? 2;
	const background = options.background ?? "#ffffff";

	// ビューポートをシェイプ全体にフィットさせるため、一時的にクローンを作成
	const clone = canvasContainer.cloneNode(true) as HTMLElement;
	clone.style.position = "fixed";
	clone.style.left = "-99999px";
	clone.style.top = "0";
	clone.style.width = `${bounds.width}px`;
	clone.style.height = `${bounds.height}px`;
	clone.style.background = background;

	// ビューポートトランスフォームを上書き（zoom=1, シェイプ領域にパン）
	const transformDiv = clone.querySelector<HTMLElement>("[style*='transformOrigin']");
	if (transformDiv) {
		transformDiv.style.transform = `translate(${-bounds.minX}px, ${-bounds.minY}px) scale(1)`;
	}

	document.body.appendChild(clone);

	try {
		if (options.format === "svg") {
			const dataUrl = await toSvg(clone, {
				width: bounds.width,
				height: bounds.height,
				backgroundColor: background,
			});
			const svgStr = decodeURIComponent(dataUrl.split(",")[1]);
			return new Blob([svgStr], { type: "image/svg+xml" });
		}

		const dataUrl = await toPng(clone, {
			width: bounds.width,
			height: bounds.height,
			pixelRatio,
			backgroundColor: background,
		});
		const res = await fetch(dataUrl);
		return res.blob();
	} finally {
		document.body.removeChild(clone);
	}
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
