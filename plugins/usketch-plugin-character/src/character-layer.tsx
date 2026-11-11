// The one fixed (screen-space) layer that places every character — self and remote
// — at `worldToScreen(position)`. It draws NOTHING itself: each spot is a zero-size,
// pointer-transparent wrapper whose content is the host's `renderCharacter`. One
// screen-space layer keeps self/remote consistent (same size under zoom, same
// `screenHeading` math under camera rotation). The optional `renderShadow` gets a spot
// of its own on the GROUND under each character, while the body stands at its feet
// height — under a 3D view (Mode 7) a jump lifts the body off its shadow.
import { type Viewport, viewportRotation, worldToScreen, wrapDeg } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import {
	type Attitude,
	groundAttitude,
	groundSlope,
	type HeightAt,
	LEVEL,
} from "./character-physics.js";
import { characterSizePx } from "./character-size.js";
import { type CharacterStore, effectiveAirTilt, hoverGaugeOf } from "./character-store.js";
import type { CharacterRenderer, CharacterRenderProps } from "./character-types.js";

/** Screen px a shadow floats above its ground, so it doesn't z-fight a raised terrain top. */
const SHADOW_LIFT_PX = 0.5;

/** The 3D view's transition, `0` (flat) … `1` (3D) (see `view3dService` in shared). */
export interface CharacterView3d {
	amount(): number;
	subscribe(listener: () => void): () => void;
}

const NO_VIEW3D: CharacterView3d = { amount: () => 0, subscribe: () => () => {} };

/**
 * CSS that lays a flat (top-down) sprite along ground whose gradient on screen is
 * `(gx, gy)` (rise per px; height is toward the viewer, `translateZ`): the rotation that
 * takes the sprite's up (+z) to the ground's normal. `null` on flat ground. Pure.
 */
export function slopeTiltTransform(gx: number, gy: number): string | null {
	const m = Math.hypot(gx, gy);
	if (!(m > 1e-4) || !Number.isFinite(m)) return null;
	const len = Math.hypot(m, 1);
	const c = 1 / len; // cos of the tilt
	const s = m / len; // sin of the tilt
	const ax = gy / m; // rotation axis: up × normal, normalized
	const ay = -gx / m;
	const k = 1 - c;
	const r = (v: number) => Math.round(v * 1e6) / 1e6;
	// matrix3d is column-major.
	return `matrix3d(${[
		c + k * ax * ax,
		k * ax * ay,
		-s * ay,
		0,
		k * ax * ay,
		c + k * ay * ay,
		s * ax,
		0,
		s * ay,
		-s * ax,
		c,
		0,
		0,
		0,
		0,
		1,
	]
		.map(r)
		.join(", ")})`;
}

/**
 * World units above the ground over which an airborne body's lean fades out, so leaving
 * the ground (or touching down) eases instead of snapping level.
 */
export const AIR_LEAN_FADE = 8;

/**
 * How much of the ground's lean a body takes, 0 … 1: all of it on the ground, none once
 * it is `AIR_LEAN_FADE` above the ground in the air (jumping, falling, hovering), so the
 * terrain it flies over doesn't tip it. The shadow, lying on the ground, always leans. Pure.
 */
export function bodyLeanFactor(altitude: number, airborne: boolean): number {
	if (!airborne || !(altitude > 0)) return 1;
	return Math.max(0, 1 - altitude / AIR_LEAN_FADE);
}

/**
 * The tilt a renderer adds on top of the spot's ground lean (see `CharacterRenderProps.pitch`):
 * the body's `attitude` against level, less the share `k` of the ground's own lean
 * (`ground`) that the spot already carries (`bodyLeanFactor`). Level with air tilt off
 * (`attitude` `null`). Pure.
 */
export function residualTilt(attitude: Attitude | null, ground: Attitude, k: number): Attitude {
	if (!attitude) return LEVEL;
	return {
		pitch: wrapDeg(attitude.pitch - k * ground.pitch),
		roll: wrapDeg(attitude.roll - k * ground.roll),
	};
}

function Spot({
	shadow = false,
	x,
	y,
	lift,
	tilt,
	renderer,
	props,
}: {
	/** A shadow spot (marked `data-character-shadow` instead of `data-character-id`). */
	shadow?: boolean;
	x: number;
	y: number;
	/** Screen px the spot stands above the board (height × zoom). Only visible under a
	 *  3D view (Mode 7); the flat board ignores the z offset. */
	lift: number;
	/** Lean with the ground (see {@link slopeTiltTransform}), or `null` = level. */
	tilt: string | null;
	renderer: CharacterRenderer;
	props: CharacterRenderProps;
}) {
	return (
		<div
			data-character-id={shadow ? undefined : props.id}
			data-character-shadow={shadow ? props.id : undefined}
			style={{
				position: "absolute",
				left: x,
				top: y,
				width: 0,
				height: 0,
				pointerEvents: "none",
				transform: lift > 0 ? `translateZ(${lift}px)` : undefined,
				// Keep the 3D context down to the renderer's content, so under a 3D view
				// (Mode 7) a renderer can stand its sprite up out of the ground (e.g.
				// `rotateX(-pitch)` with the pitch from `view3dService`) instead of having it
				// flattened onto the spot's plane. The flat board is unaffected.
				transformStyle: "preserve-3d",
			}}
		>
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					// Centred on the spot, then leaned about it (the box's corner is the spot).
					transform: tilt ? `${tilt} translate(-50%, -50%)` : "translate(-50%, -50%)",
					transformOrigin: tilt ? "0 0" : undefined,
					transformStyle: "preserve-3d",
				}}
			>
				{renderer(props)}
			</div>
		</div>
	);
}

export function CharacterLayer({
	store,
	viewport,
	heightAt,
	view3d = NO_VIEW3D,
}: {
	store: CharacterStore;
	viewport: Viewport;
	heightAt?: HeightAt;
	/** The 3D view: characters lean with the slope only while it is (partly) 3D. */
	view3d?: CharacterView3d;
}) {
	const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
	const amount = useSyncExternalStore(view3d.subscribe, view3d.amount, view3d.amount);
	const renderer = store.getRenderer();
	if (!renderer) return null; // headless: no look supplied → draw nothing
	const shadowRenderer = store.getShadowRenderer();

	const rot = viewportRotation(viewport);
	const size = characterSizePx(state.size, viewport.zoom);
	// Lean on screen: the world gradient turned with the camera (zoom scales the ground
	// and the height alike, so it stays a rise per px), scaled by the tuning and the 3D
	// transition (a lean on the flat board would only squash the sprite).
	const lean = Math.max(0, Math.min(1, state.motion.slopeTilt)) * Math.max(0, Math.min(1, amount));
	const cosR = Math.cos((rot * Math.PI) / 180);
	const sinR = Math.sin((rot * Math.PI) / 180);
	// `k` scales the lean further (an airborne body's, see `bodyLeanFactor`).
	const tiltAt = (x: number, y: number, k = 1): string | null => {
		const l = lean * k;
		if (!(l > 0) || !heightAt) return null;
		const g = groundSlope(heightAt, x, y);
		return slopeTiltTransform((g.x * cosR - g.y * sinR) * l, (g.x * sinR + g.y * cosR) * l);
	};
	const bodies: {
		at: { x: number; y: number };
		/** The ground's lean (for the shadow). */
		tilt: string | null;
		/** The body's lean: the ground's, faded out in the air. */
		bodyTilt: string | null;
		props: CharacterRenderProps;
	}[] = [];
	const leanOf = (x: number, y: number, altitude: number, airborne: boolean) => {
		const tilt = tiltAt(x, y);
		const k = bodyLeanFactor(altitude, airborne);
		return { tilt, bodyTilt: k >= 1 ? tilt : tiltAt(x, y, k) };
	};
	// The air tilt left for the renderer (see `residualTilt`).
	const tiltOf = (
		attitude: Attitude | null,
		x: number,
		y: number,
		heading: number,
		altitude: number,
		airborne: boolean,
	): Attitude => {
		if (!attitude) return LEVEL;
		const ground = heightAt ? groundAttitude(groundSlope(heightAt, x, y), heading) : LEVEL;
		return residualTilt(attitude, ground, bodyLeanFactor(altitude, airborne));
	};
	for (const r of state.remotes.values()) {
		const elevation = heightAt?.(r.x, r.y) ?? 0;
		const z = Math.max(elevation, r.z ?? elevation);
		bodies.push({
			at: worldToScreen(r.x, r.y, viewport),
			...leanOf(r.x, r.y, z - elevation, r.airborne),
			props: {
				id: r.id,
				isSelf: false,
				heading: r.heading,
				screenHeading: wrapDeg(r.heading + rot),
				moving: r.moving,
				controlScheme: r.controlScheme,
				speed: r.speed,
				steering: r.steering,
				slip: r.slip,
				drifting: r.drifting,
				...tiltOf(r.attitude, r.x, r.y, r.heading, z - elevation, r.airborne),
				zoom: viewport.zoom,
				size,
				appearance: r.appearance,
				name: r.name,
				elevation,
				z,
				altitude: z - elevation,
				airborne: r.airborne,
				verticalSpeed: r.vz,
				hovering: r.hovering,
				hoverGauge: r.hoverGauge,
			},
		});
	}
	if (state.enabled && state.spawned) {
		const { pose } = state;
		const elevation = heightAt?.(pose.x, pose.y) ?? 0;
		// Before the first vertical step a fresh spawn's `z` may still be below the ground.
		const z = Math.max(elevation, pose.z);
		// Self last → drawn on top of the others.
		bodies.push({
			at: worldToScreen(pose.x, pose.y, viewport),
			...leanOf(pose.x, pose.y, z - elevation, pose.airborne),
			props: {
				id: "self",
				isSelf: true,
				heading: pose.heading,
				screenHeading: wrapDeg(pose.heading + rot),
				moving: pose.moving,
				controlScheme: state.controlScheme,
				speed: pose.speed,
				steering: pose.steering,
				slip: pose.slip,
				drifting: pose.drift !== 0,
				...tiltOf(
					effectiveAirTilt(state) ? { pitch: pose.pitch, roll: pose.roll } : null,
					pose.x,
					pose.y,
					pose.heading,
					z - elevation,
					pose.airborne,
				),
				zoom: viewport.zoom,
				size,
				appearance: state.appearance,
				name: state.name,
				elevation,
				z,
				altitude: z - elevation,
				airborne: pose.airborne,
				verticalSpeed: pose.vz,
				hovering: pose.hovering,
				hoverGauge: hoverGaugeOf(state),
			},
		});
	}
	if (bodies.length === 0) return null;

	const key = (props: CharacterRenderProps) => (props.isSelf ? "self" : `remote-${props.id}`);
	// Shadows first, so every body draws over every shadow.
	const shadowSpots = shadowRenderer
		? bodies.map(({ at, tilt, props }) => (
				<Spot
					key={`shadow-${key(props)}`}
					shadow
					x={at.x}
					y={at.y}
					lift={props.elevation * viewport.zoom + SHADOW_LIFT_PX}
					tilt={tilt}
					renderer={shadowRenderer}
					props={props}
				/>
			))
		: [];
	const bodySpots = bodies.map(({ at, bodyTilt, props }) => (
		<Spot
			key={key(props)}
			x={at.x}
			y={at.y}
			lift={props.z * viewport.zoom}
			tilt={bodyTilt}
			renderer={renderer}
			props={props}
		/>
	));
	return (
		// preserve-3d: under a 3D view (Mode 7) a character on raised ground stands on it.
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				transformStyle: "preserve-3d",
			}}
		>
			{shadowSpots}
			{bodySpots}
		</div>
	);
}
