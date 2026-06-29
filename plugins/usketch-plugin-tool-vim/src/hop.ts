import type { Point } from "@edv4h/usketch-shared";
import { shapeCenter } from "./cursor.js";
import type { HopTarget, VimDeps } from "./machine/types.js";

/**
 * hop を開始するトリガーキー。ラベル文字セットからは除外され（`f` 始まりのラベルを作らない）、
 * `f`+ラベル が必ず別キーになるようにしている。
 */
export const HOP_TRIGGER = "f";

/**
 * `count` 件のラベルを生成する。すべて同じ長さ（固定長なのでプレフィックス曖昧さ無し）で、
 * `alphabet^len >= count` を満たす最小の len を選ぶ（1文字で足りれば1文字、足りなければ2文字…）。
 * 件数が多くても必ず `count` 件返す（undefined にならない）。
 */
export function generateHopLabels(count: number, alphabet: string): string[] {
	if (count <= 0) return [];
	const a = [...new Set(alphabet.split(""))];
	// アルファベットが1文字以下だと長さを増やしても件数を満たせないため best-effort で返す。
	if (a.length < 2) return a.slice(0, count);

	let len = 1;
	let cap = a.length;
	while (cap < count) {
		len++;
		cap *= a.length;
	}

	const labels: string[] = [];
	const idx = new Array(len).fill(0);
	for (let n = 0; n < count; n++) {
		labels.push(idx.map((i) => a[i]).join(""));
		// 混合基数カウンタをインクリメント（最下位桁から繰り上げ）。
		for (let p = len - 1; p >= 0; p--) {
			idx[p]++;
			if (idx[p] < a.length) break;
			idx[p] = 0;
		}
	}
	return labels;
}

/** 全 shape に対し、カーソルに近い順でラベルを割り当てた hop ターゲットを返す。 */
export function computeHopTargets(deps: VimDeps, from: Point, alphabet: string): HopTarget[] {
	const withCenter: { id: string; c: Point }[] = [];
	for (const [id] of deps.store.getShapes()) {
		const c = shapeCenter(deps, id);
		if (c) withCenter.push({ id, c });
	}
	withCenter.sort(
		(a, b) =>
			Math.hypot(a.c.x - from.x, a.c.y - from.y) - Math.hypot(b.c.x - from.x, b.c.y - from.y),
	);
	// トリガー文字を除外（`f` 始まりラベルを作らず、`f`+ラベルが必ず別キーになる）。
	const labelChars = alphabet
		.split("")
		.filter((c) => c !== HOP_TRIGGER)
		.join("");
	const labels = generateHopLabels(withCenter.length, labelChars);
	return withCenter.map((x, i) => ({ id: x.id, label: labels[i], cx: x.c.x, cy: x.c.y }));
}
