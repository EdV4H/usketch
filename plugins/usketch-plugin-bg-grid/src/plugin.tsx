import type { LayerRenderContext, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useId, useSyncExternalStore } from "react";

const GRID_SIZE = 20;
const GRID_COLOR = "#e0e0e0";
const GRID_OPACITY = 0.5;

// ── Shared visibility state ──

let visible = true;
const listeners: Set<() => void> = new Set();

function setVisible(v: boolean) {
	visible = v;
	for (const fn of listeners) fn();
}

function subscribe(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

function getVisible(): boolean {
	return visible;
}

// ── React component ──

function GridBackground({ viewport }: { viewport: LayerRenderContext["viewport"] }) {
	const show = useSyncExternalStore(subscribe, getVisible);
	const patternId = useId();
	if (!show) return null;

	const size = GRID_SIZE * viewport.zoom;
	const offsetX = viewport.x % size;
	const offsetY = viewport.y % size;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
			// Reset to default visible state
			visible = true;

			ctx.layers.register({
				id: "bg-grid",
				order: 10,
				fixed: true,
				render: (renderCtx) => <GridBackground viewport={renderCtx.viewport} />,
			});

			const off = ctx.events.on<{ type: string }>("bg:set", ({ type }) => {
				setVisible(type === "grid");
			});

			return () => {
				off();
				ctx.layers.unregister("bg-grid");
			};
		},
	};
}
