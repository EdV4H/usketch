// The one fixed (screen-space) layer that places every character — self and remote
// — at `worldToScreen(position)`. It draws NOTHING itself: each spot is a zero-size,
// pointer-transparent wrapper whose content is the host's `renderCharacter`. One
// screen-space layer keeps self/remote consistent (same size under zoom, same
// `screenHeading` math under camera rotation).
import { type Viewport, viewportRotation, worldToScreen, wrapDeg } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import type { CharacterStore } from "./character-store.js";
import type { CharacterRenderer, CharacterRenderProps } from "./character-types.js";

function Spot({
	x,
	y,
	renderer,
	props,
}: {
	x: number;
	y: number;
	renderer: CharacterRenderer;
	props: CharacterRenderProps;
}) {
	return (
		<div
			data-character-id={props.id}
			style={{ position: "absolute", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}
		>
			<div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%, -50%)" }}>
				{renderer(props)}
			</div>
		</div>
	);
}

export function CharacterLayer({ store, viewport }: { store: CharacterStore; viewport: Viewport }) {
	const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
	const renderer = store.getRenderer();
	if (!renderer) return null; // headless: no look supplied → draw nothing

	const rot = viewportRotation(viewport);
	const spots = [];
	for (const r of state.remotes.values()) {
		const p = worldToScreen(r.x, r.y, viewport);
		spots.push(
			<Spot
				key={`remote-${r.id}`}
				x={p.x}
				y={p.y}
				renderer={renderer}
				props={{
					id: r.id,
					isSelf: false,
					heading: r.heading,
					screenHeading: wrapDeg(r.heading + rot),
					moving: r.moving,
					speed: r.speed,
					zoom: viewport.zoom,
					appearance: r.appearance,
					name: r.name,
				}}
			/>,
		);
	}
	if (state.enabled && state.spawned) {
		const { pose } = state;
		const p = worldToScreen(pose.x, pose.y, viewport);
		// Self last → drawn on top of the others.
		spots.push(
			<Spot
				key="self"
				x={p.x}
				y={p.y}
				renderer={renderer}
				props={{
					id: "self",
					isSelf: true,
					heading: pose.heading,
					screenHeading: wrapDeg(pose.heading + rot),
					moving: pose.moving,
					speed: pose.speed,
					zoom: viewport.zoom,
					appearance: state.appearance,
					name: state.name,
				}}
			/>,
		);
	}
	if (spots.length === 0) return null;
	return <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{spots}</div>;
}
