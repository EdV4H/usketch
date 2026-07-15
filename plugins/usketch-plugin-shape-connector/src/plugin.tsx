import {
	type AnchorType,
	createCascadeDelete,
	createConnectorTracker,
	findShapeAtPoint as findShapeAtPointGeneric,
	getAnchorPoint,
	moveConnector,
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
import {
	type AnchorHandleMode,
	AnchorHandleOverlay,
	setupAnchorHandles,
} from "./anchor-handle-overlay.js";
import { ConnectorLabelEditor, handleConnectorClick, setEditingLabel } from "./connector-label.js";
import { EndpointOverlay } from "./endpoint-overlay.js";
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
}

function ConnectorIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="16,4 11,5 15,9" fill="currentColor" />
		</svg>
	);
}

// Exclude all known connector types so connector tools never anchor to another
// connector. "domain-connector" lives in the DDD plugin, but listing the string
// here (rather than importing the constant) keeps shape-connector free of any
// reverse dependency on domain-design.
const EXCLUDE_CONNECTOR = new Set(["connector", "domain-connector"]);

/** Find a shape at a point (excluding connectors and frames/groups — prefer their children) */
export function findShapeAtPoint(ctx: ToolContext | PluginContext, point: Point): ShapeData | null {
	return findShapeAtPointGeneric(ctx, point, { excludeTypes: EXCLUDE_CONNECTOR });
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
	const { endpoints = true, labelEditor = true, anchorHandles = true } = options;
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
				createDefault: createDefaultConnector,
				renderTarget: "svg",
				resizable: false,
				simplifiedComponent: SimplifiedConnector,
				debugFields,
			});

			// ── Drawing tool ──

			let drawState: {
				connectorId: string;
				sourceShape: ShapeData;
				sourceAnchor: AnchorType;
			} | null = null;

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const sourceShape = findShapeAtPoint(toolCtx, event.worldPoint);
				if (!sourceShape) return;

				const id = generateId();
				const sourceAnchor: AnchorType = "auto";
				const sourcePoint = getAnchorPoint(sourceShape, sourceAnchor, event.worldPoint);

				const connector: ConnectorShapeData = {
					...createDefaultConnector({ id, x: sourcePoint.x, y: sourcePoint.y }),
					sourceId: sourceShape.id,
					targetId: undefined,
					sourceAnchor,
					targetAnchor: "auto",
					sourcePoint,
					targetPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					style: { ...toolCtx.store.getStyleSettings(), fill: "transparent" },
				};

				toolCtx.store.addShape(connector);
				drawState = { connectorId: id, sourceShape, sourceAnchor };
			}

			function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;

				const targetShape = findShapeAtPoint(toolCtx, event.worldPoint);
				const targetPoint = event.worldPoint;

				const sourcePoint = getAnchorPoint(
					drawState.sourceShape,
					drawState.sourceAnchor,
					targetPoint,
				);

				const updates: Partial<ConnectorShapeData> = {
					sourcePoint,
					targetPoint: targetShape ? getAnchorPoint(targetShape, "auto", sourcePoint) : targetPoint,
				};

				const sp = updates.sourcePoint as Point;
				const tp = updates.targetPoint as Point;
				updates.x = Math.min(sp.x, tp.x);
				updates.y = Math.min(sp.y, tp.y);
				updates.width = Math.abs(tp.x - sp.x);
				updates.height = Math.abs(tp.y - sp.y);

				toolCtx.store.updateShape(drawState.connectorId, updates);
			}

			function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;

				const targetShape = findShapeAtPoint(toolCtx, event.worldPoint);
				const connector = toolCtx.store.getShape(drawState.connectorId);

				if (!connector || !targetShape || targetShape.id === drawState.sourceShape.id) {
					toolCtx.store.deleteShape(drawState.connectorId);
					drawState = null;
					return;
				}

				const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, {
					x: targetShape.x + targetShape.width / 2,
					y: targetShape.y + targetShape.height / 2,
				});
				const targetPoint = getAnchorPoint(targetShape, "auto", sourcePoint);

				const finalUpdates: Partial<ConnectorShapeData> = {
					targetId: targetShape.id,
					targetAnchor: "auto",
					sourcePoint,
					targetPoint,
					x: Math.min(sourcePoint.x, targetPoint.x),
					y: Math.min(sourcePoint.y, targetPoint.y),
					width: Math.abs(targetPoint.x - sourcePoint.x),
					height: Math.abs(targetPoint.y - sourcePoint.y),
				};

				toolCtx.store.deleteShape(drawState.connectorId);
				const finalShape: ConnectorShapeData = { ...connector, ...finalUpdates };
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
						ctx.store.deleteShape(drawState.connectorId);
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
					render: (renderCtx) => <EndpointOverlay ctx={ctx} viewport={renderCtx.viewport} />,
				});
			}

			// ── Label editor overlay (Phase 6) ──

			if (labelEditor) {
				ctx.layers.register({
					id: CONNECTOR_LAYER_IDS.labelEditor,
					order: 83,
					fixed: true,
					render: (renderCtx) => <ConnectorLabelEditor ctx={ctx} viewport={renderCtx.viewport} />,
				});
			}

			// ── Anchor handle overlay (hover to show anchor points) ──

			if (anchorHandlesEnabled) {
				ctx.layers.register({
					id: CONNECTOR_LAYER_IDS.anchorHandles,
					order: 79,
					fixed: true,
					render: (renderCtx) => (
						<AnchorHandleOverlay ctx={ctx} viewport={renderCtx.viewport} mode={anchorHandlesMode} />
					),
				});
			}

			// Anchor-drag drawing/hover behavior is tied to the anchor-handles UI.
			const cleanupAnchorHandles = anchorHandlesEnabled ? setupAnchorHandles(ctx) : undefined;

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
			// アンカー変更。両端が shape に接続している場合のみ端点座標を再計算する。
			// 片方でも未接続なら anchor フィールドだけ更新する（HUD の action は
			// connector 選択中は常に有効なので、no-op にせず値は必ず反映させる）。
			const setConnectorAnchor = (endpoint: "source" | "target", value: AnchorType) => {
				const id = selectedConnectorId();
				if (!id) return;
				const c = ctx.store.getShape(id) as ConnectorShapeData | undefined;
				if (!c) return;
				const key = endpoint === "source" ? "sourceAnchor" : "targetAnchor";
				const sourceShape = c.sourceId ? ctx.store.getShape(c.sourceId) : undefined;
				const targetShape = c.targetId ? ctx.store.getShape(c.targetId) : undefined;
				if (!sourceShape || !targetShape) {
					// 端点が両方 shape に接続していない → 座標再計算はせずフィールドのみ更新。
					updateConnectorProp(key, value);
					return;
				}
				const newSourceAnchor = endpoint === "source" ? value : (c.sourceAnchor ?? "auto");
				const newTargetAnchor = endpoint === "target" ? value : (c.targetAnchor ?? "auto");
				const targetCenter = {
					x: targetShape.x + targetShape.width / 2,
					y: targetShape.y + targetShape.height / 2,
				};
				const sourceCenter = {
					x: sourceShape.x + sourceShape.width / 2,
					y: sourceShape.y + sourceShape.height / 2,
				};
				const nsp = getAnchorPoint(sourceShape, newSourceAnchor, targetCenter);
				const ntp = getAnchorPoint(targetShape, newTargetAnchor, sourceCenter);
				const from: Partial<ConnectorShapeData> = {
					[key]: (c as unknown as Record<string, unknown>)[key] as AnchorType,
					sourcePoint: c.sourcePoint,
					targetPoint: c.targetPoint,
					x: c.x,
					y: c.y,
					width: c.width,
					height: c.height,
				};
				const to: Partial<ConnectorShapeData> = {
					[key]: value,
					sourcePoint: nsp,
					targetPoint: ntp,
					x: Math.min(nsp.x, ntp.x),
					y: Math.min(nsp.y, ntp.y),
					width: Math.abs(ntp.x - nsp.x),
					height: Math.abs(ntp.y - nsp.y),
				};
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
