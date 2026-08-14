import type { BoardStore, BoundingBox, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useReducer, useSyncExternalStore } from "react";
import type { PresenceActivity, PresenceUser } from "./activity.js";
import { aiActivityStore } from "./ai-activity-store.js";
import { fallbackColor, unionBounds, worldRectToScreen } from "./geometry.js";

type Awareness = WsProviderHandle["awareness"];

/** Identity of the local in-app AI participant (matches the MCP AI presence). */
const AI_LABEL = "AI 🤖";
const AI_COLOR = "#7c3aed";

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

interface Participant {
	clientId: number;
	name: string;
	color: string;
	action: "select" | "edit";
	/** Per-shape world bounds this participant is selecting/editing. */
	boxes: BoundingBox[];
	/** Optional in-progress marquee rect (world coords). */
	marquee?: BoundingBox;
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
): Participant[] {
	const out: Participant[] = [];
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
}: {
	store: BoardStore;
	shapes: ShapeRegistry;
	viewport: Viewport;
	awareness: Awareness;
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
				name: AI_LABEL,
				color: AI_COLOR,
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
			{participants.map((p) => (
				<ParticipantActivity key={p.clientId} p={p} viewport={viewport} />
			))}
		</svg>
	);
}

const PAD = 3; // outline inflation in screen px, so it hugs outside the shape

function ParticipantActivity({ p, viewport }: { p: Participant; viewport: Viewport }) {
	const editing = p.action === "edit";
	const rects = p.boxes.map((b) => worldRectToScreen(b, viewport));
	const union = unionBounds(p.boxes);
	const badgeAt = union ? worldRectToScreen(union, viewport) : null;
	const marquee = p.marquee ? worldRectToScreen(p.marquee, viewport) : null;

	return (
		<g>
			{/* Selection / edit outlines around each shape. */}
			{rects.map((r, i) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: rects are positional, order-stable per render
					key={i}
					x={r.x - PAD}
					y={r.y - PAD}
					width={r.width + PAD * 2}
					height={r.height + PAD * 2}
					fill="none"
					stroke={p.color}
					strokeWidth={2}
					rx={4}
					opacity={0.9}
				>
					{editing && (
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
					fillOpacity={0.08}
					stroke={p.color}
					strokeWidth={1.5}
					strokeDasharray="6 4"
				/>
			)}

			{/* Name badge above the group. */}
			{badgeAt && p.name && (
				<g transform={`translate(${badgeAt.x - PAD}, ${badgeAt.y - PAD - 18})`}>
					<rect width={p.name.length * 7.5 + 16} height={16} rx={4} fill={p.color} />
					<text
						x={7}
						y={12}
						fontSize={11}
						fontWeight={600}
						fill="#fff"
						style={{ userSelect: "none" }}
					>
						{editing ? `${p.name} ✏️` : p.name}
					</text>
				</g>
			)}
		</g>
	);
}
