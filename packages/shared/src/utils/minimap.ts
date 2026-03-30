import type { ShapeData } from "../types/shape.js";

/** ミニマップ上の矩形データ */
export interface MinimapRect {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
}

/** ミニマップ上のビューポート矩形 */
export interface MinimapViewportRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** ミニマップ計算の入力 */
export interface MinimapInput {
	shapes: ReadonlyArray<ShapeData>;
	/** ビューポートのワールド座標範囲。省略するとシェイプの範囲のみ使用。 */
	viewportWorld?: { x: number; y: number; width: number; height: number };
	/** 出力のマップ幅（px）。デフォルト: 240 */
	mapWidth?: number;
	/** 出力のマップ高さ（px）。デフォルト: 160 */
	mapHeight?: number;
	/** ワールド座標のパディング。デフォルト: 20 */
	padding?: number;
	/** 矩形の最小サイズ（px）。デフォルト: 2 */
	minSize?: number;
}

/** ミニマップ計算の出力 */
export interface MinimapResult {
	/** シェイプのミニマップ矩形一覧 */
	rects: MinimapRect[];
	/** ビューポート矩形（viewportWorld が指定された場合のみ） */
	viewportRect: MinimapViewportRect | null;
	/** ワールド→マップ座標の変換スケール */
	scale: number;
	/** ワールドの全体範囲 */
	worldBounds: { minX: number; minY: number; width: number; height: number };
}

/**
 * シェイプ配列からミニマップ用の矩形データを計算する。
 * UI やレンダリングライブラリに依存しない pure function。
 */
export function computeMinimap(input: MinimapInput): MinimapResult {
	const {
		shapes,
		viewportWorld,
		mapWidth = 240,
		mapHeight = 160,
		padding = 20,
		minSize = 2,
	} = input;

	// ワールド範囲を計算（ビューポート + 全シェイプ）
	let minX = viewportWorld ? viewportWorld.x : Infinity;
	let minY = viewportWorld ? viewportWorld.y : Infinity;
	let maxX = viewportWorld ? viewportWorld.x + viewportWorld.width : -Infinity;
	let maxY = viewportWorld ? viewportWorld.y + viewportWorld.height : -Infinity;

	for (const s of shapes) {
		if (s.x < minX) minX = s.x;
		if (s.y < minY) minY = s.y;
		if (s.x + s.width > maxX) maxX = s.x + s.width;
		if (s.y + s.height > maxY) maxY = s.y + s.height;
	}

	// シェイプもビューポートもない場合
	if (minX === Infinity) {
		return {
			rects: [],
			viewportRect: null,
			scale: 1,
			worldBounds: { minX: 0, minY: 0, width: 0, height: 0 },
		};
	}

	const worldW = maxX - minX + padding * 2;
	const worldH = maxY - minY + padding * 2;
	const scale = Math.min(mapWidth / worldW, mapHeight / worldH);

	const toMapX = (wx: number) => (wx - minX + padding) * scale;
	const toMapY = (wy: number) => (wy - minY + padding) * scale;

	// シェイプ矩形
	const rects: MinimapRect[] = shapes.map((s) => ({
		id: s.id,
		x: toMapX(s.x),
		y: toMapY(s.y),
		width: Math.max(minSize, s.width * scale),
		height: Math.max(minSize, s.height * scale),
		fill: s.style.fill || "#ffffff",
	}));

	// ビューポート矩形
	const viewportRect = viewportWorld
		? {
				x: toMapX(viewportWorld.x),
				y: toMapY(viewportWorld.y),
				width: viewportWorld.width * scale,
				height: viewportWorld.height * scale,
			}
		: null;

	return {
		rects,
		viewportRect,
		scale,
		worldBounds: { minX, minY, width: worldW, height: worldH },
	};
}

/**
 * computeMinimap の結果を SVG 文字列に変換する。
 * サーバーサイドでのサムネイル生成に使用。
 */
export function minimapToSvg(
	result: MinimapResult,
	width: number,
	height: number,
	options?: {
		background?: string;
		strokeColor?: string;
		showViewport?: boolean;
	},
): string {
	const {
		background = "#1a1a2e",
		strokeColor = "rgba(99,102,241,0.3)",
		showViewport = false,
	} = options ?? {};

	const shapeSvg = result.rects
		.map(
			(r) =>
				`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="${r.fill}" opacity="0.7" rx="1"/>`,
		)
		.join("\n");

	const vpSvg =
		showViewport && result.viewportRect
			? `<rect x="${result.viewportRect.x}" y="${result.viewportRect.y}" width="${result.viewportRect.width}" height="${result.viewportRect.height}" fill="none" stroke="${strokeColor}" stroke-width="1" rx="2"/>`
			: "";

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${background}" rx="4"/>${shapeSvg}${vpSvg}</svg>`;
}
