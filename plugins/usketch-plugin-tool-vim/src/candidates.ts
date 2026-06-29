import type { VimConfig } from "./config/schema.js";
import type { ShapeCandidate, VimDeps } from "./machine/types.js";

/**
 * insert モードの入力バッファから shape 候補を計算する。
 *
 * 1. `config.shapeMap` の明示マッピング（別名 → spec）
 * 2. `deps.shapes.getAll()` のレジストリ型名（マップに無い型を型名そのままで補完）
 *
 * を統合し、バッファに前方一致 → 部分一致の順でフィルタ・整列して返す。
 * バッファが空なら空配列。
 */
export function computeCandidates(
	deps: VimDeps,
	config: VimConfig,
	buffer: string,
): ShapeCandidate[] {
	const query = buffer.trim().toLowerCase();
	if (query === "") return [];

	const byAlias = new Map<string, ShapeCandidate>();

	// 1. 明示マッピング
	for (const [alias, spec] of Object.entries(config.shapeMap)) {
		byAlias.set(alias.toLowerCase(), {
			alias,
			spec,
			label: spec.label ?? spec.type,
		});
	}

	// 2. レジストリ型名（未登録の別名だけ追加）
	for (const [type] of deps.shapes.getAll()) {
		const key = type.toLowerCase();
		if (!byAlias.has(key)) {
			byAlias.set(key, { alias: type, spec: { type }, label: type });
		}
	}

	const prefix: ShapeCandidate[] = [];
	const substr: ShapeCandidate[] = [];
	for (const cand of byAlias.values()) {
		const a = cand.alias.toLowerCase();
		const l = cand.label.toLowerCase();
		if (a.startsWith(query) || l.startsWith(query)) {
			prefix.push(cand);
		} else if (a.includes(query) || l.includes(query)) {
			substr.push(cand);
		}
	}

	const byAliasLength = (x: ShapeCandidate, y: ShapeCandidate) =>
		x.alias.length - y.alias.length || x.alias.localeCompare(y.alias);
	prefix.sort(byAliasLength);
	substr.sort(byAliasLength);
	return [...prefix, ...substr];
}
