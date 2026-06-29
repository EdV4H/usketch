import type { Point } from "@edv4h/usketch-shared";
import { shapeCenter } from "./cursor.js";
import type { HopTarget, VimDeps } from "./machine/types.js";

/**
 * hop を開始するトリガーキー。ラベル文字セットからは除外され（`f` 始まりのラベルを作らない）、
 * `f`+ラベル が必ず別キーになるようにしている。
 */
export const HOP_TRIGGER = "f";

/**
 * ラベルを生成する。shape 数がアルファベット長以内なら1文字、超えたら2文字
 * （1文字と2文字を混在させるとプレフィックスが曖昧になるため切替える）。
 */
export function generateHopLabels(count: number, alphabet: string): string[] {
	const a = [...new Set(alphabet.split(""))];
	if (count <= a.length) return a.slice(0, count);
	const labels: string[] = [];
	for (const c1 of a) {
		for (const c2 of a) {
			labels.push(c1 + c2);
			if (labels.length >= count) return labels;
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
