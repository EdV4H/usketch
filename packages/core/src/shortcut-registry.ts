import type { ShortcutRegistry } from "@usketch/shared";

function normalizeCombo(combo: string): string {
	return combo
		.toLowerCase()
		.split("+")
		.map((k) => k.trim())
		.sort()
		.join("+");
}

function eventToCombo(event: KeyboardEvent): string {
	const parts: string[] = [];
	if (event.ctrlKey || event.metaKey) parts.push("ctrl");
	if (event.shiftKey) parts.push("shift");
	if (event.altKey) parts.push("alt");

	const key = event.key.toLowerCase();
	if (!["control", "meta", "shift", "alt"].includes(key)) {
		parts.push(key);
	}

	return parts.sort().join("+");
}

export function createShortcutRegistry(): ShortcutRegistry {
	const shortcuts = new Map<string, () => void>();

	return {
		register(combo: string, callback: () => void): () => void {
			const normalized = normalizeCombo(combo);
			shortcuts.set(normalized, callback);
			return () => {
				shortcuts.delete(normalized);
			};
		},

		handleKeyDown(event: KeyboardEvent): boolean {
			const combo = eventToCombo(event);
			const callback = shortcuts.get(combo);
			if (callback) {
				event.preventDefault();
				callback();
				return true;
			}
			return false;
		},
	};
}
