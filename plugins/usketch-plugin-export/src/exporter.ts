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
 * data-layer="shapes" のDIVを探してクローンし、シェイプ全体にフィットさせてキャプチャする。
 */
export async function exportCanvas(
	shapes: Map<string, ShapeData>,
	options: ExportOptions,
): Promise<Blob> {
	const shapesLayer = document.querySelector<HTMLElement>('[data-layer="shapes"]');
	if (!shapesLayer) {
		throw new Error("Shapes layer not found");
	}

	const bounds = computeBounds(shapes);
	const pixelRatio = options.pixelRatio ?? 2;
	const background = options.background ?? "#ffffff";

	// シェイプレイヤーのクローンを作成し、独立したコンテナに配置
	const container = document.createElement("div");
	container.style.position = "fixed";
	container.style.left = "-99999px";
	container.style.top = "0";
	container.style.width = `${bounds.width}px`;
	container.style.height = `${bounds.height}px`;
	container.style.overflow = "hidden";
	container.style.background = background;

	// ビューポートをシェイプ全体にフィット（zoom=1, パン位置をオフセット）
	const transformWrapper = document.createElement("div");
	transformWrapper.style.transformOrigin = "0 0";
	transformWrapper.style.transform = `translate(${-bounds.minX}px, ${-bounds.minY}px)`;

	const clone = shapesLayer.cloneNode(true) as HTMLElement;
	transformWrapper.appendChild(clone);
	container.appendChild(transformWrapper);
	document.body.appendChild(container);

	try {
		if (options.format === "svg") {
			const dataUrl = await toSvg(container, {
				width: bounds.width,
				height: bounds.height,
				backgroundColor: background,
			});
			const svgStr = decodeURIComponent(dataUrl.split(",")[1]);
			return new Blob([svgStr], { type: "image/svg+xml" });
		}

		const dataUrl = await toPng(container, {
			width: bounds.width,
			height: bounds.height,
			pixelRatio,
			backgroundColor: background,
		});
		const res = await fetch(dataUrl);
		return res.blob();
	} finally {
		document.body.removeChild(container);
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
