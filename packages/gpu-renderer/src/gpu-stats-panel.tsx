import type { EventBus } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { GpuRenderStats } from "./renderer.js";

/**
 * HUD panel showing GPU renderer status/counts. Contributed by the gpu-renderer
 * plugin via `ctx.hud.registerPanel`, so the Debug/Control HUD no longer needs a
 * hardcoded GPU section coupled to the `"gpu-renderer:stats"` event. Subscribes
 * to that event (emitted per GPU render); stays "Inactive" until the first emit.
 */
export function GpuStatsPanel({ events }: { events: EventBus }) {
	const [stats, setStats] = useState<GpuRenderStats | null>(null);
	useEffect(() => events.on<GpuRenderStats>("gpu-renderer:stats", setStats), [events]);

	if (!stats) {
		return <div style={{ color: "#888", fontSize: 10 }}>Inactive (DOM only)</div>;
	}
	return (
		<div style={{ fontSize: 10 }}>
			<div style={{ color: "#4ade80" }}>Active</div>
			<div>
				GPU: {stats.gpuShapeCount} (SDF: {stats.sdfCount}, Lines: {stats.polylineCount})
			</div>
		</div>
	);
}
