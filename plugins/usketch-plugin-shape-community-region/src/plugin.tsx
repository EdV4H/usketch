import {
	type BoundingBox,
	generateId,
	type PluginContext,
	type ResizeHandle,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";

const CARD_WIDTH = 200;
const CARD_HEIGHT = 160;

export interface CommunityRegionPluginOptions {
	onRegionClick?: (slug: string) => void;
}

function renderContent(data: ShapeData) {
	const displayName = (data.displayName as string) || "Region";
	const themeColor = (data.themeColor as string) || "#6366f1";
	const icon = (data.icon as string) || "🏠";
	const onlineCount = (data.onlineCount as number) || 0;
	const w = data.width;
	const h = data.height;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				pointerEvents: "auto",
				userSelect: "none",
				cursor: "pointer",
			}}
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					borderRadius: 16,
					background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
					boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: h * 0.04,
					overflow: "hidden",
					transition: "box-shadow 0.2s, transform 0.2s",
				}}
			>
				{/* Icon */}
				<div
					style={{
						fontSize: Math.max(24, Math.min(48, w * 0.22)),
						lineHeight: 1,
						filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
					}}
				>
					{icon}
				</div>

				{/* Region name */}
				<div
					style={{
						color: "#fff",
						fontSize: Math.max(12, Math.min(20, w * 0.09)),
						fontWeight: 700,
						fontFamily: "system-ui, sans-serif",
						textAlign: "center",
						textShadow: "0 1px 3px rgba(0,0,0,0.3)",
						padding: "0 8px",
						lineHeight: 1.2,
						maxWidth: "100%",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{displayName}
				</div>

				{/* Online count badge */}
				{onlineCount > 0 && (
					<div
						style={{
							background: "rgba(255,255,255,0.25)",
							color: "#fff",
							fontSize: Math.max(10, Math.min(13, w * 0.06)),
							fontWeight: 600,
							fontFamily: "system-ui, sans-serif",
							padding: "2px 10px",
							borderRadius: 12,
							display: "flex",
							alignItems: "center",
							gap: 4,
						}}
					>
						<span
							style={{
								width: 6,
								height: 6,
								borderRadius: "50%",
								background: "#4ade80",
								display: "inline-block",
							}}
						/>
						{onlineCount}
					</div>
				)}
			</div>
		</div>
	);
}

export function createCommunityRegionPlugin(options?: CommunityRegionPluginOptions): UsketchPlugin {
	const cleanups: (() => void)[] = [];

	return {
		id: "usketch-plugin-shape-community-region",
		name: "Community Region",

		setup(ctx: PluginContext) {
			ctx.shapes.register("community-region", {
				renderTarget: "html",

				createDefault: (params?: { id: string; x: number; y: number }) => ({
					id: params?.id ?? generateId(),
					type: "community-region",
					x: params?.x ?? 0,
					y: params?.y ?? 0,
					width: CARD_WIDTH,
					height: CARD_HEIGHT,
					style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
				}),

				render: (data) => renderContent(data),

				getBounds: (data): BoundingBox => ({
					x: data.x,
					y: data.y,
					width: data.width,
					height: data.height,
				}),

				hitTest: (data, point) => {
					return (
						point.x >= data.x &&
						point.x <= data.x + data.width &&
						point.y >= data.y &&
						point.y <= data.y + data.height
					);
				},

				// 読み取り専用 — リサイズ不可
				resize: (data: ShapeData, _handle: ResizeHandle, _delta: { x: number; y: number }) => data,
			});

			// selection 変更を監視して community-region クリックを検出
			if (options?.onRegionClick) {
				const onClick = options.onRegionClick;
				let prevSelection = new Set<string>();

				const unsub = ctx.store.subscribe(() => {
					const selection = ctx.store.getSelection();

					// 単一選択以外の場合は単に前回状態を更新して終了
					if (selection.size !== 1) {
						prevSelection = new Set(selection);
						return;
					}

					// 新しく選択されたシェイプがあるかチェック
					const [shapeId] = selection;
					if (prevSelection.has(shapeId)) {
						prevSelection = new Set(selection);
						return;
					}
					prevSelection = new Set(selection);

					const shape = ctx.store.getShapes().get(shapeId);
					if (shape?.type === "community-region" && shape.slug) {
						ctx.store.clearSelection();
						onClick(shape.slug as string);
					}
				});
				cleanups.push(unsub);
			}
		},

		teardown() {
			for (const fn of cleanups) fn();
			cleanups.length = 0;
		},
	};
}
