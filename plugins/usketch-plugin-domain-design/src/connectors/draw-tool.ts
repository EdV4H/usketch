import { type AnchorType, findShapeAtPoint, getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import type { CanvasPointerEvent, Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import {
	type ContextMapRelation,
	DOMAIN_TYPES,
	type DomainConnectorShape,
	type TacticalRelation,
} from "../types.js";
import { createDefaultDomainConnector } from "./connector-shape.js";

// Exclude all known connector types from source / target hit-testing so a DDD
// relation can never anchor onto another connector. The plain "connector"
// string covers the standard shape-connector type without taking a reverse
// dependency on that plugin.
const EXCLUDE_CONNECTOR_TYPES = new Set([DOMAIN_TYPES.connector, "connector"]);

export interface DomainConnectorDrawTool {
	onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent): void;
	onDeactivate(toolCtx: ToolContext): void;
	isActive(): boolean;
}

export interface DomainConnectorDrawConfig {
	domainKind: "context-map" | "tactical";
	relation: ContextMapRelation | TacticalRelation;
}

/**
 * Draw tool for DDD `domain-connector` shapes. Mirrors the standard connector
 * tool flow (pointerdown picks a source shape, pointermove tracks a candidate
 * target, pointerup commits) but emits a `domain-connector` shape with the
 * relation / domainKind embedded in its `meta`.
 *
 * Important: DDD connectors require **both** source and target shapes — free
 * lines (no target) are discarded on pointerup. This matches the DDD modeling
 * intent that every relation is between two shapes.
 */
export function createDomainConnectorDrawTool(
	getConfig: () => DomainConnectorDrawConfig,
): DomainConnectorDrawTool {
	let drawState: {
		connectorId: string;
		sourceShape: ShapeData;
		sourceAnchor: AnchorType;
	} | null = null;

	function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
		const sourceShape = findShapeAtPoint(toolCtx, event.worldPoint, {
			excludeTypes: EXCLUDE_CONNECTOR_TYPES,
		});
		if (!sourceShape) return;

		const config = getConfig();
		const id = generateId();
		const sourceAnchor: AnchorType = "auto";
		const sourcePoint = getAnchorPoint(sourceShape, sourceAnchor, event.worldPoint);

		const base = createDefaultDomainConnector({
			id,
			x: sourcePoint.x,
			y: sourcePoint.y,
			domainKind: config.domainKind,
			relation: config.relation,
		});
		const connector: DomainConnectorShape = {
			...base,
			sourceId: sourceShape.id,
			targetId: undefined,
			sourceAnchor,
			targetAnchor: "auto",
			sourcePoint,
			targetPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
		};

		toolCtx.store.addShape(connector);
		drawState = { connectorId: id, sourceShape, sourceAnchor };
	}

	function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
		if (!drawState) return;

		const targetShape = findShapeAtPoint(toolCtx, event.worldPoint, {
			excludeTypes: EXCLUDE_CONNECTOR_TYPES,
		});
		const targetPoint = event.worldPoint;

		const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, targetPoint);
		const resolvedTarget: Point =
			targetShape && targetShape.id !== drawState.sourceShape.id
				? getAnchorPoint(targetShape, "auto", sourcePoint)
				: targetPoint;

		toolCtx.store.updateShape(drawState.connectorId, {
			sourcePoint,
			targetPoint: resolvedTarget,
			x: Math.min(sourcePoint.x, resolvedTarget.x),
			y: Math.min(sourcePoint.y, resolvedTarget.y),
			width: Math.abs(resolvedTarget.x - sourcePoint.x),
			height: Math.abs(resolvedTarget.y - sourcePoint.y),
		} as Partial<DomainConnectorShape>);
	}

	function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
		if (!drawState) return;

		const targetShape = findShapeAtPoint(toolCtx, event.worldPoint, {
			excludeTypes: EXCLUDE_CONNECTOR_TYPES,
		});
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

		toolCtx.store.deleteShape(drawState.connectorId);
		const finalShape = {
			...connector,
			targetId: targetShape.id,
			targetAnchor: "auto" as AnchorType,
			sourcePoint,
			targetPoint,
			x: Math.min(sourcePoint.x, targetPoint.x),
			y: Math.min(sourcePoint.y, targetPoint.y),
			width: Math.abs(targetPoint.x - sourcePoint.x),
			height: Math.abs(targetPoint.y - sourcePoint.y),
		};
		toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, finalShape));

		drawState = null;
		toolCtx.store.resetToDefaultTool();
	}

	function onDeactivate(toolCtx: ToolContext) {
		if (drawState) {
			toolCtx.store.deleteShape(drawState.connectorId);
			drawState = null;
		}
	}

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onDeactivate,
		isActive: () => drawState !== null,
	};
}
