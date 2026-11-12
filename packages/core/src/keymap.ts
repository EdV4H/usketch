import type {
	KeyBinding,
	KeyBindingKind,
	KeyBindingSpec,
	KeyConflict,
	KeyConflictPolicy,
	KeyGate,
	Keymap,
} from "@edv4h/usketch-shared";

/**
 * How the `Mod` token (and the Cmd / Ctrl keys) match:
 * - `"platform"` (default): `Mod` is Cmd on macOS and Ctrl elsewhere; Cmd and Ctrl are
 *   different keys (on a Mac, `Ctrl+Z` is not `Mod+Z`).
 * - `"either"`: Cmd and Ctrl are the same key everywhere, and `Mod` is that key.
 */
export type ModKeyMode = "platform" | "either";

/** Options for matching combos against keydowns. */
export interface ComboOptions {
	/** Default `"platform"`. */
	mod?: ModKeyMode;
	/** Whether to treat the platform as macOS. Default: detected from `navigator`. */
	isMac?: boolean;
}

const detectMac = (): boolean =>
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad|iPod/.test(
		(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
			navigator.platform ??
			"",
	);

const TOKEN_ALIASES: Record<string, string> = {
	cmd: "meta",
	command: "meta",
	"⌘": "meta",
	control: "ctrl",
	opt: "alt",
	option: "alt",
	"⌥": "alt",
	"⇧": "shift",
	spacebar: "space",
	esc: "escape",
	del: "delete",
	up: "arrowup",
	down: "arrowdown",
	left: "arrowleft",
	right: "arrowright",
};

/**
 * The canonical, platform-independent form of a `"+"`-joined combo: lower-case,
 * order-independent, aliases folded (`Cmd` → `meta`, `Option` → `alt`, `Spacebar` →
 * `space` …), and `?` expanded to `shift+/`. `Mod` is kept as `mod`, so the result is
 * the same on every platform (safe to store, e.g. as a rebinding).
 */
export function normalizeCombo(combo: string): string {
	const tokens = new Set<string>();
	const trimmed = combo.trim();
	// A lone "+" (or a combo ending in "++") names the plus key itself.
	const raw = trimmed === "+" ? ["+"] : trimmed.replace(/\+\+$/, "+plus").split("+");
	for (const part of raw) {
		const t = part.trim().toLowerCase();
		if (!t) continue;
		if (t === "?") {
			tokens.add("shift");
			tokens.add("/");
			continue;
		}
		tokens.add(t === "plus" ? "+" : (TOKEN_ALIASES[t] ?? t));
	}
	return [...tokens].sort().join("+");
}

/** Resolve `mod` (and, in `"either"` mode, Cmd) in a canonical combo for matching. */
function resolveCombo(canonical: string, mod: ModKeyMode, isMac: boolean): string {
	if (!canonical) return canonical;
	const tokens = new Set(canonical.split("+"));
	if (tokens.delete("mod")) tokens.add(mod === "either" ? "ctrl" : isMac ? "meta" : "ctrl");
	if (mod === "either" && tokens.delete("meta")) tokens.add("ctrl");
	return [...tokens].sort().join("+");
}

const CODE_TOKENS: Record<string, string> = {
	Space: "space",
	ShiftLeft: "shift",
	ShiftRight: "shift",
	ControlLeft: "ctrl",
	ControlRight: "ctrl",
	MetaLeft: "meta",
	MetaRight: "meta",
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
 * form (`"KeyW"` → `"w"`, `"Digit1"` → `"1"`, `"ShiftLeft"` → `"shift"`, `"ArrowUp"` →
 * `"arrowup"`). Used for physical-key matching and to compare held-key bindings with
 * shortcut combos when looking for overlaps.
 */
export function codeToKey(code: string): string {
	if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
	if (/^Digit[0-9]$/.test(code)) return code.slice(5);
	return CODE_TOKENS[code] ?? code.toLowerCase();
}

const MODIFIER_KEYS = new Set(["control", "meta", "shift", "alt", "os", "altgraph"]);

/** A plain letter or digit: its `key` is trusted as-is (it follows the keyboard layout). */
const isPlainKey = (key: string): boolean => /^[a-z0-9]$/.test(key);

/**
 * The combos a keydown can match, resolved for `options` (see {@link ComboOptions}).
 * The first is from `KeyboardEvent.key` (follows the layout: `"q"` on AZERTY's A key).
 * When Shift / Alt is held or the key is not a plain letter / digit, the physical key
 * (`KeyboardEvent.code`) is added too, so `Shift+1` matches although `key` is `"!"`, and
 * `Mod+Shift+]` matches although `key` is `"}"`.
 */
export function eventToCombos(event: KeyboardEvent, options: ComboOptions = {}): string[] {
	const mod = options.mod ?? "platform";
	const mods: string[] = [];
	if (mod === "either") {
		if (event.ctrlKey || event.metaKey) mods.push("ctrl");
	} else {
		if (event.ctrlKey) mods.push("ctrl");
		if (event.metaKey) mods.push("meta");
	}
	if (event.shiftKey) mods.push("shift");
	if (event.altKey) mods.push("alt");

	const raw = (event.key ?? "").toLowerCase();
	const key = raw === " " ? "space" : (TOKEN_ALIASES[raw] ?? raw);
	const out: string[] = [];
	const push = (k: string): void => {
		const combo = (MODIFIER_KEYS.has(k) || !k ? [...mods] : [...mods, k]).sort().join("+");
		if (!out.includes(combo)) out.push(combo);
	};
	push(key);
	const code = event.code ?? "";
	if (code && (event.shiftKey || event.altKey || !isPlainKey(key))) {
		const physical = codeToKey(code);
		if (physical && physical !== code.toLowerCase()) push(physical);
	}
	return out;
}

/** The main combo a keydown produces (its `key`-based form; see {@link eventToCombos}). */
export function eventToCombo(event: KeyboardEvent, options: ComboOptions = {}): string {
	return eventToCombos(event, options)[0] ?? "";
}

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
	/** Who gets a key several active bindings share (default `"first"`); see {@link KeyConflictPolicy}. */
	conflictPolicy?: KeyConflictPolicy;
	/** How `Mod` / Cmd / Ctrl match (default `"platform"`); see {@link ModKeyMode}. */
	mod?: ModKeyMode;
	/** Treat the platform as macOS (default: detected). */
	isMac?: boolean;
	/** The host's gate; see {@link Keymap.setGate}. */
	gate?: KeyGate | null;
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

/** `"first"` order: priority (high first), then plugin order, then registration order. */
const compareEntries = (a: Entry, b: Entry): number =>
	(b.spec.priority ?? 0) - (a.spec.priority ?? 0) || a.ownerIndex - b.ownerIndex || a.seq - b.seq;

/** `"last"` order: priority (high first), then the plugin listed last / registered last. */
const compareEntriesLast = (a: Entry, b: Entry): number =>
	(b.spec.priority ?? 0) - (a.spec.priority ?? 0) || b.ownerIndex - a.ownerIndex || b.seq - a.seq;

export function createKeymap(options: CreateKeymapOptions = {}): KeymapInternal {
	const entries = new Map<string, Entry>();
	const hostKeys = { ...(options.keys ?? {}) };
	const overrides = new Map<string, readonly string[] | null>(
		Object.entries(options.overrides ?? {}),
	);
	const listeners = new Set<() => void>();
	let seq = 0;
	let policy: KeyConflictPolicy = options.conflictPolicy ?? "first";
	let gate: KeyGate | null = options.gate ?? null;
	const comboOptions: Required<ComboOptions> = {
		mod: options.mod ?? "platform",
		isMac: options.isMac ?? detectMac(),
	};
	/** A canonical combo resolved for this keymap's `mod` mode / platform. */
	const resolve = (combo: string): string =>
		resolveCombo(normalizeCombo(combo), comboOptions.mod, comboOptions.isMac);
	/** The key `key` stands for, for overlap detection. */
	const keyToken = (kind: KeyBindingKind, key: string): string =>
		kind === "hold"
			? resolveCombo(codeToKey(key), comboOptions.mod, comboOptions.isMac)
			: resolve(key);

	/** Display / winning order under the current policy (`"all"` and custom use `"first"`'s). */
	const order = (): ((a: Entry, b: Entry) => number) =>
		policy === "last" ? compareEntriesLast : compareEntries;

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

	const matches = (entry: Entry, event: KeyboardEvent, combos: readonly string[]): boolean => {
		const keys = keysOf(entry);
		if (keys.length === 0) return false;
		if (entry.kind === "hold") return !!event.code && keys.includes(event.code);
		return keys.some((k) => combos.includes(resolve(k)));
	};

	const passesGate = (entry: Entry, event: KeyboardEvent): boolean => {
		if (!gate) return true;
		try {
			return gate(snapshot(entry), event) === true;
		} catch (error) {
			console.error("[usketch] keymap gate threw; blocking the key", error);
			return false;
		}
	};

	/** The bindings that get this keydown under the current policy, in the order they run. */
	const selected = (event: KeyboardEvent): Entry[] => {
		// Keys typed into an IME composition belong to the text, not to shortcuts.
		if (event.isComposing || event.keyCode === 229) return [];
		const combos = eventToCombos(event, comboOptions);
		const candidates: Entry[] = [];
		for (const entry of entries.values()) {
			if (matches(entry, event, combos) && isActive(entry) && passesGate(entry, event)) {
				candidates.push(entry);
			}
		}
		if (candidates.length <= 1) return candidates;
		if (policy === "all") return candidates.sort(compareEntries);
		if (policy === "first" || policy === "last") {
			const cmp = order();
			let best = candidates[0] as Entry;
			for (const entry of candidates) if (cmp(entry, best) < 0) best = entry;
			return [best];
		}
		candidates.sort(compareEntries);
		let chosen: readonly KeyBinding[];
		try {
			chosen = policy(candidates.map(snapshot), event);
		} catch (error) {
			console.error("[usketch] keymap conflict policy threw; using the first binding", error);
			return candidates.slice(0, 1);
		}
		const byId = new Map(candidates.map((e) => [e.spec.id, e]));
		const out: Entry[] = [];
		for (const binding of chosen ?? []) {
			const entry = byId.get(binding.id);
			if (entry && !out.includes(entry)) out.push(entry);
		}
		return out;
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
			return [...entries.values()].sort(order()).map(snapshot);
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
				conflicts.push({ key, bindings: [...list].sort(order()).map(snapshot) });
			}
			return conflicts.sort((a, b) => a.key.localeCompare(b.key));
		},

		resolve(event) {
			const entry = selected(event)[0];
			return entry ? snapshot(entry) : undefined;
		},

		resolveAll(event) {
			return selected(event).map(snapshot);
		},

		claims(id, event) {
			return selected(event).some((entry) => entry.spec.id === id);
		},

		handleKeyDown(event) {
			// "hold" bindings among the selected ones are left to their plugins.
			const presses = selected(event).filter((e) => e.kind === "press" && e.spec.onPress);
			if (presses.length === 0) return false;
			event.preventDefault();
			for (const entry of presses) {
				try {
					entry.spec.onPress?.(event);
				} catch (error) {
					console.error(`[usketch] key binding "${entry.spec.id}" threw`, error);
				}
			}
			return true;
		},

		getConflictPolicy() {
			return policy;
		},

		getGate() {
			return gate;
		},

		setGate(next) {
			gate = next;
		},

		normalizeKey(key, kind = "press") {
			return keyToken(kind, key);
		},

		setConflictPolicy(next) {
			if (next === policy) return;
			policy = next;
			notify();
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
		resolveAll: keymap.resolveAll,
		claims: keymap.claims,
		handleKeyDown: keymap.handleKeyDown,
		setKeys: keymap.setKeys,
		resetKeys: keymap.resetKeys,
		getOverrides: keymap.getOverrides,
		subscribe: keymap.subscribe,
		getConflictPolicy: keymap.getConflictPolicy,
		getGate: keymap.getGate,
		setGate: keymap.setGate,
		normalizeKey: keymap.normalizeKey,
		setConflictPolicy: keymap.setConflictPolicy,
	};
}

/**
 * Human-readable list of overlaps, for a dev-time console warning. `markWinner` puts ▶
 * on the binding that gets the key when all of them act (`"first"` / `"last"` policies).
 */
export function describeConflicts(conflicts: readonly KeyConflict[], markWinner = true): string {
	return conflicts
		.map((c) => {
			const who = c.bindings
				.map(
					(b, i) =>
						`${markWinner && i === 0 ? "▶ " : ""}${b.label ?? b.id} (${b.pluginId ?? "app"})`,
				)
				.join(" / ");
			return `  ${c.key}: ${who}`;
		})
		.join("\n");
}
