import type { Point } from "@edv4h/usketch-shared";
import {
	type ContextMapRelation,
	DOMAIN_TYPES,
	type DomainConnectorMeta,
	type DomainConnectorShape,
	type TacticalRelation,
} from "../types.js";

/**
 * Default DDD connector shape. Anchor fields (sourceId / sourcePoint etc) are
 * filled in by the draw tool — `createDefaultDomainConnector` only seeds the
 * geometry / style / meta payload.
 */
export function createDefaultDomainConnector(params: {
	id: string;
	x: number;
	y: number;
	domainKind: "context-map" | "tactical";
	relation?: ContextMapRelation | TacticalRelation;
}): DomainConnectorShape {
	const meta = buildDefaultMeta(params.domainKind, params.relation);
	const sourcePoint: Point = { x: params.x, y: params.y };
	const targetPoint: Point = { x: params.x + 100, y: params.y };
	return {
		id: params.id,
		type: DOMAIN_TYPES.connector,
		x: params.x,
		y: params.y,
		width: 100,
		height: 0,
		style: { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		sourceId: undefined,
		targetId: undefined,
		sourceAnchor: "auto",
		targetAnchor: "auto",
		sourcePoint,
		targetPoint,
		controlPoint: undefined,
		controlPointAuto: true,
		// Tactical relations get a forward arrow head; context-map relations are
		// undirected lines (the relation badge encodes the upstream / downstream
		// distinction instead).
		arrowHead: params.domainKind === "tactical" ? "forward" : "none",
		pathType: "straight",
		meta,
	};
}

function buildDefaultMeta(
	domainKind: "context-map" | "tactical",
	relation?: ContextMapRelation | TacticalRelation,
): DomainConnectorMeta {
	if (domainKind === "context-map") {
		return {
			domainKind: "context-map",
			relation: (relation as ContextMapRelation | undefined) ?? "customer-supplier",
		};
	}
	return {
		domainKind: "tactical",
		relation: (relation as TacticalRelation | undefined) ?? "association",
	};
}
