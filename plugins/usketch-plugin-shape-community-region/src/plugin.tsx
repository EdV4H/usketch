import {
	type BoundingBox,
	generateId,
	type PluginContext,
	type ResizeHandle,
	type ShapeData,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import type { CommunityRegionShapeData } from "./types.js";

export type { CommunityRegionShapeData } from "./types.js";

const CARD_WIDTH = 200;
const CARD_HEIGHT = 180;

export interface CommunityRegionPluginOptions {
	onRegionClick?: (slug: string) => void;
}

/**
 * themeColor と背景 (bg-input) を混ぜた soft な tint を生成。
 * color-mix(in oklab) を使い、非対応ブラウザには CSS のフォールバック値で劣化表示。
 */
function softTint(color: string, pct: number): string {
	return `color-mix(in oklab, ${color} ${pct}%, var(--bg-input))`;
}

function softBorder(color: string, pct: number): string {
	return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

function RegionCard({ data: shape }: { data: ShapeData }) {
	const data = shape as CommunityRegionShapeData;
	const displayName = data.displayName || "Region";
	const themeColor = data.themeColor || "#6366f1";
	const icon = data.icon || "🏠";
	const onlineCount = data.onlineCount || 0;
	const memberCount = data.memberCount ?? onlineCount;
	const isActive = Boolean(data.active);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				position: "relative",
				pointerEvents: "auto",
				userSelect: "none",
				cursor: "pointer",
				borderRadius: 16,
				background: softTint(themeColor, 16),
				border: `1.5px solid ${softBorder(themeColor, 40)}`,
				padding: 16,
				overflow: "hidden",
				transition: "box-shadow 200ms, transform 200ms",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				boxSizing: "border-box",
			}}
		>
			{/* 大きな薄いグリフ（右上背面） */}
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					top: -8,
					right: -8,
					fontSize: 96,
					opacity: 0.12,
					color: themeColor,
					pointerEvents: "none",
					lineHeight: 1,
					filter: `drop-shadow(0 4px 12px ${softBorder(themeColor, 30)})`,
				}}
			>
				{icon}
			</div>

			<div style={{ position: "relative", zIndex: 1 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
					<div
						style={{
							width: 8,
							height: 8,
							borderRadius: 99,
							background: themeColor,
							boxShadow: `0 0 8px ${themeColor}`,
						}}
					/>
					{isActive && (
						<div
							style={{
								fontSize: 9,
								fontWeight: 700,
								color: themeColor,
								letterSpacing: 0.5,
							}}
						>
							LIVE
						</div>
					)}
				</div>
				<div
					style={{
						fontSize: 18,
						fontWeight: 600,
						color: "var(--fg-primary)",
						letterSpacing: "-0.01em",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{displayName}
				</div>
				{memberCount > 0 && (
					<div
						style={{
							fontSize: 11.5,
							color: "var(--fg-tertiary)",
							marginTop: 2,
							fontFamily: "var(--font-mono)",
						}}
					>
						{memberCount} members
					</div>
				)}
			</div>

			<div
				style={{
					position: "relative",
					zIndex: 1,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<div style={{ display: "flex" }}>
					{memberCount > 0
						? Array.from({
								length: Math.min(4, Math.max(1, Math.ceil(memberCount / 40))),
							}).map((_, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: decorative avatars don't reorder
									key={i}
									aria-hidden="true"
									style={{
										width: 18,
										height: 18,
										borderRadius: 99,
										background: `var(--u-${(i % 6) + 1})`,
										border: "2px solid var(--bg-input)",
										marginLeft: i ? -5 : 0,
									}}
								/>
							))
						: null}
				</div>
				<div
					style={{
						fontSize: 10,
						color: "var(--fg-tertiary)",
					}}
				>
					参加 →
				</div>
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

				createDefault: (params?: {
					id: string;
					x: number;
					y: number;
				}): CommunityRegionShapeData => ({
					id: params?.id ?? generateId(),
					type: "community-region",
					x: params?.x ?? 0,
					y: params?.y ?? 0,
					width: CARD_WIDTH,
					height: CARD_HEIGHT,
					style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
				}),

				render: (data) => <RegionCard data={data} />,

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
					if (!shapeId || prevSelection.has(shapeId)) {
						prevSelection = new Set(selection);
						return;
					}
					prevSelection = new Set(selection);

					const shape = ctx.store.getShapes().get(shapeId) as CommunityRegionShapeData | undefined;
					if (shape?.type === "community-region" && shape.slug) {
						ctx.store.clearSelection();
						onClick(shape.slug);
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
