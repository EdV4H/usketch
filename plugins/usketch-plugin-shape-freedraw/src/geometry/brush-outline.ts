import { getStroke } from "perfect-freehand";
import type { StrokePoint } from "../types.js";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 速度→疑似筆圧（設計書 4.3）。デスクトップは筆圧が無いため移動速度から推定する。
 * ゆっくり=太い(p→1)、速い=細い(p→0)。
 * @param moved 直前点からの距離(screen px)
 * @param dtMs 経過時間(ms)
 * @param brushDynamics 筆圧感度 10..100（既定60）
 */
export function speedPressure(moved: number, dtMs: number, brushDynamics: number): number {
	const dt = Math.max(1, dtMs);
	const v = moved / dt; // px/ms
	const k = brushDynamics / 60; // 既定1.0
	const p = 1 - Math.min(1, v / (1.7 / Math.max(0.3, k)));
	return Math.max(0, Math.min(1, p));
}

/** 太さ平滑化（前フレームへ向けた lerp、設計書 §12）。 */
export function smoothPressure(prev: number, target: number, factor: number): number {
	return prev + (target - prev) * factor;
}

/**
 * perfect-freehand のアウトライン点列を、中点を通る二次ベジェの閉じた塗りパス d に変換。
 * （perfect-freehand 公式の getSvgPathFromStroke 相当）
 */
function outlineToPathD(outline: number[][]): string {
	if (outline.length < 2) return "";
	const d: (string | number)[] = ["M", r2(outline[0][0]), r2(outline[0][1]), "Q"];
	for (let i = 0; i < outline.length; i++) {
		const a = outline[i];
		const b = outline[(i + 1) % outline.length];
		d.push(r2(a[0]), r2(a[1]), r2((a[0] + b[0]) / 2), r2((a[1] + b[1]) / 2));
	}
	d.push("Z");
	return d.join(" ");
}

/**
 * 筆ペン（可変線幅）の塗りアウトラインパス（設計書 4.4 の代替＝ベクター化）。
 * 点ごとの疑似筆圧 `p` から perfect-freehand で幅を可変させ、塗りパス d を得る。
 * `size` を最大径の基準に、thinning 固定で wmin≈size×0.22 / wmax≈size×1.55（設計書 §12）に対応づける。
 * `p` は描画時に決定済みなので simulatePressure は false（決定的に再描画できる）。
 */
export function brushOutlineD(points: StrokePoint[], size: number): string {
	if (points.length === 0) return "";
	const input = points.map((pt) => [pt.x, pt.y, pt.p ?? 0.5] as [number, number, number]);
	const outline = getStroke(input, {
		size: size * 1.55,
		thinning: 0.86,
		smoothing: 0.5,
		streamline: 0.5,
		simulatePressure: false,
		last: true,
		start: { cap: true },
		end: { cap: true },
	});
	return outlineToPathD(outline as number[][]);
}
