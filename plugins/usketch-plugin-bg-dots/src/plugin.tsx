import type { LayerRenderContext, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { useId, useSyncExternalStore } from "react";

const DOT_SPACING = 20;
const DOT_RADIUS = 1;
const DOT_COLOR = "#c0c0c0";
const DOT_OPACITY = 0.6;

// ── Shared visibility state ──

let visible = false;
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

function DotsBackground({ viewport }: { viewport: LayerRenderContext["viewport"] }) {
	const show = useSyncExternalStore(subscribe, getVisible);
	const patternId = useId();
	if (!show) return null;

	const size = DOT_SPACING * viewport.zoom;
	const offsetX = viewport.x % size;
	const offsetY = viewport.y % size;
	const r = DOT_RADIUS * viewport.zoom;

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
						<circle cx={size / 2} cy={size / 2} r={r} fill={DOT_COLOR} opacity={DOT_OPACITY} />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill={`url(#${patternId})`} />
			</svg>
		</div>
	);
}

// ── Plugin ──

export const dotsBgPlugin: UsketchPlugin = {
	id: "usketch-plugin-bg-dots",
	name: "Dots Background",

	setup(ctx: PluginContext) {
		// Reset to default hidden state
		visible = false;

		ctx.layers.register({
			id: "bg-dots",
			order: 10,
			fixed: true,
			render: (renderCtx) => <DotsBackground viewport={renderCtx.viewport} />,
		});

		const off = ctx.events.on<{ type: string }>("bg:set", ({ type }) => {
			setVisible(type === "dots");
		});

		(this as unknown as { _cleanup: () => void })._cleanup = () => {
			off();
			ctx.layers.unregister("bg-dots");
		};
	},

	teardown() {
		(this as unknown as { _cleanup?: () => void })._cleanup?.();
	},
};
