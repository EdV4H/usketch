import type { ShortcutEntry, ShortcutMeta, ShortcutRegistry } from "@edv4h/usketch-shared";
import { createKeymap, type KeymapInternal, type KeymapOwner, normalizeCombo } from "./keymap.js";

/**
 * The `ctx.shortcuts` API, as a thin layer over the {@link KeymapInternal keymap}: each
 * `register` adds a `"press"` binding (id `<owner>:shortcut:<combo>` unless
 * `meta.id` is given), so shortcuts take part in overlap detection and rebinding.
 * Without a `keymap`, a private one is used (standalone / tests).
 */
export function createShortcutRegistry(
	keymap: KeymapInternal = createKeymap(),
	owner: KeymapOwner = {},
	/** Ids registered through this API, shared across a keymap's scoped registries. */
	shortcutIds: Set<string> = new Set(),
): ShortcutRegistry {
	return {
		register(combo: string, callback: () => void, meta?: ShortcutMeta): () => void {
			const id = meta?.id ?? `${owner.pluginId ?? "app"}:shortcut:${normalizeCombo(combo)}`;
			const off = keymap.registerFor(owner, {
				id,
				keys: [combo],
				kind: "press",
				onPress: () => callback(),
				...(meta?.label !== undefined ? { label: meta.label } : {}),
				...(meta?.category !== undefined ? { category: meta.category } : {}),
				...(meta?.when ? { when: meta.when } : {}),
				...(meta?.priority !== undefined ? { priority: meta.priority } : {}),
			});
			shortcutIds.add(id);
			return () => {
				off();
				if (!keymap.get(id)) shortcutIds.delete(id);
			};
		},

		handleKeyDown(event: KeyboardEvent): boolean {
			return keymap.handleKeyDown(event);
		},

		list(): ShortcutEntry[] {
			const out: ShortcutEntry[] = [];
			for (const binding of keymap.getAll()) {
				if (!shortcutIds.has(binding.id)) continue;
				const meta: ShortcutMeta = {
					...(binding.label !== undefined ? { label: binding.label } : {}),
					...(binding.category !== undefined ? { category: binding.category } : {}),
				};
				const hasMeta = Object.keys(meta).length > 0;
				for (const combo of binding.keys) out.push({ combo, ...(hasMeta ? { meta } : {}) });
			}
			return out;
		},
	};
}
