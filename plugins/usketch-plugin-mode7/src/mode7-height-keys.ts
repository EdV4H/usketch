// Hold-to-fly camera height: while the 3D view is on, holding an "up" key raises
// `camera.height` and a "down" key lowers it, at a steady on-screen speed. Keys are
// `KeyboardEvent.code`s (layout-independent), Space / Shift by default. They are `"hold"`
// bindings in the app's keymap (HEIGHT_KEY_IDS), so hosts and viewers rebind them there
// and the keymap decides who gets a shared key: the bindings only count while the view
// is on and nothing else drives the height (e.g. a followed character via
// `view3dService.setCameraHeight` — else the two would tug the camera back and forth
// every frame), and sit below the character's keys (its jump on Space wins).
import type { Keymap } from "@edv4h/usketch-shared";
import type { Mode7Store } from "./mode7-store.js";

/** Keymap ids of the height keys (rebind with `keymap.setKeys(id, codes)`). */
export const HEIGHT_KEY_IDS = {
	up: "usketch-plugin-mode7:camera-up",
	down: "usketch-plugin-mode7:camera-down",
} as const;

/** Keymap priority of the height keys: above tool shortcuts (0), below the character's keys. */
export const HEIGHT_KEY_PRIORITY = 10;

/** Which keys move the camera up / down (`KeyboardEvent.code`). */
export interface HeightKeys {
	up: readonly string[];
	down: readonly string[];
}

/** Space raises, Shift lowers (either side). */
export const DEFAULT_HEIGHT_KEYS: HeightKeys = {
	up: ["Space"],
	down: ["ShiftLeft", "ShiftRight"],
};

/** Screen px per second the camera rises / sinks while a key is held. */
export const DEFAULT_HEIGHT_SPEED = 480;

/**
 * Milliseconds after a driver last set the height (`view3dService.setCameraHeight`)
 * during which the keys don't move it: a follower sets it every frame.
 */
export const HEIGHT_DRIVER_HOLD_MS = 250;

/** Remembers when a driver last set the camera height (see {@link HEIGHT_DRIVER_HOLD_MS}). */
export interface HeightDriver {
	/** A driver set the height now. */
	mark(): void;
	/** Whether a driver set it within the hold. */
	active(): boolean;
}

export function createHeightDriver(
	now: () => number = () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
): HeightDriver {
	let last = Number.NEGATIVE_INFINITY;
	return {
		mark: () => {
			last = now();
		},
		active: () => now() - last < HEIGHT_DRIVER_HOLD_MS,
	};
}

/** Longest step simulated in one frame (a background-tab pause doesn't jump the camera). */
const MAX_DT = 0.05;

/**
 * The height change (world units) for one frame: `direction` +1 up / −1 down / 0,
 * `speed` screen px per second, so it feels the same at every zoom. Pure.
 */
export function heightStep(direction: number, speed: number, dt: number, zoom: number): number {
	if (!direction || !(speed > 0) || !(dt > 0)) return 0;
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return (Math.sign(direction) * speed * Math.min(dt, MAX_DT)) / z;
}

type KeyTarget = {
	tagName?: string;
	isContentEditable?: boolean;
	getAttribute?: (name: string) => string | null;
};

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"]);
const KEY_ROLES = new Set([
	"textbox",
	"searchbox",
	"slider",
	"spinbutton",
	"combobox",
	"button",
	"checkbox",
	"radio",
	"switch",
	"tab",
	"menuitem",
	"option",
]);

/** Whether the focused element uses Space / Shift itself (typing, buttons, sliders …). */
function usesKeys(target: EventTarget | null): boolean {
	const el = target as KeyTarget | null;
	if (!el || typeof el.tagName !== "string") return false;
	if (TYPING_TAGS.has(el.tagName.toUpperCase())) return true;
	if (el.isContentEditable === true) return true;
	const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
	return role !== null && KEY_ROLES.has(role);
}

/** The live settings, owned by the plugin (the service edits them, the listener reads them). */
export interface HeightKeyConfig {
	/** `null` = off. With a keymap, kept in step with its bindings. */
	keys: HeightKeys | null;
	/** Screen px per second. */
	speed: number;
	/** Set by {@link setupHeightKeys} with a keymap: rebind there (what the service calls). */
	rebind?: (keys: HeightKeys | null) => void;
}

/** Normalize host input: `false` / `null` = off, a partial set falls back per direction. */
export function resolveHeightKeys(
	keys: Partial<HeightKeys> | false | null | undefined,
): HeightKeys | null {
	if (keys === false || keys === null) return null;
	return {
		up: [...(keys?.up ?? DEFAULT_HEIGHT_KEYS.up)],
		down: [...(keys?.down ?? DEFAULT_HEIGHT_KEYS.down)],
	};
}

/**
 * Listen for the height keys; returns a teardown. With a keymap (`ctx.keymap`) the keys
 * are registered there (`config.keys` as their defaults) and only taken when the keymap
 * gives them to us; without one (an older host) they are taken whenever the view is on.
 */
export function setupHeightKeys(
	store: Mode7Store,
	config: HeightKeyConfig,
	zoom: () => number,
	/** Whether something else drives the height now (the keys then leave it alone). */
	driven: () => boolean = () => false,
	keymap: Keymap | null = null,
): () => void {
	const offKeymap = keymap ? bindHeightKeys(keymap, store, config, driven) : null;
	const held = new Set<string>();
	let raf: number | null = null;
	let last: number | null = null;

	const direction = (): number => {
		const keys = config.keys;
		if (!keys) return 0;
		const up = keys.up.some((c) => held.has(c)) ? 1 : 0;
		const down = keys.down.some((c) => held.has(c)) ? 1 : 0;
		return up - down;
	};

	const frame = (now: number): void => {
		raf = null;
		const dt = last === null ? 0 : (now - last) / 1000;
		last = now;
		const dir = direction();
		if (dir === 0 || !store.getState().active) {
			last = null;
			return;
		}
		const dh = driven() ? 0 : heightStep(dir, config.speed, dt, zoom());
		if (dh !== 0) store.setCamera({ height: (store.getState().camera.height ?? 0) + dh });
		raf = requestAnimationFrame(frame);
	};
	const ensureLoop = (): void => {
		if (raf === null && typeof requestAnimationFrame === "function") {
			raf = requestAnimationFrame(frame);
		}
	};

	const isKey = (e: KeyboardEvent): boolean => {
		if (keymap) {
			return keymap
				.resolveAll(e)
				.some((b) => b.id === HEIGHT_KEY_IDS.up || b.id === HEIGHT_KEY_IDS.down);
		}
		const keys = config.keys;
		return !!keys && (keys.up.includes(e.code) || keys.down.includes(e.code));
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!store.getState().active || !isKey(e)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (usesKeys(e.target)) return;
		held.add(e.code);
		// Space would scroll the page.
		e.preventDefault();
		ensureLoop();
	};
	const onKeyUp = (e: KeyboardEvent): void => {
		held.delete(e.code);
	};
	const clear = (): void => {
		held.clear();
	};

	const hasWindow = typeof window !== "undefined";
	if (hasWindow) {
		// Bubble phase: a plugin that takes the key in the capture phase and stops it (the
		// character does, for listeners not on the keymap) keeps it there too.
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", clear);
	}
	const offStore = store.subscribe(() => {
		if (!store.getState().active) clear();
	});

	return () => {
		offKeymap?.();
		offStore();
		clear();
		if (raf !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
		raf = null;
		if (hasWindow) {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", clear);
		}
	};
}

/** Register the height keys in `keymap` and keep `config.keys` in step. Returns a teardown. */
function bindHeightKeys(
	keymap: Keymap,
	store: Mode7Store,
	config: HeightKeyConfig,
	driven: () => boolean,
): () => void {
	const when = (): boolean => store.getState().active && !driven();
	const defaults = config.keys;
	const offs = (["up", "down"] as const).map((dir, order) =>
		keymap.register({
			id: HEIGHT_KEY_IDS[dir],
			kind: "hold",
			keys: [...(defaults?.[dir] ?? [])],
			label: dir === "up" ? "カメラを上げる" : "カメラを下げる",
			category: "Mode 7 (3D)",
			order,
			priority: HEIGHT_KEY_PRIORITY,
			when,
		}),
	);
	const sync = (): void => {
		const up = keymap.getKeys(HEIGHT_KEY_IDS.up);
		const down = keymap.getKeys(HEIGHT_KEY_IDS.down);
		config.keys = up.length === 0 && down.length === 0 ? null : { up: [...up], down: [...down] };
	};
	sync();
	const offSubscribe = keymap.subscribe(sync);
	config.rebind = (keys) => {
		for (const dir of ["up", "down"] as const) {
			const id = HEIGHT_KEY_IDS[dir];
			const want = keys ? [...keys[dir]] : [];
			const def = keymap.get(id)?.defaultKeys ?? [];
			if (want.join() === def.join()) keymap.resetKeys(id);
			else keymap.setKeys(id, want);
		}
	};
	return () => {
		delete config.rebind;
		offSubscribe();
		for (const off of offs) off();
		config.keys = defaults;
	};
}
