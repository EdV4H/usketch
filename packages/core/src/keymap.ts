import type {
	KeyBinding,
	KeyBindingKind,
	KeyBindingSpec,
	KeyConflict,
	Keymap,
} from "@edv4h/usketch-shared";

/**
 * Normalize a `"+"`-joined combo: lower-case, order-independent, `mod` → `ctrl`
 * (the platform accelerator: {@link eventToCombo} folds Cmd and Ctrl into `ctrl`, so
 * `"Mod+Z"` matches Cmd+Z on macOS and Ctrl+Z elsewhere), and `" "` / `"spacebar"` →
 * `"space"`.
 */
export function normalizeCombo(combo: string): string {
	return combo
		.toLowerCase()
		.split("+")
		.map((k) => k.trim())
		.map((k) => (k === "mod" ? "ctrl" : k === "spacebar" ? "space" : k))
		.sort()
		.join("+");
}

/** The normalized combo a keydown produces (see {@link normalizeCombo}). */
export function eventToCombo(event: KeyboardEvent): string {
	const parts: string[] = [];
	if (event.ctrlKey || event.metaKey) parts.push("ctrl");
	if (event.shiftKey) parts.push("shift");
	if (event.altKey) parts.push("alt");

	const key = (event.key ?? "").toLowerCase();
	if (!["control", "meta", "shift", "alt"].includes(key)) {
		parts.push(key === " " ? "space" : key);
	}

	return parts.sort().join("+");
}

const CODE_TOKENS: Record<string, string> = {
	Space: "space",
	ShiftLeft: "shift",
	ShiftRight: "shift",
	ControlLeft: "ctrl",
	ControlRight: "ctrl",
	MetaLeft: "ctrl",
	MetaRight: "ctrl",
	AltLeft: "alt",
	AltRight: "alt",
	Minus: "-",
	Equal: "=",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Semicolon: ";",
	Quote: "'",
	Comma: ",",
	Period: ".",
	Slash: "/",
	Backquote: "`",
};

/**
 * The key a `KeyboardEvent.code` stands for on a US layout, in {@link normalizeCombo}
 * form (`"KeyW"` → `"w"`, `"ShiftLeft"` → `"shift"`, `"ArrowUp"` → `"arrowup"`). Used to
 * compare held-key bindings with shortcut combos when looking for overlaps.
 */
export function codeToKey(code: string): string {
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
	if (/^Digit[0-9]$/.test(code)) return code.slice(5);
	return CODE_TOKENS[code] ?? code.toLowerCase();
}

/** The normalized key `key` stands for, for overlap detection. */
const keyToken = (kind: KeyBindingKind, key: string): string =>
	kind === "hold" ? codeToKey(key) : normalizeCombo(key);

interface Entry {
	spec: KeyBindingSpec;
	kind: KeyBindingKind;
	pluginId?: string;
	/** Position of the owning plugin in `createApp({ plugins })`; −1 for host / core. */
	ownerIndex: number;
	/** Registration order (last tie-break). */
	seq: number;
}

/** Who a registration is attributed to (see {@link KeymapInternal.registerFor}). */
export interface KeymapOwner {
	pluginId?: string;
	/** Position in the plugin list; omit (or −1) for host / core. */
	index?: number;
}

export interface CreateKeymapOptions {
	/**
	 * Host defaults by binding id: replace a plugin's default keys (`null` = unbound by
	 * default). The viewer's {@link Keymap.setKeys} still wins over these.
	 */
	keys?: Readonly<Record<string, readonly string[] | null>>;
	/** The viewer's saved rebindings to start from (as {@link Keymap.getOverrides} returns). */
	overrides?: Readonly<Record<string, readonly string[] | null>>;
}

export interface KeymapInternal extends Keymap {
	/** Register on behalf of a plugin (createApp's scoped `ctx.keymap` calls this). */
	registerFor(owner: KeymapOwner, spec: KeyBindingSpec): () => void;
}

const isActive = (entry: Entry): boolean => {
	const when = entry.spec.when;
	if (!when) return true;
	try {
		return when() === true;
	} catch {
		return false;
	}
};

/** Winning order: priority (high first), then plugin order, then registration order. */
const compareEntries = (a: Entry, b: Entry): number =>
	(b.spec.priority ?? 0) - (a.spec.priority ?? 0) || a.ownerIndex - b.ownerIndex || a.seq - b.seq;

export function createKeymap(options: CreateKeymapOptions = {}): KeymapInternal {
	const entries = new Map<string, Entry>();
	const hostKeys = { ...(options.keys ?? {}) };
	const overrides = new Map<string, readonly string[] | null>(
		Object.entries(options.overrides ?? {}),
	);
	const listeners = new Set<() => void>();
	let seq = 0;

	const notify = (): void => {
		for (const listener of [...listeners]) {
			try {
				listener();
			} catch (error) {
				console.error("[usketch] keymap listener threw", error);
			}
		}
	};

	const defaultKeysOf = (entry: Entry): readonly string[] => {
		const host = hostKeys[entry.spec.id];
		if (host === null) return [];
		return host ?? entry.spec.keys;
	};

	const keysOf = (entry: Entry): readonly string[] => {
		if (overrides.has(entry.spec.id)) return overrides.get(entry.spec.id) ?? [];
		return defaultKeysOf(entry);
	};

	const snapshot = (entry: Entry): KeyBinding => ({
		id: entry.spec.id,
		...(entry.pluginId !== undefined ? { pluginId: entry.pluginId } : {}),
		kind: entry.kind,
		...(entry.spec.label !== undefined ? { label: entry.spec.label } : {}),
		...(entry.spec.category !== undefined ? { category: entry.spec.category } : {}),
		priority: entry.spec.priority ?? 0,
		defaultKeys: [...defaultKeysOf(entry)],
		keys: [...keysOf(entry)],
		overridden: overrides.has(entry.spec.id),
	});

	const matches = (entry: Entry, event: KeyboardEvent): boolean => {
		const keys = keysOf(entry);
		if (keys.length === 0) return false;
		if (entry.kind === "hold") return !!event.code && keys.includes(event.code);
		const combo = eventToCombo(event);
		return keys.some((k) => normalizeCombo(k) === combo);
	};

	const winner = (event: KeyboardEvent): Entry | undefined => {
		let best: Entry | undefined;
		for (const entry of entries.values()) {
			if (!matches(entry, event) || !isActive(entry)) continue;
			if (!best || compareEntries(entry, best) < 0) best = entry;
		}
		return best;
	};

	const registerFor = (owner: KeymapOwner, spec: KeyBindingSpec): (() => void) => {
		const entry: Entry = {
			spec: { ...spec, keys: [...spec.keys] },
			kind: spec.kind ?? "press",
			...(owner.pluginId !== undefined ? { pluginId: owner.pluginId } : {}),
			ownerIndex: owner.index ?? -1,
			seq: seq++,
		};
		// Re-registering an id replaces it (the old unregister then does nothing).
		entries.set(spec.id, entry);
		notify();
		return () => {
			if (entries.get(spec.id) !== entry) return;
			entries.delete(spec.id);
			notify();
		};
	};

	return {
		registerFor,

		register: (spec) => registerFor({}, spec),

		get(id) {
			const entry = entries.get(id);
			return entry ? snapshot(entry) : undefined;
		},

		getKeys(id) {
			const entry = entries.get(id);
			if (entry) return [...keysOf(entry)];
			const override = overrides.get(id);
			return override ? [...override] : [];
		},

		getAll() {
			return [...entries.values()].sort(compareEntries).map(snapshot);
		},

		getConflicts() {
			const byKey = new Map<string, Entry[]>();
			for (const entry of entries.values()) {
				const tokens = new Set(keysOf(entry).map((k) => keyToken(entry.kind, k)));
				for (const token of tokens) {
					if (!token) continue;
					const list = byKey.get(token);
					if (list) list.push(entry);
					else byKey.set(token, [entry]);
				}
			}
			const conflicts: KeyConflict[] = [];
			for (const [key, list] of byKey) {
				if (list.length < 2) continue;
				conflicts.push({ key, bindings: [...list].sort(compareEntries).map(snapshot) });
			}
			return conflicts.sort((a, b) => a.key.localeCompare(b.key));
		},

		resolve(event) {
			const entry = winner(event);
			return entry ? snapshot(entry) : undefined;
		},

		claims(id, event) {
			return winner(event)?.spec.id === id;
		},

		handleKeyDown(event) {
			const entry = winner(event);
			const onPress = entry?.kind === "press" ? entry.spec.onPress : undefined;
			if (!onPress) return false; // no match, or a "hold" binding owns the key
			event.preventDefault();
			onPress(event);
			return true;
		},

		setKeys(id, keys) {
			overrides.set(id, keys === null ? null : [...keys]);
			notify();
		},

		resetKeys(id) {
			if (id === undefined) {
				if (overrides.size === 0) return;
				overrides.clear();
			} else if (!overrides.delete(id)) {
				return;
			}
			notify();
		},

		getOverrides() {
			const out: Record<string, readonly string[] | null> = {};
			for (const [id, keys] of overrides) out[id] = keys === null ? null : [...keys];
			return out;
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/**
 * The keymap as one plugin sees it: `register` is attributed to `owner`, and the
 * internal `registerFor` is not reachable (explicit members, not a spread).
 */
export function scopeKeymap(keymap: KeymapInternal, owner: KeymapOwner): Keymap {
	return {
		register: (spec) => keymap.registerFor(owner, spec),
		get: keymap.get,
		getKeys: keymap.getKeys,
		getAll: keymap.getAll,
		getConflicts: keymap.getConflicts,
		resolve: keymap.resolve,
		claims: keymap.claims,
		handleKeyDown: keymap.handleKeyDown,
		setKeys: keymap.setKeys,
		resetKeys: keymap.resetKeys,
		getOverrides: keymap.getOverrides,
		subscribe: keymap.subscribe,
	};
}

/** Human-readable list of overlaps, for a dev-time console warning. */
export function describeConflicts(conflicts: readonly KeyConflict[]): string {
	return conflicts
		.map((c) => {
			const who = c.bindings
				.map((b, i) => `${i === 0 ? "▶ " : ""}${b.label ?? b.id} (${b.pluginId ?? "app"})`)
				.join(" / ");
			return `  ${c.key}: ${who}`;
		})
		.join("\n");
}
