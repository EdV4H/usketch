import type { ShortcutEntry, ShortcutMeta, ShortcutRegistry } from "@edv4h/usketch-shared";

function normalizeCombo(combo: string): string {
	return (
		combo
			.toLowerCase()
			.split("+")
			.map((k) => k.trim())
			// `mod` is the platform accelerator. eventToCombo maps Cmd/Ctrl → "ctrl",
			// so aliasing mod → ctrl makes "Mod+Z" match Cmd+Z (mac) and Ctrl+Z (win).
			.map((k) => (k === "mod" ? "ctrl" : k))
			.sort()
			.join("+")
	);
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

interface Registration {
	callback: () => void;
	/** Original (un-normalized) combo, kept for {@link ShortcutRegistry.list}. */
	combo: string;
	meta?: ShortcutMeta;
}

export function createShortcutRegistry(): ShortcutRegistry {
	const shortcuts = new Map<string, Registration>();

	return {
		register(combo: string, callback: () => void, meta?: ShortcutMeta): () => void {
			const normalized = normalizeCombo(combo);
			shortcuts.set(normalized, { callback, combo, meta });
			return () => {
				shortcuts.delete(normalized);
			};
		},

		handleKeyDown(event: KeyboardEvent): boolean {
			const registration = shortcuts.get(eventToCombo(event));
			if (registration) {
				event.preventDefault();
				registration.callback();
				return true;
			}
			return false;
		},

		list(): ShortcutEntry[] {
			return [...shortcuts.values()].map(({ combo, meta }) => ({
				combo,
				...(meta ? { meta } : {}),
			}));
		},
	};
}
