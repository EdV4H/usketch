// The brush cursor: the brush's circle (outer ring = radius, inner ring = where it acts at
// half strength) and the height under its centre, drawn while the elevation tool is in
// use. A world overlay, not a panel: it follows the pointer on the board.
import type { BoardStore, View3dApi } from "@edv4h/usketch-shared";
import { useEffect, useReducer } from "react";
import { type BrushSettings, halfWeightRadius } from "./elevation-brush.js";
import type { StrokePreview } from "./elevation-layer.js";
import { boardElevation, elevationSampler } from "./elevation-model.js";
import { type BrushCursor, ELEVATION_TOOL_ID } from "./elevation-tool.js";
import type { ReactiveStore } from "./reactive-store.js";

export const BRUSH_CURSOR_LAYER_ID = "usketch-elevation:brush-cursor";

const MODE_LABEL: Record<BrushSettings["mode"], string> = {
	raise: "盛る",
	lower: "削る",
	smooth: "ならす",
	flatten: "平らにする",
	terrace: "段にする",
};

export function BrushCursorLayer({
	store,
	brush,
	cursor,
	preview,
	view3d,
}: {
	store: BoardStore;
	brush: ReactiveStore<BrushSettings>;
	cursor: ReactiveStore<BrushCursor>;
	preview: ReactiveStore<StrokePreview>;
	/** The board's 3D view, if any: the flat cursor is hidden while it is up (no editing there). */
	view3d?: () => View3dApi | undefined;
}) {
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(() => {
		const offs = [
			brush.subscribe(rerender),
			cursor.subscribe(rerender),
			preview.subscribe(rerender),
			store.subscribe(rerender),
		];
		const v = view3d?.();
		if (v) offs.push(v.subscribe(rerender));
		return () => {
			for (const off of offs) off();
		};
	}, [store, brush, cursor, preview, view3d]);

	const c = cursor.get();
	if (!c.visible || store.getActiveToolId() !== ELEVATION_TOOL_ID) return null;
	if ((view3d?.()?.amount() ?? 0) > 0) return null;
	const b = brush.get();
	const vp = store.getViewport();
	const sx = c.x * vp.zoom + vp.x;
	const sy = c.y * vp.zoom + vp.y;
	const r = b.radius * vp.zoom;
	const inner = r * halfWeightRadius(b.falloff);
	const model = preview.get().model ?? boardElevation(store);
	const h = model ? elevationSampler(model).heightAt(c.x, c.y) : 0;
	const label = `${MODE_LABEL[b.mode]} ${Math.round(h)}`;
	return (
		<svg
			data-usketch-elevation-cursor=""
			width="100%"
			height="100%"
			style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
		>
			<circle
				cx={sx}
				cy={sy}
				r={r}
				fill="none"
				stroke="#000"
				strokeOpacity={0.35}
				strokeWidth={3}
			/>
			<circle cx={sx} cy={sy} r={r} fill="none" stroke="#fff" strokeWidth={1.5} />
			{inner < r ? (
				<circle
					cx={sx}
					cy={sy}
					r={inner}
					fill="none"
					stroke="#fff"
					strokeWidth={1}
					strokeDasharray="4 4"
				/>
			) : null}
			<text
				x={sx}
				y={sy - r - 8}
				textAnchor="middle"
				fontSize={12}
				fontFamily="system-ui, sans-serif"
				fill="#fff"
				stroke="#000"
				strokeWidth={3}
				strokeOpacity={0.5}
				paintOrder="stroke"
			>
				{label}
			</text>
		</svg>
	);
}
