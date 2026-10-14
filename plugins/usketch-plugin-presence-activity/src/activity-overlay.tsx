import type { BoardStore, BoundingBox, ShapeRegistry, Viewport } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useReducer, useRef, useSyncExternalStore } from "react";
import type { PresenceActivity, PresenceUser } from "./activity.js";
import type { AiActivityStore } from "./ai-activity-store.js";
import { fallbackColor, unionBounds, worldRectToScreen } from "./geometry.js";
import { createMotionClock, type MotionClock, normalizeMotion, sampleMotion } from "./motion.js";
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
 *
 * With a `clock`, an `activity.motion` is sampled at that participant's elapsed
 * playback time and replaces the static `shapeIds` / `marquee` / `action`. Without
 * one, motions are ignored and the static fields are used (the legacy behaviour).
 */
export function collectParticipants(
	awareness: Awareness,
	store: BoardStore,
	shapes: ShapeRegistry,
	clock?: MotionClock,
): PresenceParticipant[] {
	const out: PresenceParticipant[] = [];
	const moving = new Set<number>();
	for (const [clientId, state] of awareness.getStates()) {
		if (clientId === awareness.doc.clientID) continue;
		const activity = state.activity as PresenceActivity | undefined;
		if (!activity) continue;
		const user = state.user as PresenceUser | undefined;

		const motion = clock ? normalizeMotion(activity.motion) : null;
		const frame = motion && clock ? sampleMotion(motion, clock.elapsed(clientId, motion.id)) : null;
		if (motion) moving.add(clientId);

		const boxes = resolveBoxes(store, shapes, frame ? frame.shapeIds : (activity.shapeIds ?? []));
		const marquee = frame ? frame.marquee : activity.marquee;
		const playing = frame ? !frame.done : false;
		// Keep a still-playing motion even when its current frame shows nothing, so the
		// overlay keeps ticking until its first visible keyframe.
		const ghosts = frame?.ghosts ?? [];
		if (boxes.length === 0 && !marquee && !frame?.cursor && ghosts.length === 0 && !playing) {
			continue;
		}

		out.push({
			clientId,
			name: activity.label || user?.name || "",
			color: user?.color || fallbackColor(clientId),
			action: frame ? frame.action : (activity.action ?? "select"),
			boxes,
			marquee,
			...(frame?.cursor ? { cursor: frame.cursor } : {}),
			...(ghosts.length > 0 ? { ghosts } : {}),
			...(frame ? { playing } : {}),
		});
	}
	clock?.prune(moving);
	return out;
}

/** A clock frozen past the end of every motion — used under `prefers-reduced-motion`. */
const FINAL_FRAME_CLOCK: MotionClock = {
	elapsed: () => Number.POSITIVE_INFINITY,
	prune: () => {},
};

function prefersReducedMotion(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
	);
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

	// Per-overlay playback clock for `activity.motion` (see ActivityMotion).
	const clockRef = useRef<MotionClock | null>(null);
	clockRef.current ??= createMotionClock();
	const clock = prefersReducedMotion() ? FINAL_FRAME_CLOCK : clockRef.current;

	const participants = collectParticipants(awareness, store, shapes, clock);
	const playing = participants.some((p) => p.playing);
	// Keep re-rendering every animation frame while any motion is still playing.
	useEffect(() => {
		if (!playing) return;
		const raf = requestAnimationFrame(bump);
		return () => cancelAnimationFrame(raf);
	});

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
	const { outline, marquee: mq, badge, ghost } = style;
	const pad = outline.padding;
	const rects = p.boxes.map((b) => worldRectToScreen(b, viewport));
	const union = unionBounds(p.boxes);
	const badgeAt = union ? worldRectToScreen(union, viewport) : null;
	const marquee = p.marquee ? worldRectToScreen(p.marquee, viewport) : null;
	const label = editing ? `${p.name}${badge.editingSuffix}` : p.name;
	const ghostRects = ghost.enabled
		? (p.ghosts ?? []).map((g) => worldRectToScreen(g.box, viewport))
		: [];
	const cursor =
		style.cursor.enabled && p.cursor
			? { x: p.cursor.x * viewport.zoom + viewport.x, y: p.cursor.y * viewport.zoom + viewport.y }
			: null;

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

			{/* Ghosts of shapes in transit (motion `moves` track). */}
			{ghostRects.map((r, i) => (
				<rect
					// biome-ignore lint/suspicious/noArrayIndexKey: ghosts are positional, order-stable per render
					key={`ghost-${i}`}
					x={r.x}
					y={r.y}
					width={r.width}
					height={r.height}
					fill={p.color}
					fillOpacity={ghost.fillOpacity}
					stroke={p.color}
					strokeWidth={ghost.strokeWidth}
					strokeDasharray={ghost.dash}
					rx={outline.radius}
				/>
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

			{/* Motion cursor (same arrow as presence-cursor's remote cursor). */}
			{cursor && (
				<g transform={`translate(${cursor.x - 2}, ${cursor.y - 2})`}>
					<path
						d="M0 0L14 10.5L7.5 11.5L11 21L7 19L4 11L0 14Z"
						fill={p.color}
						stroke="#fff"
						strokeWidth={1}
					/>
					{p.name && (
						<g transform="translate(18, 18)">
							<rect width={p.name.length * 7 + 10} height={16} rx={3} fill={p.color} />
							<text x={5} y={12} fontSize={11} fill="#fff" style={{ userSelect: "none" }}>
								{p.name}
							</text>
						</g>
					)}
				</g>
			)}
		</g>
	);
}
