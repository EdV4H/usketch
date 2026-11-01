// The one fixed (screen-space) layer that places every character — self and remote
// — at `worldToScreen(position)`. It draws NOTHING itself: each spot is a zero-size,
// pointer-transparent wrapper whose content is the host's `renderCharacter`. One
// screen-space layer keeps self/remote consistent (same size under zoom, same
// `screenHeading` math under camera rotation). The optional `renderShadow` gets a spot
// of its own on the GROUND under each character, while the body stands at its feet
// height — under a 3D view (Mode 7) a jump lifts the body off its shadow.
import { type Viewport, viewportRotation, worldToScreen, wrapDeg } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import type { HeightAt } from "./character-physics.js";
import type { CharacterStore } from "./character-store.js";
import type { CharacterRenderer, CharacterRenderProps } from "./character-types.js";

/** Screen px a shadow floats above its ground, so it doesn't z-fight a raised terrain top. */
const SHADOW_LIFT_PX = 0.5;

function Spot({
	shadow = false,
	x,
	y,
	lift,
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
			}}
		>
			<div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)" }}>
				{renderer(props)}
			</div>
		</div>
	);
}

export function CharacterLayer({
	store,
	viewport,
	heightAt,
}: {
	store: CharacterStore;
	viewport: Viewport;
	heightAt?: HeightAt;
}) {
	const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
	const renderer = store.getRenderer();
	if (!renderer) return null; // headless: no look supplied → draw nothing
	const shadowRenderer = store.getShadowRenderer();

	const rot = viewportRotation(viewport);
	const bodies: { at: { x: number; y: number }; props: CharacterRenderProps }[] = [];
	for (const r of state.remotes.values()) {
		const elevation = heightAt?.(r.x, r.y) ?? 0;
		const z = Math.max(elevation, r.z ?? elevation);
		bodies.push({
			at: worldToScreen(r.x, r.y, viewport),
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
			},
		});
	}
	if (bodies.length === 0) return null;

	const key = (props: CharacterRenderProps) => (props.isSelf ? "self" : `remote-${props.id}`);
	// Shadows first, so every body draws over every shadow.
	const shadowSpots = shadowRenderer
		? bodies.map(({ at, props }) => (
				<Spot
					key={`shadow-${key(props)}`}
					shadow
					x={at.x}
					y={at.y}
					lift={props.elevation * viewport.zoom + SHADOW_LIFT_PX}
					renderer={shadowRenderer}
					props={props}
				/>
			))
		: [];
	const bodySpots = bodies.map(({ at, props }) => (
		<Spot
			key={key(props)}
			x={at.x}
			y={at.y}
			lift={props.z * viewport.zoom}
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
