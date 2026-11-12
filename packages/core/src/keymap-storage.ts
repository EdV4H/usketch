// Where the viewer's rebindings live is the host's choice (localStorage, a settings
// API, a store slice). `bindKeymapStorage` keeps a keymap and one such storage in step.
import type { Keymap } from "@edv4h/usketch-shared";

export type KeymapOverrides = Readonly<Record<string, readonly string[] | null>>;

/** A place to keep the viewer's rebindings ({@link Keymap.getOverrides}). */
export interface KeymapStorage {
	/** The saved rebindings, or undefined when nothing is saved (or it can't be read). */
	load(): KeymapOverrides | undefined;
	save(overrides: KeymapOverrides): void;
	/** Optional: call back when the saved value changes elsewhere (another tab). */
	subscribe?(listener: () => void): () => void;
}

/**
 * Rebindings from untrusted input (a JSON blob, a settings API): keeps entries whose
 * value is `null` or an array of strings and drops the rest. Undefined when `value`
 * isn't an object.
 */
export function parseKeymapOverrides(value: unknown): KeymapOverrides | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	const out: Record<string, readonly string[] | null> = {};
	for (const [id, keys] of Object.entries(value)) {
		if (keys === null) out[id] = null;
		else if (Array.isArray(keys) && keys.every((k) => typeof k === "string")) out[id] = [...keys];
	}
	return out;
}

const serialize = (overrides: KeymapOverrides): string => {
	const sorted: Record<string, readonly string[] | null> = {};
	for (const id of Object.keys(overrides).sort()) sorted[id] = overrides[id] ?? null;
	return JSON.stringify(sorted);
};

/**
 * Load the saved rebindings into `keymap` (over any made before binding), save whenever the viewer changes them, and
 * reload when the storage reports a change from elsewhere. Saves only when the
 * rebindings actually changed (registrations also notify the keymap). Returns a
 * function that stops syncing.
 */
export function bindKeymapStorage(keymap: Keymap, storage: KeymapStorage): () => void {
	let last = serialize(keymap.getOverrides());
	let applying = false;

	// On start, the saved rebindings go over any made before (e.g. ones a plugin carried
	// over from older storage of its own), and the result is saved if it differs. A later
	// change to "nothing saved" (another tab reset everything) means no rebindings.
	const apply = (initial: boolean): void => {
		const stored = storage.load();
		if (initial) {
			const current = keymap.getOverrides();
			const merged = stored ? { ...current, ...stored } : current;
			const text = serialize(merged);
			if (text !== serialize(current)) {
				applying = true;
				try {
					keymap.setOverrides(merged);
				} finally {
					applying = false;
				}
			}
			last = text;
			if (text !== serialize(stored ?? {})) storage.save(merged);
			return;
		}
		const loaded = stored ?? {};
		const text = serialize(loaded);
		if (text === last) return;
		applying = true;
		try {
			keymap.setOverrides(loaded);
		} finally {
			applying = false;
		}
		last = text;
	};

	apply(true);

	const offKeymap = keymap.subscribe(() => {
		if (applying) return;
		const current = keymap.getOverrides();
		const text = serialize(current);
		if (text === last) return;
		last = text;
		storage.save(current);
	});
	const offStorage = storage.subscribe?.(() => apply(false));

	return () => {
		offKeymap();
		offStorage?.();
	};
}

export interface LocalStorageKeymapStorageOptions {
	/** Default `"usketch:keymap"`. */
	key?: string;
	/** Default `globalThis.localStorage`. */
	storage?: Storage;
}

/**
 * A {@link KeymapStorage} on `localStorage` (per viewer and browser), following other
 * tabs through the `storage` event. Read / write failures (private mode, quota) are
 * ignored.
 */
export function localStorageKeymapStorage(
	options: LocalStorageKeymapStorageOptions = {},
): KeymapStorage {
	const key = options.key ?? "usketch:keymap";
	const area = (): Storage | undefined => {
		try {
			return options.storage ?? globalThis.localStorage;
		} catch {
			return undefined;
		}
	};
	return {
		load() {
			try {
				const raw = area()?.getItem(key);
				return raw ? parseKeymapOverrides(JSON.parse(raw)) : undefined;
			} catch {
				return undefined;
			}
		},
		save(overrides) {
			try {
				const target = area();
				if (!target) return;
				if (Object.keys(overrides).length === 0) target.removeItem(key);
				else target.setItem(key, JSON.stringify(overrides));
			} catch {
				// Not persisted; the in-memory keymap still has the change.
			}
		},
		subscribe(listener) {
			if (typeof window === "undefined") return () => {};
			const onStorage = (event: StorageEvent): void => {
				if (event.key === key || event.key === null) listener();
			};
			window.addEventListener("storage", onStorage);
			return () => window.removeEventListener("storage", onStorage);
		},
	};
}
