import {
	compareZIndex,
	getShapeAABB,
	isShapeHidden,
	type ShapeData,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import satori, { type SatoriOptions } from "satori";

/**
 * 書き出すシェイプを画面と同じ重なり順（zIndex 昇順）で返す。`hidden` のシェイプと、
 * `include` が false を返すシェイプは除く。全体・全ページ・範囲の書き出しで共通。
 */
export function exportTargets(
	shapes: ReadonlyMap<string, ShapeData>,
	include?: (shape: ShapeData) => boolean,
): ShapeData[] {
	const targets: ShapeData[] = [];
	for (const shape of shapes.values()) {
		if (!isShapeHidden(shape) && (!include || include(shape))) targets.push(shape);
	}
	return targets.sort((a, b) => compareZIndex(a.zIndex, b.zIndex));
}

/** シェイプの回転を、画面と同じく中心まわりの `<g transform="rotate(...)">` で付ける。 */
export function withRotation(shape: ShapeData, markup: string): string {
	const rotation = shape.rotation ?? 0;
	return rotation
		? `<g transform="rotate(${rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})">${markup}</g>`
		: markup;
}

/** シェイプ全体のバウンディングボックスを計算（回転したシェイプは回転後の外接矩形） */
function computeBounds(shapes: readonly ShapeData[]) {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const shape of shapes) {
		const box = getShapeAABB(shape);
		minX = Math.min(minX, box.x);
		minY = Math.min(minY, box.y);
		maxX = Math.max(maxX, box.x + box.width);
		maxY = Math.max(maxY, box.y + box.height);
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
	const res = await fetch(
		"https://cdn.jsdelivr.net/fontsource/fonts/inter@5.1.1/latin-400-normal.ttf",
	);
	if (!res.ok) {
		throw new Error(`Failed to load font: ${res.status}`);
	}
	fontCache = await res.arrayBuffer();
	return fontCache;
}

// Satori の出力ごとに振る通し番号。shape.id から作ると id の文字種によっては別シェイプが
// 同じ名前空間になり、同じシェイプを 2 回描いたときも衝突するため、呼び出しごとに分ける。
let satoriScopeSeq = 0;

/** HTMLシェイプをSatoriでSVG文字列に変換（foreignObject不使用、taint安全） */
export async function htmlShapeToSvg(
	element: ReactNode,
	shape: ShapeData,
	fonts?: SatoriFont[],
	loadAdditionalAsset?: SatoriOptions["loadAdditionalAsset"],
): Promise<string> {
	const resolvedFonts = fonts ?? [
		{ name: "Inter", data: await loadFont(), weight: 400 as const, style: "normal" as const },
	];
	const svg = await satori(element as ReactElement, {
		width: shape.width,
		height: shape.height,
		fonts: resolvedFonts,
		...(loadAdditionalAsset ? { loadAdditionalAsset } : {}),
	});
	const inner = svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>$/, "");
	satoriScopeSeq += 1;
	return `<g transform="translate(${shape.x}, ${shape.y})">${scopeSatoriIds(inner, `s${satoriScopeSeq}`)}</g>`;
}

/**
 * Satori は呼び出しごとに同じ id（`satori_cp-id` など）で clipPath / mask を出すため、
 * 複数シェイプの SVG を 1 枚に並べると後のシェイプが先のシェイプの clipPath を参照してしまい、
 * 切り抜きがずれる（文字が欠ける・要素が消える）。出力ごとに id と参照を名前空間で分ける。
 * `scope` は id に使える文字（英数字・`-`・`_`）だけにすること。
 */
export function scopeSatoriIds(markup: string, scope: string): string {
	return markup.replace(/(\sid="|url\(#|href="#)satori_/g, `$1satori_${scope}_`);
}

export type SatoriFont = SatoriOptions["fonts"][number];

/**
 * シェイプを SVG の要素（文字列）にする。`shapes` は {@link exportTargets} の結果（描く順）。
 * HTML シェイプは PNG なら Satori、SVG なら foreignObject。
 */
async function renderShapeElements(
	shapes: readonly ShapeData[],
	shapeRegistry: ShapeRegistry,
	useSatori: boolean,
): Promise<string[]> {
	const shapeElements: string[] = [];
	for (const shape of shapes) {
		const def = shapeRegistry.get(shape.type);
		if (!def) continue;

		const element = (def.renderForExport ?? def.render)(shape);

		let markup: string;
		if (def.renderTarget === "html") {
			markup = useSatori
				? await htmlShapeToSvg(element, shape)
				: `<foreignObject x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}">
<div xmlns="http://www.w3.org/1999/xhtml">${renderToStaticMarkup(element)}</div>
</foreignObject>`;
		} else {
			markup = renderToStaticMarkup(element);
		}
		shapeElements.push(withRotation(shape, markup));
	}
	return shapeElements;
}

/** SVG 文字列を PNG にする（`width` × `height` を `pixelRatio` 倍で描く）。 */
function svgToPng(
	svgContent: string,
	width: number,
	height: number,
	pixelRatio: number,
): Promise<Blob> {
	const img = new Image();
	const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
	const url = URL.createObjectURL(svgBlob);

	return new Promise<Blob>((resolve, reject) => {
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = Math.ceil(width * pixelRatio);
			canvas.height = Math.ceil(height * pixelRatio);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				URL.revokeObjectURL(url);
				reject(new Error("Failed to get canvas context"));
				return;
			}
			ctx.scale(pixelRatio, pixelRatio);
			ctx.drawImage(img, 0, 0, width, height);
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

/**
 * シェイプデータからSVG文字列を構築してエクスポートする。
 * SVGシェイプ → renderToStaticMarkup、HTMLシェイプ → Satori(PNG) / foreignObject(SVG)
 */
export async function exportCanvas(
	shapes: Map<string, ShapeData>,
	shapeRegistry: ShapeRegistry,
	options: ExportOptions,
): Promise<Blob> {
	const targets = exportTargets(shapes);
	if (targets.length === 0) {
		throw new Error("No shapes to export");
	}

	const bounds = computeBounds(targets);
	const background = options.background ?? "#ffffff";
	const shapeElements = await renderShapeElements(targets, shapeRegistry, options.format === "png");

	const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}">
<rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${background}" />
${shapeElements.join("\n")}
</svg>`;

	if (options.format === "svg") {
		return new Blob([svgContent], { type: "image/svg+xml" });
	}
	return svgToPng(svgContent, bounds.width, bounds.height, options.pixelRatio ?? 2);
}

/** 全ページを書き出すときの 1 ページ分。 */
export interface ExportPage {
	id: string;
	name: string;
	shapes: Map<string, ShapeData>;
}

/** ページ名の見出しの高さ（px）と、ページの間の余白。 */
const PAGE_HEADING = 48;
const PAGE_GAP = 40;

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * 全ページの SVG を作る。ページを並び順に上から縦へ並べ、それぞれにページ名の見出しを付ける。
 * シェイプの無いページは飛ばす。描くページが無ければ例外。
 */
export async function buildPagesSvg(
	pages: readonly ExportPage[],
	shapeRegistry: ShapeRegistry,
	options: { useSatori: boolean; background?: string },
): Promise<{ svg: string; width: number; height: number }> {
	const drawn = pages
		.map((page) => ({ page, targets: exportTargets(page.shapes) }))
		.filter((p) => p.targets.length > 0);
	if (drawn.length === 0) throw new Error("No shapes to export");
	const background = options.background ?? "#ffffff";

	const width = Math.max(...drawn.map((p) => computeBounds(p.targets).width));
	const parts: string[] = [];
	let y = 0;
	for (const [index, { page, targets }] of drawn.entries()) {
		if (index > 0) {
			parts.push(
				`<line x1="0" y1="${y + PAGE_GAP / 2}" x2="${width}" y2="${y + PAGE_GAP / 2}" stroke="#d0d0d8" stroke-width="1" />`,
			);
			y += PAGE_GAP;
		}
		const bounds = computeBounds(targets);
		parts.push(
			`<text x="20" y="${y + 32}" font-family="system-ui, sans-serif" font-size="20" font-weight="600" fill="#444">${escapeXml(page.name)}</text>`,
		);
		y += PAGE_HEADING;
		const elements = await renderShapeElements(targets, shapeRegistry, options.useSatori);
		parts.push(
			`<g data-page-id="${escapeXml(page.id)}" transform="translate(${-bounds.minX}, ${y - bounds.minY})">\n${elements.join("\n")}\n</g>`,
		);
		y += bounds.height;
	}

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}">
<rect x="0" y="0" width="${width}" height="${y}" fill="${background}" />
${parts.join("\n")}
</svg>`;
	return { svg, width, height: y };
}

/** 全ページを 1 枚の画像（ページを縦に並べる）に書き出す。 */
export async function exportPagesCanvas(
	pages: readonly ExportPage[],
	shapeRegistry: ShapeRegistry,
	options: ExportOptions,
): Promise<Blob> {
	const { svg, width, height } = await buildPagesSvg(pages, shapeRegistry, {
		useSatori: options.format === "png",
		background: options.background,
	});
	if (options.format === "svg") return new Blob([svg], { type: "image/svg+xml" });
	return svgToPng(svg, width, height, options.pixelRatio ?? 2);
}

/** 全ページの JSON（`{ pages: [{ id, name, shapes }] }`、`shapes` は {@link exportJson} と同じ形）。 */
export function exportPagesJson(pages: readonly ExportPage[]): Blob {
	const data = {
		pages: pages.map((page) => ({
			id: page.id,
			name: page.name,
			shapes: Object.fromEntries(
				[...page.shapes].map(([id, shape]) => [id, JSON.parse(JSON.stringify(shape))]),
			),
		})),
	};
	return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

/**
 * ストアの全シェイプデータをJSON形式でエクスポートする。
 * Yjsドキュメントの"shapes" Mapと同等のプレーンオブジェクト構造。
 */
export function exportJson(shapes: Map<string, ShapeData>): Blob {
	const data: Record<string, unknown> = {};
	for (const [id, shape] of shapes) {
		// ShapeDataをプレーンオブジェクトに変換（循環参照回避）
		data[id] = JSON.parse(JSON.stringify(shape));
	}
	const json = JSON.stringify(data, null, 2);
	return new Blob([json], { type: "application/json" });
}

/** Blobをファイルとしてダウンロードする */
export function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
