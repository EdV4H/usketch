import type { Point } from "@edv4h/usketch-shared";

/** 自動パンを許可する軸。 */
export type EdgePanAxes = "both" | "horizontal" | "vertical";

/** `value` そのものか、フレームごとに評価される getter（ライブ変更用）。 */
export type Live<T> = T | (() => T);

/**
 * edge-pan プラグインのホスト向けオプション。すべて省略可能で、数値/真偽/enum は
 * getter でも渡せる（設定 UI からの即時反映用に毎フレーム評価される）。
 */
export interface EdgePanOptions {
	/** 機能全体の ON/OFF。既定 true。 */
	enabled?: Live<boolean>;
	/** 端の「反応する帯」の幅(px)。この帯にポインタが入ると自動パンが始まる。既定 48。 */
	edgeSize?: Live<number>;
	/** 帯の最奥での 1 フレームあたりのパン量(px)。奥ほど速くなる。既定 16。 */
	maxSpeed?: Live<number>;
	/** 自動パンを許可する軸。既定 "both"。 */
	axes?: Live<EdgePanAxes>;
	/**
	 * 帯への食い込み深さ(0..1)を速度係数(0..1)へ写す曲線。既定は線形 `d => d`。
	 * 例: `d => d * d`（端に近づくほど急加速）。
	 */
	curve?: (depth: number) => number;
}

export const EDGE_PAN_DEFAULTS = {
	enabled: true,
	edgeSize: 48,
	maxSpeed: 16,
	axes: "both" as EdgePanAxes,
} as const;

const LINEAR = (d: number) => d;

/** 有限かつ下限以上ならその値、さもなくば fallback。 */
export function clampNumber(value: number, min: number, fallback: number): number {
	return Number.isFinite(value) && value >= min ? value : fallback;
}

/** 実際にパン計算へ渡す、解決済み設定。 */
export interface ResolvedEdgePan {
	enabled: boolean;
	edgeSize: number;
	maxSpeed: number;
	axes: EdgePanAxes;
	curve: (depth: number) => number;
}

/**
 * ポインタの画面座標(canvas ローカル px)と canvas サイズから、1 フレームのパン量を求める純関数。
 *
 * 方向は「寄せた端の先を見せる」向き:
 * - 左端 → 中身が右へ動く(vp.x を増やす) → dx > 0
 * - 右端 → dx < 0 / 上端 → dy > 0 / 下端 → dy < 0
 * `panBy(dx, dy)` にそのまま渡せる（画面ピクセルオフセット加算）。
 */
export function edgePanDelta(
	point: Point,
	size: { width: number; height: number },
	resolved: ResolvedEdgePan,
): { dx: number; dy: number } {
	const { edgeSize, maxSpeed, axes, curve } = resolved;
	if (edgeSize <= 0 || maxSpeed <= 0) return { dx: 0, dy: 0 };

	// 食い込み(px)を 0..1 に正規化し curve を通して速度係数へ。
	const factor = (into: number) => maxSpeed * curve(Math.min(1, Math.max(0, into / edgeSize)));

	let dx = 0;
	let dy = 0;

	if (axes !== "vertical") {
		if (point.x < edgeSize) dx = factor(edgeSize - point.x);
		else if (point.x > size.width - edgeSize) dx = -factor(point.x - (size.width - edgeSize));
	}
	if (axes !== "horizontal") {
		if (point.y < edgeSize) dy = factor(edgeSize - point.y);
		else if (point.y > size.height - edgeSize) dy = -factor(point.y - (size.height - edgeSize));
	}

	return { dx, dy };
}

/** options（value|getter）と HUD overrides を重ねて解決するリゾルバを作る。overrides が優先。 */
export function createResolver(
	options: EdgePanOptions,
	overrides: Partial<Pick<EdgePanOptions, "enabled" | "edgeSize" | "maxSpeed" | "axes">> & {
		enabled?: boolean;
		edgeSize?: number;
		maxSpeed?: number;
		axes?: EdgePanAxes;
	},
): () => ResolvedEdgePan {
	const read = <T>(live: Live<T> | undefined): T | undefined =>
		typeof live === "function" ? (live as () => T)() : live;

	return () => {
		const enabled = overrides.enabled ?? read(options.enabled) ?? EDGE_PAN_DEFAULTS.enabled;
		const edgeSize = clampNumber(
			overrides.edgeSize ?? read(options.edgeSize) ?? EDGE_PAN_DEFAULTS.edgeSize,
			1,
			EDGE_PAN_DEFAULTS.edgeSize,
		);
		const maxSpeed = clampNumber(
			overrides.maxSpeed ?? read(options.maxSpeed) ?? EDGE_PAN_DEFAULTS.maxSpeed,
			0,
			EDGE_PAN_DEFAULTS.maxSpeed,
		);
		const axes = overrides.axes ?? read(options.axes) ?? EDGE_PAN_DEFAULTS.axes;
		const curve = options.curve ?? LINEAR;
		return { enabled: enabled === true, edgeSize, maxSpeed, axes, curve };
	};
}
