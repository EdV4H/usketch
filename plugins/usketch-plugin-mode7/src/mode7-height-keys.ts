// Hold-to-fly camera height: while the 3D view is on, holding an "up" key raises
// `camera.height` and a "down" key lowers it, at a steady on-screen speed. Keys are
// `KeyboardEvent.code`s (layout-independent), Space / Shift by default, and the host
// can rebind or turn them off. Anything that drives the height itself (e.g. a followed
// character via `view3dService.setCameraHeight`) simply overrides it on its next frame;
// a plugin that handles the same key first (the character's jump on Space stops the
// event in the capture phase) keeps it.
import type { Mode7Store } from "./mode7-store.js";

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
	/** `null` = off. */
	keys: HeightKeys | null;
	/** Screen px per second. */
	speed: number;
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

/** Listen for the height keys; returns a teardown. */
export function setupHeightKeys(
	store: Mode7Store,
	config: HeightKeyConfig,
	zoom: () => number,
): () => void {
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
		const dh = heightStep(dir, config.speed, dt, zoom());
		if (dh !== 0) store.setCamera({ height: (store.getState().camera.height ?? 0) + dh });
		raf = requestAnimationFrame(frame);
	};
	const ensureLoop = (): void => {
		if (raf === null && typeof requestAnimationFrame === "function") {
			raf = requestAnimationFrame(frame);
		}
	};

	const isKey = (code: string): boolean => {
		const keys = config.keys;
		return !!keys && (keys.up.includes(code) || keys.down.includes(code));
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!isKey(e.code) || !store.getState().active) return;
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
		// Bubble phase: a plugin that owns the key (capture phase + stopImmediatePropagation,
		// like the character's jump) wins.
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", clear);
	}
	const offStore = store.subscribe(() => {
		if (!store.getState().active) clear();
	});

	return () => {
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
