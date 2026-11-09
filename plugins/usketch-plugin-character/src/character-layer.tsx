// The one fixed (screen-space) layer that places every character — self and remote
// — at `worldToScreen(position)`. It draws NOTHING itself: each spot is a zero-size,
// pointer-transparent wrapper whose content is the host's `renderCharacter`. One
// screen-space layer keeps self/remote consistent (same size under zoom, same
// `screenHeading` math under camera rotation). The optional `renderShadow` gets a spot
// of its own on the GROUND under each character, while the body stands at its feet
// height — under a 3D view (Mode 7) a jump lifts the body off its shadow.
import { type Viewport, viewportRotation, worldToScreen, wrapDeg } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { groundSlope, type HeightAt } from "./character-physics.js";
import { type CharacterStore, hoverGaugeOf } from "./character-store.js";
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
	// Lean on screen: the world gradient turned with the camera (zoom scales the ground
	// and the height alike, so it stays a rise per px), scaled by the tuning and the 3D
	// transition (a lean on the flat board would only squash the sprite).
	const lean = Math.max(0, Math.min(1, state.motion.slopeTilt)) * Math.max(0, Math.min(1, amount));
	const cosR = Math.cos((rot * Math.PI) / 180);
	const sinR = Math.sin((rot * Math.PI) / 180);
	const tiltAt = (x: number, y: number): string | null => {
		if (!(lean > 0) || !heightAt) return null;
		const g = groundSlope(heightAt, x, y);
		return slopeTiltTransform((g.x * cosR - g.y * sinR) * lean, (g.x * sinR + g.y * cosR) * lean);
	};
	const bodies: {
		at: { x: number; y: number };
		tilt: string | null;
		props: CharacterRenderProps;
	}[] = [];
	for (const r of state.remotes.values()) {
		const elevation = heightAt?.(r.x, r.y) ?? 0;
		const z = Math.max(elevation, r.z ?? elevation);
		bodies.push({
			at: worldToScreen(r.x, r.y, viewport),
			tilt: tiltAt(r.x, r.y),
			props: {
				id: r.id,
				isSelf: false,
				heading: r.heading,
				screenHeading: wrapDeg(r.heading + rot),
				moving: r.moving,
				speed: r.speed,
				steering: r.steering,
				slip: r.slip,
				drifting: r.drifting,
				zoom: viewport.zoom,
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
			tilt: tiltAt(pose.x, pose.y),
			props: {
				id: "self",
				isSelf: true,
				heading: pose.heading,
				screenHeading: wrapDeg(pose.heading + rot),
				moving: pose.moving,
				speed: pose.speed,
				steering: pose.steering,
				slip: pose.slip,
				drifting: pose.drift !== 0,
				zoom: viewport.zoom,
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
	const bodySpots = bodies.map(({ at, tilt, props }) => (
		<Spot
			key={key(props)}
			x={at.x}
			y={at.y}
			lift={props.z * viewport.zoom}
			tilt={tilt}
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
