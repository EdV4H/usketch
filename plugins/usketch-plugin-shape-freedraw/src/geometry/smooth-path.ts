import type { StrokePoint } from "../types.js";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 一定幅ペンの平滑化パス（設計書 4.2）。
 * 点列を結ぶのではなく「各点間の中点を通る二次ベジェ」で描く。
 * 制御点=実点, 終点=中点。最後は最終点へ直線。
 * 点が2未満なら空文字（呼び出し側が円で描画）。
 */
export function smoothPathD(points: StrokePoint[]): string {
	const n = points.length;
	if (n < 2) return "";
	let d = `M ${r2(points[0].x)} ${r2(points[0].y)}`;
	for (let i = 1; i < n - 1; i++) {
		const mx = (points[i].x + points[i + 1].x) / 2;
		const my = (points[i].y + points[i + 1].y) / 2;
		d += ` Q ${r2(points[i].x)} ${r2(points[i].y)} ${r2(mx)} ${r2(my)}`;
	}
	d += ` L ${r2(points[n - 1].x)} ${r2(points[n - 1].y)}`;
	return d;
}
