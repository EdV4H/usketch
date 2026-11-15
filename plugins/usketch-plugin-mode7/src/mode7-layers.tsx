// The three fixed, NON-tilted overlay layers the Mode 7 view adds while active:
//   - Sky:     a backdrop gradient painted behind the tilted ground plane.
//   - Fog:     an atmospheric haze in front, densest at the horizon.
//   - Capture: a transparent top layer (below the HUD) that intercepts board
//              pointer/wheel input — suppressing broken edits under the 3D tilt and
//              driving the camera (drag = move over the ground, wheel = zoom).
// All three read the shared store via useSyncExternalStore and render nothing when
// the view is inactive. They are registered ONCE and self-gate on `active`.
import type { PluginContext } from "@edv4h/usketch-shared";
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
	const { active, amount, camera, look } = useMode7(store);
	if (!active) return null;
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				background: skyBackground(look.sky, camera.horizon),
				// Fades with the enter/exit transition (1 when settled).
				opacity: amount,
			}}
		/>
	);
}

/**
 * The "capture frame": a fixed, world-anchored rectangle marking the region the 3D
 * ground plane covered at the last switch-on. Shown only in FLAT mode (so it never
 * fights the tilt) when the HUD toggle is on — it lets the user see which shapes fall
 * inside the captured region vs. outside (outside = won't appear in the initial 3D
 * view). It is a NON-tilted, non-fixed layer, so the viewport transform anchors it to
 * world space; `zoom` (from the layer render ctx) keeps the border ~constant on screen.
 */
export function CaptureFrameLayer({ store, zoom }: { store: Mode7Store; zoom: number }) {
	const { active, showCaptureFrame, captureRect } = useMode7(store);
	if (active || !showCaptureFrame || !captureRect) return null;
	const border = 2 / (zoom || 1); // world px → ~2 screen px under the viewport scale
	return (
		<div
			style={{
				position: "absolute",
				left: captureRect.x,
				top: captureRect.y,
				width: captureRect.width,
				height: captureRect.height,
				boxSizing: "border-box",
				border: `${border}px dashed rgba(80, 140, 255, 0.9)`,
				background: "rgba(80, 140, 255, 0.06)",
				pointerEvents: "none",
			}}
		/>
	);
}

export function FogLayer({ store }: { store: Mode7Store }) {
	const { active, amount, camera, look } = useMode7(store);
	if (!active || fogOpacity(look.fog) <= 0) return null;
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				background: fogBackground(look.fogColor, look.fog, camera.horizon),
				opacity: amount,
			}}
		/>
	);
}

/**
 * A live checklist (contributed as a HUD panel) of the board's layers, letting the
 * user pick which ones render in 3D — e.g. tick the Shape layer(s). Reads the layer
 * list from `ctx.layers.getLayers()` at render (re-rendered on any store change) and
 * excludes the control surfaces that must never tilt (HUD + the plugin's overlays).
 */
export function LayerPicker({
	ctx,
	store,
	excluded,
}: {
	ctx: PluginContext;
	store: Mode7Store;
	excluded: readonly string[];
}) {
	const state = useMode7(store);
	const selected = new Set(state.tiltLayers);
	const excludedSet = new Set(excluded);
	const layers = ctx.layers
		.getLayers()
		.filter((l) => !excludedSet.has(l.id))
		.slice()
		.sort((a, b) => a.order - b.order);

	return (
		<div
			style={{ display: "flex", flexDirection: "column", gap: 4, opacity: state.active ? 1 : 0.55 }}
		>
			<div style={{ fontSize: 11, color: "var(--fg-tertiary, #888)" }}>3D にするレイヤー</div>
			{layers.length === 0 ? (
				<div style={{ fontSize: 11, color: "var(--fg-tertiary, #888)" }}>レイヤーがありません</div>
			) : (
				layers.map((l) => (
					<label
						key={l.id}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							fontSize: 12,
							cursor: "pointer",
						}}
					>
						<input
							type="checkbox"
							checked={selected.has(l.id)}
							onChange={() => store.toggleTiltLayer(l.id)}
						/>
						<span>{l.id}</span>
					</label>
				))
			)}
		</div>
	);
}

export interface CaptureHandlers {
	/** Drag delta in screen px (content-follows-cursor). */
	onPan(dx: number, dy: number): void;
	/** Wheel zoom: raw deltaY and the zoom center in container-local px. */
	onZoom(deltaY: number, center: { x: number; y: number }): void;
	/**
	 * Whether a press at a container-local point is for the board's tools (it picks a
	 * shape the select tool can take): it then goes on to the canvas instead of the camera.
	 */
	editsAt?(point: { x: number; y: number }): boolean;
	/** A click on the bare ground (no drag): clears the selection. */
	onGroundTap?(): void;
	/** A double click on a shape: back to flat, where it can be edited. */
	onShapeDoubleClick?(point: { x: number; y: number }): void;
}

/** How far (px) a press may move and still be a click. */
const TAP_SLOP = 4;

export function CaptureLayer({
	store,
	handlers,
}: {
	store: Mode7Store;
	handlers: CaptureHandlers;
}) {
	const { active } = useMode7(store);
	// A camera drag (its last point, and whether it is still a click), or a press handed
	// on to the canvas (its pointer), so its moves and release go there too.
	const drag = useRef<{ x: number; y: number; sx: number; sy: number; tap: boolean } | null>(null);
	const editing = useRef<number | null>(null);
	if (!active) return null;

	const end = (e: ReactPointerEvent) => {
		if (editing.current === e.pointerId) {
			editing.current = null;
			return;
		}
		e.stopPropagation();
		const d = drag.current;
		drag.current = null;
		if (d?.tap && e.type === "pointerup") handlers.onGroundTap?.();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the 3D view's pointer surface over the canvas
		<div
			// Full-viewport capture surface. A press on a shape the select tool can take goes
			// on to the canvas (select and move it in 3D); anything else drives the camera and
			// is kept from the tools (`stopPropagation`).
			style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}
			onPointerDown={(e) => {
				if (e.button === 0 && handlers.editsAt?.(localCenter(e))) {
					editing.current = e.pointerId;
					return;
				}
				e.stopPropagation();
				e.currentTarget.setPointerCapture?.(e.pointerId);
				drag.current = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, tap: true };
			}}
			onPointerMove={(e) => {
				const d = drag.current;
				if (!d) return;
				e.stopPropagation();
				const dx = e.clientX - d.x;
				const dy = e.clientY - d.y;
				d.x = e.clientX;
				d.y = e.clientY;
				if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP) d.tap = false;
				handlers.onPan(dx, dy);
			}}
			onPointerUp={end}
			onPointerCancel={end}
			onDoubleClick={(e) => {
				e.stopPropagation();
				handlers.onShapeDoubleClick?.(localCenter(e));
			}}
			onWheel={(e) => {
				e.stopPropagation();
				handlers.onZoom(e.deltaY, localCenter(e));
			}}
		/>
	);
}
