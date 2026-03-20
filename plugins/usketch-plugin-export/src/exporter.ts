import type { ShapeData } from "@edv4h/usketch-shared";
import { toPng, toSvg } from "html-to-image";

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
 * シェイプレイヤーのみをエクスポートする。
 * Canvasコンテナをクローンし、ビューポートをシェイプ全体にフィットさせ、
 * シェイプレイヤー以外のレイヤーを除外してキャプチャする。
 */
export async function exportCanvas(
	shapes: Map<string, ShapeData>,
	options: ExportOptions,
): Promise<Blob> {
	// Canvasコンテナを取得
	const canvas = document.querySelector<HTMLElement>("[style*='touch-action: none']");
	if (!canvas) throw new Error("Canvas not found");

	const bounds = computeBounds(shapes);
	const pixelRatio = options.pixelRatio ?? 2;
	const background = options.background ?? "#ffffff";

	// クローンを作成してビューポートを上書き
	const clone = canvas.cloneNode(true) as HTMLElement;
	clone.style.position = "fixed";
	clone.style.left = "-99999px";
	clone.style.top = "0";
	clone.style.width = `${bounds.width}px`;
	clone.style.height = `${bounds.height}px`;
	clone.style.background = background;

	// transientレイヤー等を除外（shapesレイヤーのみ残す）
	for (const layerEl of clone.querySelectorAll<HTMLElement>("[data-layer-id]")) {
		if (layerEl.dataset.layerId !== "shapes") {
			layerEl.remove();
		}
	}

	// ビューポートtransformを上書き（zoom=1, シェイプ全体にフィット）
	const transformDiv = clone.querySelector<HTMLElement>("[style*='transform-origin']");
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
