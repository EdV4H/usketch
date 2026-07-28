// Small palette shown while the range-erase tool is active: pick what a dragged
// range clears (terrain / base ownership — multi-select).
import type { BoardStore } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import { MAP_TOOL_ID } from "../map-tool-id.js";
import { rangeEraseStore, useRangeEraseTargets } from "../range-erase-state.js";
import { RANGE_ERASE_TOOL_ID } from "../range-erase-tool.js";

const CARD = "#FFFFFF";
const STROKE = "#141414";

function useActiveTool(store: BoardStore): string {
	const [id, setId] = useState(store.getActiveToolId());
	useEffect(() => store.subscribe(() => setId(store.getActiveToolId())), [store]);
	return id;
}

function toggle(active: boolean): React.CSSProperties {
	return {
		border: `2px solid ${STROKE}`,
		borderRadius: 10,
		background: active ? "#EF5350" : CARD,
		color: active ? "#fff" : "#1c1c1c",
		padding: "5px 12px",
		font: "700 12px system-ui, sans-serif",
		cursor: "pointer",
		lineHeight: 1,
	};
}

export function RangeErasePalette({ store }: { store: BoardStore }) {
	const activeTool = useActiveTool(store);
	const targets = useRangeEraseTargets();
	if (activeTool !== RANGE_ERASE_TOOL_ID) return null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{/* Stop panel-originated events from bubbling to the canvas container,
			    which would otherwise fire the active tool (erasing tiles under the
			    panel). Only pointerdown + wheel are stopped — move/up are let through
			    so a drag STARTED on the canvas and released over the panel still
			    finishes on the canvas. Same intent as debug-hud's STOP_CANVAS_PROPAGATION. */}
			<div
				onPointerDown={(e) => e.stopPropagation()}
				onWheel={(e) => e.stopPropagation()}
				style={{
					position: "absolute",
					left: 14,
					top: "50%",
					transform: "translateY(-50%)",
					pointerEvents: "auto",
					background: "#FBF9F4",
					border: `2.6px dashed ${STROKE}`,
					borderRadius: 16,
					padding: 14,
					boxShadow: "0 6px 24px rgba(0,0,0,.14)",
				}}
			>
				<div style={{ font: "700 14px system-ui, sans-serif", marginBottom: 4 }}>🧽 範囲消去</div>
				<div style={{ font: "600 11px system-ui", color: "#8a8a88", marginBottom: 10 }}>
					消す対象を選択（ドラッグで範囲指定）
				</div>
				<div style={{ display: "flex", gap: 8 }}>
					<button
						type="button"
						aria-pressed={targets.terrain}
						onClick={() => rangeEraseStore.set({ terrain: !targets.terrain })}
						style={toggle(targets.terrain)}
					>
						地形
					</button>
					<button
						type="button"
						aria-pressed={targets.base}
						onClick={() => rangeEraseStore.set({ base: !targets.base })}
						style={toggle(targets.base)}
					>
						拠点
					</button>
				</div>
				<button
					type="button"
					onClick={() => store.setActiveToolId(MAP_TOOL_ID)}
					style={{ ...toggle(false), marginTop: 12 }}
				>
					← マップツールへ
				</button>
			</div>
		</div>
	);
}
