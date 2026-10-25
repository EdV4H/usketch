import {
	type AnchorType,
	createCascadeDelete,
	createConnectorTracker,
	moveConnector,
	rotateConnector,
} from "@edv4h/usketch-connector-anchor";
import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { createAddShapeCommand, createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { computeAnchorChange } from "./anchor-change.js";
import {
	type AnchorHandleMode,
	AnchorHandleOverlay,
	setupAnchorHandles,
} from "./anchor-handle-overlay.js";
import { type ConnectorEndSpec, isTooShortDrag, resolveConnectorEnds } from "./connector-ends.js";
import { ConnectorLabelEditor, handleConnectorClick, setEditingLabel } from "./connector-label.js";
import { EndpointOverlay } from "./endpoint-overlay.js";
import { findEndShapeAtPoint, findShapeAtPoint } from "./find-shape-at-point.js";
import {
	type ArrowHead,
	createDefaultConnector,
	getBoundsConnector,
	hitTestConnector,
	type PathType,
	renderConnector,
	SimplifiedConnector,
} from "./shapes/connector.js";
import type { ConnectorShapeData } from "./types.js";

export type { AnchorHandleMode } from "./anchor-handle-overlay.js";
export type { ConnectorShapeData } from "./types.js";

/**
 * Stable ids of the UI layers this plugin registers. Exported so a host that
 * disables a layer imperatively (`instance.layers.unregister(...)`) doesn't have
 * to hardcode the internal strings. Prefer {@link ConnectorPluginOptions} to
 * opt out at construction time.
 *
 * Note: the parameter Toolbar is intentionally **not** part of this package —
 * the shape definition should not dictate a specific settings UI. The host owns
 * that UI entirely (apps/web ships its own connector property bar). This package
 * only exports the connector data types the host needs to build one.
 */
export const CONNECTOR_LAYER_IDS = {
	endpoints: "connector-endpoints",
	labelEditor: "connector-label-editor",
	anchorHandles: "connector-anchor-handles",
} as const;

/**
 * Opt out of the connector plugin's built-in UI layers when the host provides
 * its own. Each flag defaults to `true`; set `false` to skip registering that
 * layer. The shape, drawing tool, position tracking, and cascade-delete (the
 * core behavior) are always active.
 *
 * The parameter Toolbar is not listed here because it is not owned by this
 * package at all — the host renders its own (see apps/web).
 */
export interface ConnectorPluginOptions {
	/** Endpoint drag handles (used to re-anchor a connector's ends). Default `true`. */
	endpoints?: boolean;
	/** Inline label editor. Default `true`. */
	labelEditor?: boolean;
	/**
	 * Hover anchor handles + the anchor-drag drawing interaction.
	 * - `true` (default) / an {@link AnchorHandleMode} string — enable the handles;
	 *   a string picks *when* selected-shape anchors show (default mode `"single"`).
	 * - `false` — disable entirely (no layer). The `connector-draw` tool still
	 *   works; only the hover-to-anchor affordance is removed.
	 */
	anchorHandles?: boolean | AnchorHandleMode;
	/**
	 * Free connector ends. When `true`, a connector end dropped on empty space
	 * stays at that point instead of needing a shape: the `connector-draw` tool
	 * and the anchor handles can start or end anywhere, and dragging an end
	 * handle off its shape detaches it. The inside of a frame / group counts as
	 * empty space (only its edge connects). Default `false` (both ends must be
	 * on shapes, as before).
	 */
	freeEnds?: boolean;
}

function ConnectorIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="16,4 11,5 15,9" fill="currentColor" />
		</svg>
	);
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as ConnectorShapeData;
	return {
		sourceId: data.sourceId ?? null,
		targetId: data.targetId ?? null,
		sourceAnchor: data.sourceAnchor ?? null,
		targetAnchor: data.targetAnchor ?? null,
		arrowHead: data.arrowHead ?? null,
		pathType: data.pathType ?? null,
	};
}

export function createConnectorPlugin(options: ConnectorPluginOptions = {}): UsketchPlugin {
	const { endpoints = true, labelEditor = true, anchorHandles = true, freeEnds = false } = options;
	const anchorHandlesEnabled = anchorHandles !== false;
	// `true` maps to the default mode; a string is used verbatim.
	const anchorHandlesMode: AnchorHandleMode =
		typeof anchorHandles === "string" ? anchorHandles : "single";

	return {
		id: "usketch-plugin-shape-connector",
		name: "コネクタ",

		setup(ctx: PluginContext) {
			// Register connector shape
			ctx.shapes.register("connector", {
				render: renderConnector,
				getBounds: getBoundsConnector,
				hitTest: hitTestConnector,
				resize: (data) => ({ ...data }),
				move: moveConnector,
				rotate: rotateConnector,
				createDefault: createDefaultConnector,
				renderTarget: "svg",
				resizable: false,
				simplifiedComponent: SimplifiedConnector,
				debugFields,
			});

			// ── Drawing tool ──

			// A null shape is a free end fixed at its point.
			let drawState: {
				connectorId: string;
				sourceShape: ShapeData | null;
				startPoint: Point;
				/** The preview connector is added only once the drag is long enough. */
				previewAdded: boolean;
			} | null = null;

			function shapeAt(toolCtx: ToolContext, point: Point): ShapeData | null {
				return freeEnds
					? findEndShapeAtPoint(toolCtx, point, toolCtx.store.getViewport().zoom)
					: findShapeAtPoint(toolCtx, point);
			}

			// Shape under the pointer as a connector end, or a free end at the pointer.
			function endAt(toolCtx: ToolContext, point: Point): ConnectorEndSpec {
				return { shape: shapeAt(toolCtx, point), anchor: "auto", point };
			}

			function sourceEnd(): ConnectorEndSpec {
				const ds = drawState as NonNullable<typeof drawState>;
				return { shape: ds.sourceShape, anchor: "auto", point: ds.startPoint };
			}

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const startPoint = { x: event.worldPoint.x, y: event.worldPoint.y };
				const sourceShape = shapeAt(toolCtx, startPoint);
				if (!sourceShape && !freeEnds) return;
				drawState = { connectorId: generateId(), sourceShape, startPoint, previewAdded: false };
			}

			function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				if (!drawState.previewAdded) {
					// A click (no real drag) never adds anything, so it does not sync a
					// preview connector that is removed right away.
					const zoom = toolCtx.store.getViewport().zoom;
					if (isTooShortDrag(drawState.startPoint, event.worldPoint, zoom)) return;
					const { connectorId: id, startPoint } = drawState;
					const connector: ConnectorShapeData = {
						...createDefaultConnector({ id, x: startPoint.x, y: startPoint.y }),
						...resolveConnectorEnds(sourceEnd(), {
							shape: null,
							anchor: "auto",
							point: startPoint,
						}),
						style: { ...toolCtx.store.getStyleSettings(), fill: "transparent" },
					};
					toolCtx.store.addShape(connector);
					drawState.previewAdded = true;
				}
				const { sourcePoint, targetPoint, x, y, width, height } = resolveConnectorEnds(
					sourceEnd(),
					endAt(toolCtx, event.worldPoint),
				);
				toolCtx.store.updateShape(drawState.connectorId, {
					sourcePoint,
					targetPoint,
					x,
					y,
					width,
					height,
				} as Partial<ConnectorShapeData>);
			}

			function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;

				const connector = drawState.previewAdded
					? toolCtx.store.getShape(drawState.connectorId)
					: undefined;
				const target = endAt(toolCtx, event.worldPoint);
				// The preview is never kept as-is: it is either discarded or re-added
				// below through a command so the whole draw is a single undo step.
				if (connector) toolCtx.store.deleteShape(drawState.connectorId);

				const sameShape =
					drawState.sourceShape !== null && target.shape?.id === drawState.sourceShape.id;
				const tooShort = isTooShortDrag(
					drawState.startPoint,
					event.worldPoint,
					toolCtx.store.getViewport().zoom,
				);
				if (!connector || sameShape || tooShort || (!target.shape && !freeEnds)) {
					drawState = null;
					return;
				}

				const finalShape: ConnectorShapeData = {
					...(connector as ConnectorShapeData),
					...resolveConnectorEnds(sourceEnd(), target),
				};
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, finalShape));

				drawState = null;
				toolCtx.store.resetToDefaultTool();
			}

			ctx.tools.register("connector-draw", {
				icon: ConnectorIcon,
				cursor: "crosshair",
				shortcut: "l",
				order: 12,
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onDeactivate() {
					if (drawState) {
						if (drawState.previewAdded) ctx.store.deleteShape(drawState.connectorId);
						drawState = null;
					}
				},
			});

			// UI layers are opt-out (see ConnectorPluginOptions) so a host with its
			// own toolbar/UI can suppress them without depending on internal layer ids.
			// The parameter Toolbar is deliberately absent — the host owns that UI
			// entirely (see apps/web).

			// ── Endpoint overlay (Phase 5) ──

			if (endpoints) {
				ctx.layers.register({
					id: CONNECTOR_LAYER_IDS.endpoints,
					order: 81,
					fixed: true,
					// World-anchored: follow the camera rotation (see Layer.worldOverlay).
					worldOverlay: true,
					render: (renderCtx) => (
						<EndpointOverlay ctx={ctx} viewport={renderCtx.viewport} freeEnds={freeEnds} />
					),
				});
			}

			// ── Label editor overlay (Phase 6) ──

			if (labelEditor) {
				ctx.layers.register({
					id: CONNECTOR_LAYER_IDS.labelEditor,
					order: 83,
					fixed: true,
					// World-anchored: follow the camera rotation (see Layer.worldOverlay).
					worldOverlay: true,
					render: (renderCtx) => <ConnectorLabelEditor ctx={ctx} viewport={renderCtx.viewport} />,
				});
			}

			// ── Anchor handle overlay (hover to show anchor points) ──

			if (anchorHandlesEnabled) {
				ctx.layers.register({
					id: CONNECTOR_LAYER_IDS.anchorHandles,
					order: 79,
					fixed: true,
					// World-anchored: follow the camera rotation (see Layer.worldOverlay).
					worldOverlay: true,
					render: (renderCtx) => (
						<AnchorHandleOverlay ctx={ctx} viewport={renderCtx.viewport} mode={anchorHandlesMode} />
					),
				});
			}

			// Anchor-drag drawing/hover behavior is tied to the anchor-handles UI.
			const cleanupAnchorHandles = anchorHandlesEnabled
				? setupAnchorHandles(ctx, { freeEnds })
				: undefined;

			// Double-click detection for label editing
			const unsubLabelClick = ctx.store.onMutation((event) => {
				if (event.type !== "selection:changed") return;
				// Clear label editing when selection changes
				setEditingLabel(null);
			});

			// Listen for pointer events on connectors for double-click
			const unsubPointerForLabel = ctx.events.on<{ shapeId: string }>(
				"shape:clicked",
				({ shapeId }) => {
					const shape = ctx.store.getShape(shapeId);
					if (shape?.type === "connector") {
						handleConnectorClick(shapeId);
					}
				},
			);

			// ── 選択コネクタのプロパティ操作を Action として公開（ConnectorPropertyBar 置換） ──
			const selectedConnectorId = (): string | undefined => {
				const sel = [...ctx.store.getSelection()];
				if (sel.length !== 1) return undefined;
				return ctx.store.getShape(sel[0])?.type === "connector" ? sel[0] : undefined;
			};
			const hasConnector = () => selectedConnectorId() !== undefined;
			const updateConnectorProp = (key: string, value: unknown) => {
				const id = selectedConnectorId();
				if (!id) return;
				const cur = ctx.store.getShape(id) as ConnectorShapeData | undefined;
				if (!cur) return;
				const from = { [key]: (cur as unknown as Record<string, unknown>)[key] };
				ctx.commands.execute(
					createBatchUpdateShapesCommand(ctx.store, [{ id, from, to: { [key]: value } }]),
				);
			};
			// アンカー変更。差分の計算は computeAnchorChange（両端が接続していれば端点座標も
			// 再計算、片方でも未接続ならアンカーと custom の比率だけ）。HUD の action は
			// connector 選択中は常に有効なので、no-op にせず値は必ず反映させる。
			const setConnectorAnchor = (endpoint: "source" | "target", value: AnchorType) => {
				const id = selectedConnectorId();
				if (!id) return;
				const c = ctx.store.getShape(id) as ConnectorShapeData | undefined;
				if (!c) return;
				const { from, to } = computeAnchorChange(c, endpoint, value, {
					source: c.sourceId ? ctx.store.getShape(c.sourceId) : undefined,
					target: c.targetId ? ctx.store.getShape(c.targetId) : undefined,
				});
				ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, [{ id, from, to }]));
			};
			const anchorOptions = [
				{ value: "auto", label: "自動" },
				{ value: "top", label: "上" },
				{ value: "right", label: "右" },
				{ value: "bottom", label: "下" },
				{ value: "left", label: "左" },
				{ value: "custom", label: "手動" },
			];
			const offConnectorActions = [
				ctx.actions.register({
					id: "connector:arrow-head",
					label: "Arrow head",
					group: "Connector",
					isEnabled: hasConnector,
					params: [
						{
							name: "value",
							type: "enum",
							default: "forward",
							options: [
								{ value: "none", label: "None" },
								{ value: "forward", label: "Forward" },
								{ value: "backward", label: "Backward" },
								{ value: "both", label: "Both" },
							],
						},
					],
					run: ({ value }) => updateConnectorProp("arrowHead", value as ArrowHead),
				}),
				ctx.actions.register({
					id: "connector:path-type",
					label: "Path type",
					group: "Connector",
					isEnabled: hasConnector,
					params: [
						{
							name: "value",
							type: "enum",
							default: "straight",
							options: [
								{ value: "straight", label: "Straight" },
								{ value: "elbow", label: "Elbow" },
								{ value: "curve", label: "Curve" },
							],
						},
					],
					run: ({ value }) => updateConnectorProp("pathType", value as PathType),
				}),
				ctx.actions.register({
					id: "connector:source-anchor",
					label: "Source anchor",
					group: "Connector",
					isEnabled: hasConnector,
					params: [{ name: "value", type: "enum", default: "auto", options: anchorOptions }],
					run: ({ value }) => setConnectorAnchor("source", value as AnchorType),
				}),
				ctx.actions.register({
					id: "connector:target-anchor",
					label: "Target anchor",
					group: "Connector",
					isEnabled: hasConnector,
					params: [{ name: "value", type: "enum", default: "auto", options: anchorOptions }],
					run: ({ value }) => setConnectorAnchor("target", value as AnchorType),
				}),
			];

			// ── Position tracking & cascade delete (extracted into shared package) ──

			const isConnectorType = (t: string) => t === "connector";
			const stopTracker = createConnectorTracker({ store: ctx.store, isConnectorType });
			const stopCascade = createCascadeDelete({ store: ctx.store, isConnectorType });

			return () => {
				stopTracker();
				stopCascade();
				for (const off of offConnectorActions) off();
				unsubLabelClick();
				unsubPointerForLabel();
				cleanupAnchorHandles?.();
				if (endpoints) ctx.layers.unregister(CONNECTOR_LAYER_IDS.endpoints);
				if (labelEditor) ctx.layers.unregister(CONNECTOR_LAYER_IDS.labelEditor);
				if (anchorHandlesEnabled) ctx.layers.unregister(CONNECTOR_LAYER_IDS.anchorHandles);
			};
		},
	};
}
