import type { LayerRenderContext, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useId, useSyncExternalStore } from "react";

const GRID_SIZE = 20;
const GRID_COLOR = "#e0e0e0";
const GRID_OPACITY = 0.5;

// ── Shared visibility + overscan state ──

let visible = true;
// How far BEYOND the viewport box (in CSS px, all sides) to render the grid. Normally
// 0 (grid fills the viewport). A consumer that reveals off-screen area — e.g. the Mode
// 7 tilt, which shows content past the box — drives this via the `bg-grid:set-overscan`
// event so the grid extends under that far content instead of stopping at the box edge.
let overscan = 0;
const listeners: Set<() => void> = new Set();

function notify() {
	for (const fn of listeners) fn();
}

function setVisible(v: boolean) {
	visible = v;
	notify();
}

function setOverscan(px: number) {
	const next = Number.isFinite(px) && px > 0 ? Math.ceil(px) : 0;
	if (next === overscan) return;
	overscan = next;
	notify();
}

function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

function getVisible(): boolean {
	return visible;
}

function getOverscan(): number {
	return overscan;
}

// ── React component ──

function GridBackground({ viewport }: { viewport: LayerRenderContext["viewport"] }) {
	const show = useSyncExternalStore(subscribe, getVisible);
	const pad = useSyncExternalStore(subscribe, getOverscan);
	const patternId = useId();
	if (!show) return null;

	const size = GRID_SIZE * viewport.zoom;
	// The grid box is inset by `-pad` on every side (extends past the viewport). Its
	// user-space origin therefore sits at box(-pad,-pad), so a world-0 line that is at
	// box `viewport.x` is at grid-space `viewport.x + pad`; keep the pattern phase on
	// world multiples by shifting the offset accordingly (mod size). `pad = 0` → current.
	const offsetX = (viewport.x + pad) % size;
	const offsetY = (viewport.y + pad) % size;

	return (
		<div style={{ position: "absolute", inset: -pad, pointerEvents: "none" }}>
			<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
				<defs>
					<pattern
						id={patternId}
						x={offsetX}
						y={offsetY}
						width={size}
						height={size}
						patternUnits="userSpaceOnUse"
					>
						<path
							d={`M ${size} 0 L 0 0 0 ${size}`}
							fill="none"
							stroke={GRID_COLOR}
							strokeWidth={1}
							opacity={GRID_OPACITY}
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill={`url(#${patternId})`} />
			</svg>
		</div>
	);
}

// ── Plugin ──

export function createGridBgPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-bg-grid",
		name: "Grid Background",

		setup(ctx: PluginContext) {
			// Reset to defaults
			visible = true;
			overscan = 0;

			ctx.layers.register({
				id: "bg-grid",
				order: 10,
				fixed: true,
				render: (renderCtx) => <GridBackground viewport={renderCtx.viewport} />,
			});

			const off = ctx.events.on<{ type: string }>("bg:set", ({ type }) => {
				setVisible(type === "grid");
			});

			// Let a consumer (e.g. the Mode 7 tilt) extend the grid past the viewport so
			// it stays under off-screen content instead of stopping at the box edge.
			const offOverscan = ctx.events.on<{ px: number }>("bg-grid:set-overscan", ({ px }) => {
				setOverscan(px);
			});

			// ── 背景切替を Action として公開（grid/dots プラグイン共通の bg:set を emit） ──
			const offAction = ctx.actions.register({
				id: "bg:set",
				label: "Background",
				group: "Background",
				params: [
					{
						name: "type",
						type: "enum",
						default: "grid",
						options: [
							{ value: "grid", label: "Grid" },
							{ value: "dots", label: "Dots" },
							{ value: "none", label: "None" },
						],
					},
				],
				run: ({ type }) => ctx.events.emit("bg:set", { type }),
			});

			return () => {
				off();
				offOverscan();
				offAction();
				ctx.layers.unregister("bg-grid");
			};
		},
	};
}
