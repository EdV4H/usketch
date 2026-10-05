// The runtime loop: held keys → physics step → follow camera → awareness publish,
// plus smoothing of remote characters. One rAF loop that runs only while the local
// character is enabled or a remote one is still easing into place.
import {
	type PluginContext,
	type Point,
	screenToWorld,
	type Viewport,
	viewportRotation,
} from "@edv4h/usketch-shared";
import {
	anchorPx,
	type CameraFocus,
	easeFocus,
	followViewport,
	sameViewport,
	smoothingAlpha,
	targetRotation,
} from "./character-camera.js";
import { createKeyInput } from "./character-input.js";
import { CharacterLayer } from "./character-layer.js";
import { stepCharacter } from "./character-physics.js";
import type { CharacterStore } from "./character-store.js";
import {
	type CharacterAwareness,
	type CharacterSync,
	createCharacterSync,
	easeRemotes,
} from "./character-sync.js";
import type { CharacterKeys, RemoteCharacter } from "./character-types.js";

export const CHARACTER_LAYER_ID = "character";
/** Above shapes and most overlays, below the HUD (9999). */
const CHARACTER_LAYER_ORDER = 700;
/** `viewport:claimed` priority: above start-position (10), below deep links (100). */
export const CHARACTER_VIEWPORT_PRIORITY = 20;
/** Remote pose smoothing (see `smoothingAlpha`). */
const REMOTE_SMOOTHING = 0.75;
/** Largest simulated step, so a background-tab pause doesn't teleport the character. */
const MAX_DT = 0.05;

function scheduleFrame(fn: (now: number) => void): number {
	if (typeof requestAnimationFrame === "function") return requestAnimationFrame(fn);
	return setTimeout(() => fn(Date.now()), 16) as unknown as number;
}
function cancelFrame(handle: number): void {
	if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(handle);
	else clearTimeout(handle);
}

/**
 * The main canvas's pixel size. Found via `[data-layer-id]` wrappers' parent (the
 * app build strips `data-testid`, so `canvas-container` can't be queried); the
 * largest wins when a minimap also renders layers. Falls back to the window.
 */
export function canvasSize(): { width: number; height: number } {
	if (typeof document !== "undefined") {
		let best: { width: number; height: number } | null = null;
		const seen = new Set<Element>();
		for (const el of document.querySelectorAll("[data-layer-id]")) {
			const parent = el.parentElement;
			if (!parent || seen.has(parent)) continue;
			seen.add(parent);
			const r = parent.getBoundingClientRect();
			if (!best || r.width * r.height > best.width * best.height) {
				best = { width: r.width, height: r.height };
			}
		}
		if (best && best.width > 0 && best.height > 0) return best;
	}
	if (typeof window !== "undefined")
		return { width: window.innerWidth, height: window.innerHeight };
	return { width: 0, height: 0 };
}

export interface CharacterRuntimeOptions {
	keys: CharacterKeys;
	awareness?: CharacterAwareness;
}

export interface CharacterRuntime {
	/** Move the character to the world point under its screen anchor. */
	placeAtAnchor(): void;
	/** The screen-px anchor (for rotating the camera about the character's spot). */
	anchorPoint(): Point;
	setKeys(keys: CharacterKeys): void;
	dispose(): void;
}

export function setupCharacterRuntime(
	ctx: PluginContext,
	store: CharacterStore,
	options: CharacterRuntimeOptions,
): CharacterRuntime {
	const keys = createKeyInput(options.keys, () => store.getState().enabled);
	let cam: CameraFocus | null = null;
	let display: ReadonlyMap<string, RemoteCharacter> = new Map();
	let rafId: number | null = null;
	let lastFrame: number | null = null;
	// Set while WE write the viewport, so our own writes don't read as a user pan.
	let writing = false;

	const anchorPoint = (): Point => anchorPx(store.getState().anchor, canvasSize());

	const sync: CharacterSync | null = options.awareness
		? createCharacterSync(options.awareness, store, () => ensureLoop())
		: null;

	const placeAtAnchor = (): void => {
		const vp = ctx.store.getViewport();
		const a = anchorPoint();
		store.setPosition(screenToWorld(a.x, a.y, vp));
		cam = null;
	};

	const writeViewport = (vp: Viewport): void => {
		writing = true;
		try {
			ctx.store.setViewport(vp);
		} finally {
			writing = false;
		}
	};

	// A hoisted declaration: the awareness sync (created above) can request a frame
	// during its initial read, before this point in setup has run.
	function frame(now: number): void {
		rafId = null;
		const dt = lastFrame === null ? 0 : Math.min(MAX_DT, Math.max(0, (now - lastFrame) / 1000));
		lastFrame = now;
		let s = store.getState();

		if (s.enabled) {
			if (!s.spawned) {
				placeAtAnchor();
				// Face screen-up in whatever way the camera is currently turned.
				store.setHeading(-viewportRotation(ctx.store.getViewport()));
				s = store.getState();
			}
			const input = keys.read();
			if (s.followSuspended && keys.anyHeld()) store.setFollowSuspended(false);

			const vp = ctx.store.getViewport();
			const pose = stepCharacter(
				s.pose,
				input,
				dt,
				s.controlScheme,
				s.motion,
				viewportRotation(vp),
			);
			store.setPose(pose);
			s = store.getState();

			if (s.cameraMode !== "free" && !s.followSuspended) {
				const target: CameraFocus = {
					focus: { x: pose.x, y: pose.y },
					rotation: targetRotation(s.cameraMode, pose.heading),
				};
				const anchor = anchorPoint();
				// (Re)seed from what's on screen now, so resuming/switching eases instead of jumping.
				const from = cam ?? {
					focus: screenToWorld(anchor.x, anchor.y, vp),
					rotation: viewportRotation(vp),
				};
				cam = easeFocus(from, target, smoothingAlpha(s.followSmoothing, dt));
				const next = followViewport(cam, anchor, vp.zoom);
				if (!sameViewport(vp, next)) writeViewport(next);
			}
			sync?.publish();
		}

		let settling = false;
		if (sync) {
			const eased = easeRemotes(display, sync.targets(), smoothingAlpha(REMOTE_SMOOTHING, dt));
			settling = eased.settling;
			if (!sameRemotes(display, eased.next)) {
				display = eased.next;
				store.setRemotes(display);
			}
		}

		if (store.getState().enabled || settling) ensureLoop();
		else lastFrame = null;
	}

	function ensureLoop(): void {
		if (rafId === null) rafId = scheduleFrame(frame);
	}

	// Enable/disable + mode transitions.
	let prev = store.getState();
	const unsubscribe = store.subscribe(() => {
		const s = store.getState();
		if (s.enabled !== prev.enabled) {
			if (s.enabled) {
				cam = null;
				// Tell load-time camera plugins (start-position, …) to stand down.
				ctx.events.emit("viewport:claimed", {
					source: "character",
					priority: CHARACTER_VIEWPORT_PRIORITY,
				});
			} else {
				cam = null;
				// Hand the camera back upright.
				if (viewportRotation(ctx.store.getViewport()) !== 0) {
					ctx.store.rotateTo(0, anchorPoint(), { animate: true });
				}
			}
			sync?.publish(true);
		}
		if (s.cameraMode !== prev.cameraMode || s.followSuspended !== prev.followSuspended) {
			// Re-seed the smoothed camera from the live viewport so resuming never jumps.
			cam = null;
		}
		prev = s;
		if (s.enabled) ensureLoop();
	});

	// A viewport change we didn't make: zoom (wheel / keys) is welcome — the follow
	// keeps the character on its anchor at the new zoom. A pure pan means the user
	// wants to look around, so pause following until a movement key is pressed.
	let lastZoom = ctx.store.getViewport().zoom;
	const offViewport = ctx.store.onMutation((e) => {
		if (e.type !== "viewport:changed") return;
		const vp = ctx.store.getViewport();
		const zoomChanged = Math.abs(vp.zoom - lastZoom) > 1e-9;
		lastZoom = vp.zoom;
		if (writing || zoomChanged) return;
		const s = store.getState();
		if (s.enabled && s.cameraMode !== "free") store.setFollowSuspended(true);
	});

	ctx.layers.register({
		id: CHARACTER_LAYER_ID,
		order: CHARACTER_LAYER_ORDER,
		fixed: true,
		render: (rc) => <CharacterLayer store={store} viewport={rc.viewport} />,
	});

	if (store.getState().enabled || sync) ensureLoop();

	return {
		placeAtAnchor,
		anchorPoint,
		setKeys: (k) => keys.setKeys(k),
		dispose() {
			if (rafId !== null) cancelFrame(rafId);
			rafId = null;
			unsubscribe();
			offViewport();
			keys.dispose();
			sync?.dispose();
			ctx.layers.unregister(CHARACTER_LAYER_ID);
		},
	};
}

function sameRemotes(
	a: ReadonlyMap<string, RemoteCharacter>,
	b: ReadonlyMap<string, RemoteCharacter>,
): boolean {
	if (a.size !== b.size) return false;
	for (const [id, r] of b) {
		const o = a.get(id);
		if (
			!o ||
			o.x !== r.x ||
			o.y !== r.y ||
			o.heading !== r.heading ||
			o.moving !== r.moving ||
			o.speed !== r.speed ||
			o.name !== r.name ||
			o.appearance !== r.appearance
		) {
			return false;
		}
	}
	return true;
}
