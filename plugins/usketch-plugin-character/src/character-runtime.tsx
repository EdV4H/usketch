// The runtime loop: held keys → physics step → follow camera → awareness publish,
// plus smoothing of remote characters. One rAF loop that runs only while the local
// character is enabled or a remote one is still easing into place.
import {
	groundHeightService,
	type PluginContext,
	type Point,
	screenToWorld,
	solidHeightService,
	type Viewport,
	view3dService,
	viewportRotation,
} from "@edv4h/usketch-shared";
import {
	anchorPx,
	type CameraFocus,
	easeFocus,
	followCameraHeight,
	followViewport,
	sameViewport,
	smoothingAlpha,
	targetRotation,
} from "./character-camera.js";
import { createKeyInput } from "./character-input.js";
import { CharacterLayer, type CharacterView3d } from "./character-layer.js";
import {
	blockingHeight,
	DEFAULT_JUMP,
	groundSlope,
	type HeightAt,
	holdDriftForHop,
	IDLE_JUMP,
	type JumpTimers,
	pushInAir,
	type SolidAt,
	SWEEP_STEP,
	slideOnSteep,
	standingHeight,
	stepCharacter,
	stepVertical,
	sweepToGround,
} from "./character-physics.js";
import { type CharacterStore, driftHopHeight, effectiveJump } from "./character-store.js";
import {
	type CharacterAwareness,
	type CharacterSync,
	createCharacterSync,
	easeRemotes,
} from "./character-sync.js";
import type { CharacterKeys, RemoteCharacter } from "./character-types.js";
import {
	combineInput,
	isVirtualInputActive,
	normalizeVirtualInput,
	type VirtualInput,
	virtualPresses,
} from "./character-virtual-input.js";

export const CHARACTER_LAYER_ID = "character";
/** Above shapes and most overlays, below the HUD (9999). */
const CHARACTER_LAYER_ORDER = 700;
/** `viewport:claimed` priority: above start-position (10), below deep links (100). */
export const CHARACTER_VIEWPORT_PRIORITY = 20;
/** Remote pose smoothing (see `smoothingAlpha`). */
const REMOTE_SMOOTHING = 0.75;
/**
 * Camera-height smoothing (see `smoothingAlpha`): the 3D view's camera follows the ground
 * under the character at its own, never-rigid pace, so a step up a cliff glides.
 */
const CAMERA_HEIGHT_SMOOTHING = 0.9;
/** Largest simulated step, so a background-tab pause doesn't teleport the character. */
const MAX_DT = 0.05;
/** How long a measured canvas size is reused (a window resize re-measures at once). */
const CANVAS_SIZE_TTL_MS = 500;

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
	/** Jump on the next frame, as a full (held) jump. No-op while jumping is off. */
	jump(): void;
	setKeys(keys: CharacterKeys): void;
	getKeys(): CharacterKeys;
	/** Feed analog input from a host control (touch stick …); `null` releases it. */
	setVirtualInput(input: Partial<VirtualInput> | null): void;
	getVirtualInput(): VirtualInput | null;
	dispose(): void;
}

export function setupCharacterRuntime(
	ctx: PluginContext,
	store: CharacterStore,
	options: CharacterRuntimeOptions,
): CharacterRuntime {
	const keys = createKeyInput(
		options.keys,
		() => store.getState().enabled,
		() => store.getState().controlScheme === "vehicle" && store.getState().drift !== null,
		() => store.getState().jump !== null,
	);
	let jumpTimers: JumpTimers = IDLE_JUMP;
	// `jump()` from code: a press on the next frame, held until the apex (a full jump).
	let pendingJump = false;
	let holdJump = false;
	// Cleared when the character turns off, so a control that never sent its release
	// (unmounted mid-touch) can't leave the next ride driving on its own.
	let virtual: VirtualInput | null = null;
	// Virtual button presses since the last frame (a tap may press and release in between).
	let virtualJumpPressed = false;
	let virtualDriftPressed = false;
	let cam: CameraFocus | null = null;
	// The camera height we last gave the 3D view (world units), eased toward the ground
	// under the character; `null` while we aren't driving it.
	let cameraHeight: number | null = null;
	// The unsmoothed height it follows (see `followCameraHeight`); `null` while not driving.
	let cameraBase: number | null = null;
	const setCameraHeight = (height: number | null): void => {
		if (height === null) cameraBase = null;
		if (height === cameraHeight) return;
		cameraHeight = height;
		view3dService.get(ctx.services)?.setCameraHeight?.(height ?? 0);
	};
	let display: ReadonlyMap<string, RemoteCharacter> = new Map();
	let rafId: number | null = null;
	let lastFrame: number | null = null;
	// Set while WE write the viewport, so our own writes don't read as a user pan.
	let writing = false;

	// The anchor is read every frame while following; measuring the canvas walks the layer
	// wrappers and forces a layout, so the size is cached and refreshed on resize or after
	// a short TTL (covers layout changes that aren't a window resize, e.g. a side panel).
	let sizeCache: { width: number; height: number; at: number } | null = null;
	const cachedCanvasSize = (): { width: number; height: number } => {
		const now = Date.now();
		if (!sizeCache || now - sizeCache.at > CANVAS_SIZE_TTL_MS) {
			sizeCache = { ...canvasSize(), at: now };
		}
		return sizeCache;
	};
	const onResize = (): void => {
		sizeCache = null;
	};
	if (typeof window !== "undefined") window.addEventListener("resize", onResize);

	const anchorPoint = (): Point => anchorPx(store.getState().anchor, cachedCanvasSize());

	// Ground height from whichever plugin provides it (e.g. the map's raised terrain), looked up
	// per call so a provider registered later still counts. Absent = flat board.
	const groundAt: HeightAt = (x, y) => groundHeightService.get(ctx.services)?.heightAt(x, y) ?? 0;
	// Solids on the ground (e.g. raised 3D shapes): walls block, tops can be stood on.
	const solidAt: SolidAt = (x, y) => solidHeightService.get(ctx.services)?.heightAt(x, y) ?? null;
	// What a move must clear (walls included) and what the feet stand on (walls excluded).
	const blockAt: HeightAt = (x, y) => blockingHeight(groundAt(x, y), solidAt(x, y));
	const heightAt: HeightAt = (x, y) => standingHeight(groundAt(x, y), solidAt(x, y));

	// The 3D view (Mode 7), looked up per call: a provider set up later still counts.
	const view3d: CharacterView3d = {
		amount: () => view3dService.get(ctx.services)?.amount() ?? 0,
		subscribe: (listener) => view3dService.get(ctx.services)?.subscribe(listener) ?? (() => {}),
	};

	const sync: CharacterSync | null = options.awareness
		? createCharacterSync(options.awareness, store, () => ensureLoop())
		: null;

	const placeAtAnchor = (): void => {
		const vp = ctx.store.getViewport();
		const a = anchorPoint();
		store.setPosition(screenToWorld(a.x, a.y, vp));
		jumpTimers = IDLE_JUMP;
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
			const keyInput = combineInput(keys.read(), virtual);
			const input = {
				...keyInput,
				jump: keyInput.jump || holdJump,
				jumpPressed: keyInput.jumpPressed || pendingJump || virtualJumpPressed,
				driftPressed: keyInput.driftPressed || virtualDriftPressed,
			};
			if (pendingJump) holdJump = true;
			pendingJump = false;
			virtualJumpPressed = false;
			virtualDriftPressed = false;
			if (s.followSuspended && (keys.anyHeld() || isVirtualInputActive(virtual))) {
				store.setFollowSuspended(false);
			}

			const vp = ctx.store.getViewport();
			const hopHeight = driftHopHeight(s);
			const stepped = stepCharacter(
				s.pose,
				holdDriftForHop(input, s.pose, hopHeight),
				dt,
				s.controlScheme,
				s.motion,
				viewportRotation(vp),
				s.drift,
			);
			// Cliffs taller than the climbable step, slopes steeper than the climbable one
			// and walls block the move (slide along them), checked in short stretches so a
			// fast move can't skip a thin wall. In the air a slope jump's sideways speed
			// carries on.
			const swept = sweepToGround(
				s.pose,
				pushInAir(s.pose, stepped, dt),
				blockAt,
				s.motion.maxStep,
				SWEEP_STEP,
				s.motion.maxSlope,
			);
			// Ground steeper than that slides the character down.
			const moved = slideOnSteep(swept, heightAt, blockAt, s.motion, dt);
			// Then up and down: jumps (along the slope as far as tuned), falls off cliffs,
			// landings.
			const vertical = stepVertical(
				moved,
				jumpTimers,
				input,
				dt,
				heightAt(moved.x, moved.y),
				s.motion.maxStep,
				effectiveJump(s),
				hopHeight,
				groundSlope(heightAt, moved.x, moved.y),
			);
			jumpTimers = vertical.timers;
			const pose = vertical.pose;
			if (holdJump && (!pose.airborne || pose.vz <= 0)) holdJump = false;
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
				// Raise the 3D view's camera with the character: on a mountain it stays in view.
				// In the air it holds the take-off height (a jump still rises on screen, a pit
				// below doesn't dip the view) until a hover climbs past a jump's height or a
				// fall drops below it (see `followCameraHeight`).
				// Only while the view is (partly) 3D: the flat board has no camera to raise.
				if (view3d.amount() > 0) {
					cameraBase = followCameraHeight(
						cameraBase,
						pose,
						(effectiveJump(s) ?? DEFAULT_JUMP).height,
					);
					const to = cameraBase;
					const at = cameraHeight ?? 0;
					setCameraHeight(at + (to - at) * smoothingAlpha(CAMERA_HEIGHT_SMOOTHING, dt));
				} else {
					setCameraHeight(null);
				}
			} else if (s.cameraMode === "free") {
				setCameraHeight(null);
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
				setCameraHeight(null);
				virtual = null;
				virtualJumpPressed = false;
				virtualDriftPressed = false;
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
	// wants to look around, so pause following until a movement key (or the virtual
	// control) is pressed.
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
		render: (rc) => (
			<CharacterLayer store={store} viewport={rc.viewport} heightAt={heightAt} view3d={view3d} />
		),
	});

	if (store.getState().enabled || sync) ensureLoop();

	return {
		placeAtAnchor,
		anchorPoint,
		jump() {
			const s = store.getState();
			if (!s.enabled || !s.jump) return;
			pendingJump = true;
			ensureLoop();
		},
		setKeys: (k) => keys.setKeys(k),
		getKeys: () => keys.getKeys(),
		setVirtualInput(input) {
			// Ignored while off (like the keys), so input sent before the character is
			// turned on can't make it drive away on its own the moment it spawns.
			const next = store.getState().enabled ? normalizeVirtualInput(input) : null;
			const pressed = virtualPresses(virtual, next);
			if (pressed.jump) virtualJumpPressed = true;
			if (pressed.drift) virtualDriftPressed = true;
			virtual = next;
			if (pressed.jump || pressed.drift) ensureLoop();
		},
		getVirtualInput: () => (virtual ? { ...virtual } : null),
		dispose() {
			if (rafId !== null) cancelFrame(rafId);
			rafId = null;
			unsubscribe();
			offViewport();
			setCameraHeight(null);
			keys.dispose();
			sync?.dispose();
			if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
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
			o.steering !== r.steering ||
			o.slip !== r.slip ||
			o.drifting !== r.drifting ||
			o.z !== r.z ||
			o.airborne !== r.airborne ||
			o.hovering !== r.hovering ||
			o.hoverGauge !== r.hoverGauge ||
			o.name !== r.name ||
			o.appearance !== r.appearance
		) {
			return false;
		}
	}
	return true;
}
