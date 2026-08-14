import type { BoardStore, BoundingBox, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useReducer, useSyncExternalStore } from "react";
import type { PresenceActivity, PresenceUser } from "./activity.js";
import type { AiActivityStore } from "./ai-activity-store.js";
import { fallbackColor, unionBounds, worldRectToScreen } from "./geometry.js";
import type { PresenceParticipant, ResolvedActivityStyle } from "./style.js";

type Awareness = WsProviderHandle["awareness"];

/** Resolve shape ids to their world bounds (registered def, else raw x/y/w/h). */
function resolveBoxes(
	store: BoardStore,
	shapes: ShapeRegistry,
	ids: readonly string[],
): BoundingBox[] {
	const boxes: BoundingBox[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape) continue;
		const def = shapes.get(shape.type);
		boxes.push(
			def?.getBounds(shape) ?? {
				x: shape.x,
				y: shape.y,
				width: shape.width,
				height: shape.height,
			},
		);
	}
	return boxes;
}

/**
 * Resolve every remote participant's `activity` awareness field into drawable
 * world-space boxes. Self is skipped. Participants with no resolvable activity
 * are dropped. Exported for testing the awareness→geometry mapping.
 */
export function collectParticipants(
	awareness: Awareness,
	store: BoardStore,
	shapes: ShapeRegistry,
): PresenceParticipant[] {
	const out: PresenceParticipant[] = [];
	for (const [clientId, state] of awareness.getStates()) {
		if (clientId === awareness.doc.clientID) continue;
		const activity = state.activity as PresenceActivity | undefined;
		if (!activity) continue;
		const user = state.user as PresenceUser | undefined;

		const boxes = resolveBoxes(store, shapes, activity.shapeIds ?? []);
		if (boxes.length === 0 && !activity.marquee) continue;

		out.push({
			clientId,
			name: activity.label || user?.name || "",
			color: user?.color || fallbackColor(clientId),
			action: activity.action ?? "select",
			boxes,
			marquee: activity.marquee,
		});
	}
	return out;
}

/**
 * Screen-space SVG overlay drawing every remote participant's selection / edit /
 * marquee in their presence color (feature #960). Mirrors the coordinate math of
 * `UnconfirmedOverlay`. Re-renders on awareness change (own subscription) and on
 * viewport change (the fixed layer re-renders and passes a fresh `viewport`).
 */
export function ActivityOverlay({
	store,
	shapes,
	viewport,
	awareness,
	aiActivityStore,
	style,
}: {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
	awareness: Awareness;
	aiActivityStore: AiActivityStore;
	style: ResolvedActivityStyle;
}) {
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => {
		awareness.on("change", bump);
		return () => awareness.off("change", bump);
	}, [awareness]);

	// Local in-app AI activity (this tab only) — the agent has no awareness presence.
	const aiActivity = useSyncExternalStore(aiActivityStore.subscribe, aiActivityStore.get);

	const participants = collectParticipants(awareness, store, shapes);
	if (aiActivity && aiActivity.shapeIds.length > 0) {
		const boxes = resolveBoxes(store, shapes, aiActivity.shapeIds);
		if (boxes.length > 0) {
			participants.push({
				clientId: -1,
				name: style.aiParticipant.label,
				color: style.aiParticipant.color,
				action: "edit",
				boxes,
			});
		}
	}
	if (participants.length === 0) return null;

	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>参加者の選択・編集</title>
			{participants.map((p) => {
				if (style.renderParticipant) {
					// Contract: ReactElement → render it; null → draw nothing for this participant.
					const custom = style.renderParticipant(p, viewport);
					return custom === null ? null : <g key={p.clientId}>{custom}</g>;
				}
				return <ParticipantActivity key={p.clientId} p={p} viewport={viewport} style={style} />;
			})}
		</svg>
	);
}

function ParticipantActivity({
	p,
	viewport,
	style,
}: {
	p: PresenceParticipant;
	viewport: Viewport;
	style: ResolvedActivityStyle;
}) {
	const editing = p.action === "edit";
	const { outline, marquee: mq, badge } = style;
	const pad = outline.padding;
	const rects = p.boxes.map((b) => worldRectToScreen(b, viewport));
	const union = unionBounds(p.boxes);
	const badgeAt = union ? worldRectToScreen(union, viewport) : null;
	const marquee = p.marquee ? worldRectToScreen(p.marquee, viewport) : null;
	const label = editing ? `${p.name}${badge.editingSuffix}` : p.name;

	return (
		<g>
			{/* Selection / edit outlines around each shape. */}
			{rects.map((r, i) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: rects are positional, order-stable per render
					key={i}
					x={r.x - pad}
					y={r.y - pad}
					width={r.width + pad * 2}
					height={r.height + pad * 2}
					fill="none"
					stroke={p.color}
					strokeWidth={outline.strokeWidth}
					rx={outline.radius}
					opacity={outline.opacity}
				>
					{editing && outline.pulse && (
						<animate
							attributeName="opacity"
							values="0.35;0.95;0.35"
							dur="1.1s"
							repeatCount="indefinite"
						/>
					)}
				</rect>
			))}

			{/* In-progress marquee rectangle. */}
			{marquee && (
				<rect
					x={marquee.x}
					y={marquee.y}
					width={marquee.width}
					height={marquee.height}
					fill={p.color}
					fillOpacity={mq.fillOpacity}
					stroke={p.color}
					strokeWidth={mq.strokeWidth}
					strokeDasharray={mq.dash}
				/>
			)}

			{/* Name badge above the group. */}
			{badge.enabled && badgeAt && p.name && (
				<g transform={`translate(${badgeAt.x - pad}, ${badgeAt.y - pad - 18})`}>
					<rect width={label.length * 7.5 + 16} height={16} rx={4} fill={p.color} />
					<text
						x={7}
						y={12}
						fontSize={badge.fontSize}
						fontWeight={badge.fontWeight}
						fill="#fff"
						style={{ userSelect: "none" }}
					>
						{label}
					</text>
				</g>
			)}
		</g>
	);
}
