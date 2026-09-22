// The three fixed, NON-tilted overlay layers the Mode 7 view adds while active:
//   - Sky:     a backdrop gradient painted behind the tilted ground plane.
//   - Fog:     an atmospheric haze in front, densest at the horizon.
//   - Capture: a transparent top layer (below the HUD) that intercepts board
//              pointer/wheel input — suppressing broken edits under the 3D tilt and
//              driving the camera (drag = move over the ground, wheel = zoom).
// All three read the shared store via useSyncExternalStore and render nothing when
// the view is inactive. They are registered ONCE and self-gate on `active`.
import { type PointerEvent as ReactPointerEvent, useRef, useSyncExternalStore } from "react";
import type { Mode7Store } from "./mode7-store.js";
import { fogBackground, fogOpacity, skyBackground } from "./mode7-transform.js";

function useMode7(store: Mode7Store) {
	return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/** Center of a pointer/wheel event relative to the layer box (== canvas container,
 *  since the layer is inset:0 and untilted) — the space the store's viewport uses. */
function localCenter(e: { clientX: number; clientY: number; currentTarget: Element }): {
	x: number;
	y: number;
} {
	const r = e.currentTarget.getBoundingClientRect();
	return { x: e.clientX - r.left, y: e.clientY - r.top };
}

export function SkyLayer({ store }: { store: Mode7Store }) {
	const { active, camera, look } = useMode7(store);
	if (!active) return null;
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				background: skyBackground(look.sky, camera.horizon),
			}}
		/>
	);
}

export function FogLayer({ store }: { store: Mode7Store }) {
	const { active, camera, look } = useMode7(store);
	if (!active || fogOpacity(look.fog) <= 0) return null;
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				background: fogBackground(look.fogColor, look.fog, camera.horizon),
			}}
		/>
	);
}

export interface CaptureHandlers {
	/** Drag delta in screen px (content-follows-cursor). */
	onPan(dx: number, dy: number): void;
	/** Wheel zoom: raw deltaY and the zoom center in container-local px. */
	onZoom(deltaY: number, center: { x: number; y: number }): void;
}

export function CaptureLayer({
	store,
	handlers,
}: {
	store: Mode7Store;
	handlers: CaptureHandlers;
}) {
	const { active } = useMode7(store);
	const drag = useRef<{ x: number; y: number } | null>(null);
	if (!active) return null;

	const end = (e: ReactPointerEvent) => {
		e.stopPropagation();
		drag.current = null;
	};

	return (
		<div
			// Full-viewport capture surface. `stopPropagation` keeps the container's
			// tool handlers (draw/select) from firing — editing is suspended in this view.
			style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}
			onPointerDown={(e) => {
				e.stopPropagation();
				e.currentTarget.setPointerCapture?.(e.pointerId);
				drag.current = { x: e.clientX, y: e.clientY };
			}}
			onPointerMove={(e) => {
				if (!drag.current) return;
				e.stopPropagation();
				const dx = e.clientX - drag.current.x;
				const dy = e.clientY - drag.current.y;
				drag.current = { x: e.clientX, y: e.clientY };
				handlers.onPan(dx, dy);
			}}
			onPointerUp={end}
			onPointerCancel={end}
			onWheel={(e) => {
				e.stopPropagation();
				handlers.onZoom(e.deltaY, localCenter(e));
			}}
		/>
	);
}
