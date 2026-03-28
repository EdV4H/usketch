import type { SidePanelOpenEvent } from "@edv4h/usketch-plugin-side-panel";
import type {
	BoardStore,
	EventBus,
	LayerRenderContext,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { worldToScreen } from "@edv4h/usketch-shared";
import { useEffect, useState } from "react";
import type { CommentThread } from "./types.js";

interface CommentBadgeLayerProps {
	ctx: LayerRenderContext;
	store: BoardStore;
	shapes: ShapeRegistry;
	events: EventBus;
}

export function CommentBadgeLayer({ ctx, store, shapes, events }: CommentBadgeLayerProps) {
	const [threads, setThreads] = useState<CommentThread[]>([]);

	// コメントスレッドの更新をリッスン
	useEffect(() => {
		const unsubs: (() => void)[] = [];

		unsubs.push(
			events.on<CommentThread[]>("comments:threads-loaded", (loaded) => {
				setThreads(loaded);
			}),
		);

		unsubs.push(
			events.on<CommentThread>("comments:badge-update", (thread) => {
				setThreads((prev) => [thread, ...prev]);
			}),
		);

		return () => {
			for (const u of unsubs) u();
		};
	}, [events]);

	// シェイプごとにバッジ集約
	const badgesByShape = new Map<string, number>();
	for (const t of threads) {
		if (t.resolved) continue;
		badgesByShape.set(
			t.anchorShapeId,
			(badgesByShape.get(t.anchorShapeId) ?? 0) + t.messages.length,
		);
	}

	const badges: { shapeId: string; x: number; y: number; count: number }[] = [];

	for (const [shapeId, count] of badgesByShape) {
		const shape = store.getShape(shapeId);
		if (!shape) continue;
		const def = shapes.get(shape.type);
		const bounds = def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

		// バッジ位置: シェイプの右上
		badges.push({
			shapeId,
			x: bounds.x + bounds.width,
			y: bounds.y,
			count,
		});
	}

	if (badges.length === 0) return null;

	const { viewport } = ctx;

	return (
		<>
			{badges.map((badge) => {
				const screen = worldToScreen(badge.x, badge.y, viewport);

				return (
					<button
						key={badge.shapeId}
						type="button"
						onPointerDown={(e) => e.stopPropagation()}
						onPointerUp={(e) => e.stopPropagation()}
						onClick={(e) => {
							e.stopPropagation();
							events.emit<SidePanelOpenEvent>("side-panel:open", { tabId: "comments" });
						}}
						style={{
							position: "absolute",
							left: screen.x - 10,
							top: screen.y - 10,
							width: 20,
							height: 20,
							borderRadius: "50%",
							background: "#f59e0b",
							color: "#fff",
							border: "2px solid #fff",
							fontSize: 10,
							fontWeight: 700,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
							fontFamily: "system-ui, sans-serif",
							padding: 0,
							lineHeight: 1,
						}}
					>
						{badge.count}
					</button>
				);
			})}
		</>
	);
}
