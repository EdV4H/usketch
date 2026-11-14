// The runtime loop: held keys → physics step → follow camera → awareness publish,
// plus smoothing of remote characters. One rAF loop that runs only while the local
// character is enabled or a remote one is still easing into place.
import {
	anchorPx,
	boardHeight,
	createFollowView,
	type PluginContext,
	type Point,
	screenToWorld,
	shortestAngleDelta,
	smoothingAlpha,
	view3dService,
	viewportRotation,
} from "@edv4h/usketch-shared";
import { createKeyInput } from "./character-input.js";
import { CharacterLayer, type CharacterView3d } from "./character-layer.js";
import {
	blockingHeight,
	DEFAULT_JUMP,
	groundSlope,
	type HeightAt,
	holdDriftForHop,
	holdSteerForRoll,
	IDLE_JUMP,
	type JumpTimers,
	landVehicle,
	pushInAir,
	type SolidAt,
	SWEEP_STEP,
	slideOnSteep,
	standingHeight,
	stepAirSpin,
	stepCharacter,
	stepVertical,
	sweepToGround,
} from "./character-physics.js";
import {
	type CharacterStore,
	cameraHeightMarginOf,
	driftHopHeight,
	effectiveJump,
} from "./character-store.js";
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
	/** See `KeyInput.getDefaultKeys`. */
	getDefaultKeys(): CharacterKeys;
	/** Listen for key binding changes. Returns an unsubscribe. */
	onKeysChange(listener: () => void): () => void;
	/** See `KeyInput.captureNextKey`. */
	captureNextKey(onKey: (code: string) => void): () => void;
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
		// The drift key also rolls a car in the air (`spinRate`), so it is a car's whenever
		// either is on — and not left to the host (e.g. Mode 7's Shift = camera down).
		() => {
			const st = store.getState();
			if (st.controlScheme !== "vehicle") return false;
			return st.drift !== null || (effectiveJump(st) ?? DEFAULT_JUMP).spinRate > 0;
		},
		() => store.getState().jump !== null,
		// Older hosts have no keymap (the keys then live in the input).
		(ctx as Partial<PluginContext>).keymap ?? null,
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
	// The follow camera (shared): eases the viewport after the character and raises the
	// 3D view's camera with the ground under it.
	const follow = createFollowView({ store: ctx.store, services: ctx.services });
	let display: ReadonlyMap<string, RemoteCharacter> = new Map();
	let rafId: number | null = null;
	let lastFrame: number | null = null;

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

	// The board's height: the ground (e.g. the map's raised terrain, the elevation field)
	// and the solids on it (e.g. raised 3D shapes: walls block, tops can be stood on). Its
	// providers are asked per call, so one registered later still counts. None = flat.
	const height = ctx.height ?? boardHeight(ctx.services);
	const groundAt: HeightAt = (x, y) => height.groundAt(x, y);
	const solidAt: SolidAt = (x, y) => height.solidAt(x, y);
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
		follow.reset();
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
			const air = effectiveJump(s) ?? DEFAULT_JUMP;
			// A car in the air turns its body with the keys (pitch, and roll with the drift
			// key held, which then doesn't also yaw it).
			const spinRate = s.controlScheme === "vehicle" ? air.spinRate : 0;
			const stepped = stepCharacter(
				stepAirSpin(s.pose, input, dt, spinRate, air.spinInertia),
				holdSteerForRoll(holdDriftForHop(input, s.pose, hopHeight), s.pose, spinRate),
				dt,
				s.controlScheme,
				s.motion,
				viewportRotation(vp),
				s.drift,
				air.airControl,
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
			const slopeHere = groundSlope(heightAt, moved.x, moved.y);
			const vertical = stepVertical(
				moved,
				jumpTimers,
				input,
				dt,
				heightAt(moved.x, moved.y),
				s.motion.maxStep,
				effectiveJump(s),
				hopHeight,
				slopeHere,
			);
			jumpTimers = vertical.timers;
			// Touchdown puts a car back on its wheels; landing off the ground's tilt slows it.
			const pose = landVehicle(s.pose, vertical.pose, slopeHere, { ...air, spinRate });
			if (holdJump && (!pose.airborne || pose.vz <= 0)) holdJump = false;
			store.setPose(pose);
			s = store.getState();

			if (s.cameraMode !== "free" && !s.followSuspended) {
				// Raise the 3D view's camera with the character: on a mountain it stays in view.
				// In the air it holds the take-off height (a jump still rises on screen, a pit
				// below doesn't dip the view) until a hover climbs past the margin or a fall
				// drops below it (see `followCameraHeight`).
				follow.step(pose, dt, {
					mode: s.cameraMode,
					anchor: anchorPoint(),
					smoothing: s.followSmoothing,
					heightMargin: cameraHeightMarginOf(s),
				});
			} else if (s.cameraMode === "free") {
				follow.releaseHeight();
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
				follow.reset();
				// Tell load-time camera plugins (start-position, …) to stand down.
				ctx.events.emit("viewport:claimed", {
					source: "character",
					priority: CHARACTER_VIEWPORT_PRIORITY,
				});
			} else {
				follow.reset();
				follow.releaseHeight();
				virtual = null;
				virtualJumpPressed = false;
				virtualDriftPressed = false;
				// Hand the camera back upright (as turned by the 3D view's heading).
				const upright = follow.viewTurn();
				if (shortestAngleDelta(viewportRotation(ctx.store.getViewport()), upright) !== 0) {
					ctx.store.rotateTo(upright, anchorPoint(), { animate: true });
				}
			}
			sync?.publish(true);
		}
		if (s.cameraMode !== prev.cameraMode || s.followSuspended !== prev.followSuspended) {
			// Re-seed the smoothed camera from the live viewport so resuming never jumps.
			follow.reset();
		}
		prev = s;
		if (s.enabled) ensureLoop();
	});

	// The user panned (not a zoom, nor the 3D view turning): pause following until a
	// movement key (or the virtual control) is pressed.
	const offPan = follow.onPan(() => {
		const s = store.getState();
		if (s.enabled && s.cameraMode !== "free") store.setFollowSuspended(true);
	});

	ctx.layers.register({
		id: CHARACTER_LAYER_ID,
		view3d: "depth",
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
		getDefaultKeys: () => keys.getDefaultKeys(),
		onKeysChange: (listener) => keys.onKeysChange(listener),
		captureNextKey: (onKey) => keys.captureNextKey(onKey),
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
			offPan();
			follow.releaseHeight();
			follow.dispose();
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
