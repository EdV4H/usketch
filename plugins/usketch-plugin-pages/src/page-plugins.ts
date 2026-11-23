// ページごとのプラグイン（プリセット + 1 つずつの足し引き）。何があるか（カタログ）と
// プリセットの中身はホストが渡す。このプラグインは選ぶ画面と、選んだ結果をページに書くだけ。
import type { PageMeta } from "@edv4h/usketch-sync";

/** ページに入れられるプラグイン 1 つ（ホストのカタログの 1 項目）。 */
export interface PagePluginChoice {
	id: string;
	label: string;
	/** 同じページに入れられないもの。これを入れると外す。 */
	conflicts?: readonly string[];
}

/** 新しいページを作るときに選べるプリセット。 */
export interface PagePresetChoice {
	id: string;
	label: string;
}

/** ページのプラグインを選べるようにする（ホストが渡す）。 */
export interface PagePluginsOptions {
	presets: readonly PagePresetChoice[];
	/** プリセットを選ばずに作ったページ・プリセットの無いページのプリセット。 */
	defaultPreset: string;
	/** 選べるプラグイン（並べる順）。外せないもの（ベース）は入れない。 */
	choices: readonly PagePluginChoice[];
	/** ページが今使うプラグイン（`plugins` が無ければプリセットのもの）。 */
	resolve(page: PageMeta): readonly string[];
}

/**
 * `id` を入れる・外したあとのプラグインの並び。入れるときは、それと入れられないもの
 * （どちら側に書いてあっても）を外す。並びは `choices` の順にそろえる。
 */
export function togglePlugin(
	current: readonly string[],
	id: string,
	on: boolean,
	choices: readonly PagePluginChoice[],
): string[] {
	const next = new Set(current);
	if (on) {
		next.add(id);
		const conflicts = new Set(choices.find((c) => c.id === id)?.conflicts ?? []);
		for (const choice of choices) {
			if (choice.conflicts?.includes(id)) conflicts.add(choice.id);
		}
		for (const other of conflicts) next.delete(other);
	} else {
		next.delete(id);
	}
	const order = new Map(choices.map((c, i) => [c.id, i]));
	return [...next].sort(
		(a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
	);
}

/** `id` と同時に入れられないもので、今入っているもの（入れると外れるもの）。 */
export function conflictingPlugins(
	current: readonly string[],
	id: string,
	choices: readonly PagePluginChoice[],
): string[] {
	const own = choices.find((c) => c.id === id)?.conflicts ?? [];
	return current.filter(
		(other) =>
			other !== id &&
			(own.includes(other) || (choices.find((c) => c.id === other)?.conflicts ?? []).includes(id)),
	);
}
