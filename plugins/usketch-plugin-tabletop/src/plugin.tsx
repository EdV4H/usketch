import { createResize, getBounds } from "@edv4h/usketch-shape-utils";
import {
	type CanvasPointerEvent,
	isShapeContainer,
	type PluginContext,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import type { ReactElement } from "react";
import { arrangeZone, type ZoneArrangeOptions } from "./arrange.js";
import { setupAttachWatch, type TurnFace, type ZoneAttachEvent } from "./attach-watch.js";
import { DefaultZone, type TabletopZoneRenderProps, ZoneView } from "./render-zone.js";
import { createTabletopApi, tabletopService } from "./service.js";
import {
	createZoneShape,
	DEFAULT_ZONE_SIZE,
	isZone,
	readZoneMeta,
	ZONE_ARRANGES,
	ZONE_FACES,
	ZONE_TYPE,
	type ZoneArrange,
	type ZoneFace,
	zoneAcceptsType,
} from "./zone.js";
import { setZoneArrange, setZoneFace, setZoneLabel } from "./zone-ops.js";

export const ZONE_TOOL_ID = "tabletop-zone-draw";

export interface CreateTabletopPluginOptions {
	/** The zone's look. Default: a dashed frame with the label (and the count of a pile). */
	render?: (props: TabletopZoneRenderProps) => ReactElement;
	/**
	 * Which shapes zones take, on top of each zone's own `accepts` list. Default:
	 * anything but connectors. Zones never take other zones.
	 */
	accepts?: (child: ShapeData, zone: ShapeData) => boolean;
	/**
	 * Turns a dropped shape up or down for zones whose `face` is `up` / `down`.
	 * Without it, `face` does nothing. For cards: `cardTurnFace` from
	 * `@edv4h/usketch-plugin-shape-card`.
	 */
	turnFace?: TurnFace;
	/** The local user dropped a shape into a zone. */
	onAttach?: (event: ZoneAttachEvent) => void;
	/** The local user took a shape out of a zone. */
	onDetach?: (event: ZoneAttachEvent) => void;
	/** Size of a zone placed by a click. Default 140 × 196 (a card and a margin). */
	defaultSize?: { width: number; height: number };
	/** Spacing used by the arrangements. */
	arrange?: ZoneArrangeOptions;
	/** Register the zone drawing tool. Default true. */
	tool?: boolean;
}

function ZoneIcon(): ReactElement {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
			<title>Zone</title>
			<rect x="4" y="2.5" width="12" height="15" rx="2" strokeWidth="1.5" strokeDasharray="2.5 2" />
			<rect x="7" y="6" width="6" height="8" rx="1" strokeWidth="1.2" />
		</svg>
	);
}

const ARRANGE_LABELS: Record<ZoneArrange, string> = {
	pile: "Pile",
	spread: "Spread",
	grid: "Grid",
	free: "Free",
};
const FACE_LABELS: Record<ZoneFace, string> = {
	keep: "As dropped",
	up: "Face up",
	down: "Face down",
};

/**
 * Tabletop parts for playing games on the board. For now: **zones**
 * (`tabletop-zone`), places that hold cards or pieces — a deck, a discard
 * pile, a player's row. A shape dropped with its center on a zone snaps into
 * it and is laid out by the zone's `arrange` (pile / spread / grid / free).
 *
 * Needs `@edv4h/usketch-plugin-container` (the zone is a container with
 * `autoAttach`, `attachHit: "center"` and `accepts`). Register this plugin
 * after it. The look is the host's (`render`); the default is a plain frame.
 */
export function createTabletopPlugin(opts: CreateTabletopPluginOptions = {}): UsketchPlugin {
	const size = opts.defaultSize ?? DEFAULT_ZONE_SIZE;
	const renderLook = opts.render ?? ((props) => <DefaultZone {...props} />);
	const hostAccepts = opts.accepts ?? ((child) => child.type !== "connector");

	return {
		id: "usketch-plugin-tabletop",
		name: "テーブルゲーム",

		setup(ctx: PluginContext) {
			const resize = createResize(40, 40);

			ctx.shapes.register(ZONE_TYPE, {
				render: (zone) => <ZoneView store={ctx.store} zone={zone} render={renderLook} />,
				getBounds,
				hitTest: withRotation((data, point) => {
					const b = getBounds(data);
					return (
						point.x >= b.x &&
						point.x <= b.x + b.width &&
						point.y >= b.y &&
						point.y <= b.y + b.height
					);
				}),
				resize,
				createDefault: ({ id, x, y }) => createZoneShape({ id, x, y, ...size }),
				renderTarget: "html",
				minSize: { width: 40, height: 40 },
				container: {
					selectableChildren: true,
					autoAttach: true,
					attachHit: "center",
					accepts: (child, zone) =>
						!isZone(child) &&
						!isShapeContainer(ctx.shapes.get(child.type), child) &&
						hostAccepts(child, zone) &&
						zoneAcceptsType(zone, child),
					layout: ({ container, children }) => arrangeZone(container, children, opts.arrange),
				},
				debugFields: (shape) => {
					const m = readZoneMeta(shape);
					return { ...m, accepts: m.accepts.join(",") };
				},
			});

			const offWatch = setupAttachWatch(ctx, {
				turnFace: opts.turnFace,
				onAttach: opts.onAttach,
				onDetach: opts.onDetach,
			});

			// ── Tool: drag a zone out, or click for the default size ──
			let draw: { startX: number; startY: number; id: string } | null = null;
			if (opts.tool !== false) {
				ctx.tools.register(ZONE_TOOL_ID, {
					icon: ZoneIcon,
					cursor: "crosshair",
					order: 29,
					onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
						// Primary button only, and one zone at a time (a second finger or a
						// pen + finger must not leave the first draft behind).
						if (event.button !== 0 || draw) return;
						const { x, y } = event.worldPoint;
						const draft = createZoneShape({ x, y, width: 0, height: 0 });
						draw = { startX: x, startY: y, id: draft.id };
						toolCtx.store.addShape(draft);
					},
					onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
						if (!draw) return;
						const { x, y } = event.worldPoint;
						toolCtx.store.updateShape(draw.id, {
							x: Math.min(draw.startX, x),
							y: Math.min(draw.startY, y),
							width: Math.abs(x - draw.startX),
							height: Math.abs(y - draw.startY),
						});
					},
					onPointerUp(toolCtx: ToolContext) {
						if (!draw) return;
						const draft = toolCtx.store.getShape(draw.id);
						toolCtx.store.deleteShape(draw.id);
						const placed =
							draft && draft.width > 10 && draft.height > 10
								? draft
								: createZoneShape({
										id: draw.id,
										x: draw.startX - size.width / 2,
										y: draw.startY - size.height / 2,
										...size,
									});
						toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, placed));
						toolCtx.store.setSelection([placed.id]);
						draw = null;
						toolCtx.store.resetToDefaultTool();
					},
					onDeactivate() {
						if (draw) {
							ctx.store.deleteShape(draw.id);
							draw = null;
						}
					},
				});
			}

			// ── HUD actions on the selected zone ──
			const selectedZone = (): string | undefined => {
				for (const id of ctx.store.getSelection()) {
					if (isZone(ctx.store.getShape(id))) return id;
				}
				return undefined;
			};
			const offActions = [
				ctx.actions.register({
					id: "tabletop-zone:arrange",
					label: "Zone layout",
					group: "Tabletop",
					params: [
						{
							name: "arrange",
							type: "enum",
							options: ZONE_ARRANGES.map((value) => ({ value, label: ARRANGE_LABELS[value] })),
							default: "pile",
						},
					],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ arrange }) => {
						const id = selectedZone();
						if (id && ZONE_ARRANGES.includes(arrange as ZoneArrange)) {
							setZoneArrange(ctx.store, id, arrange as ZoneArrange);
						}
					},
				}),
				ctx.actions.register({
					id: "tabletop-zone:face",
					label: "Turn dropped shapes",
					group: "Tabletop",
					params: [
						{
							name: "face",
							type: "enum",
							options: ZONE_FACES.map((value) => ({ value, label: FACE_LABELS[value] })),
							default: "keep",
						},
					],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ face }) => {
						const id = selectedZone();
						if (id && ZONE_FACES.includes(face as ZoneFace)) {
							setZoneFace(ctx.store, id, face as ZoneFace);
						}
					},
				}),
				ctx.actions.register({
					id: "tabletop-zone:label",
					label: "Zone label",
					group: "Tabletop",
					params: [{ name: "label", type: "string", default: "" }],
					isEnabled: () => selectedZone() !== undefined,
					run: ({ label }) => {
						const id = selectedZone();
						if (id) setZoneLabel(ctx.store, id, String(label ?? ""));
					},
				}),
			];

			const unprovide = tabletopService.provide(ctx.services, createTabletopApi(ctx.store));

			return () => {
				offWatch();
				for (const off of offActions) off();
				unprovide();
				if (draw) ctx.store.deleteShape(draw.id);
				draw = null;
			};
		},
	};
}
