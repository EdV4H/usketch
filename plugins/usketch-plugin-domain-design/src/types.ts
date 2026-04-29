import type { ShapeData } from "@edv4h/usketch-shared";

/**
 * `shape.meta` を型付き view に変換する境界 helper。
 * `ShapeData<TMeta>` の `meta` は generic 共変性の制約上、render 側で
 * unknown 経由のキャストが必要になる。その escape をこの関数 1 箇所に閉じ込め、
 * 利用側 (shapes/* / connectors/*) は型付きアクセスだけで済むようにする。
 */
export function readMeta<T>(shape: ShapeData): Partial<T> {
	return (shape.meta ?? {}) as unknown as Partial<T>;
}

// ── 識別子 ──

export const DOMAIN_TYPES = {
	boundedContext: "domain-bounded-context",
	aggregate: "domain-aggregate",
	classBox: "domain-class-box",
	contextMapConnector: "domain-context-map-connector",
	tacticalConnector: "domain-tactical-connector",
} as const;

// ── 戦略レベル ──

export interface BoundedContextMeta {
	contextName: string;
	team?: string;
	coreDomain?: "core" | "supporting" | "generic";
	description?: string;
}

export type BoundedContextShape = ShapeData<BoundedContextMeta>;

export type ContextMapRelation =
	| "customer-supplier"
	| "conformist"
	| "anticorruption-layer"
	| "shared-kernel"
	| "open-host-service"
	| "partnership"
	| "published-language"
	| "separate-ways";

/**
 * connector の bbox は通常 shape と同じく非負化された AABB。
 * 始点 / 終点座標は AABB 相対で `start` / `end` に保持し、
 * 矢印方向や反転を表現する。
 */
export interface ConnectorEndpoints {
	start: { x: number; y: number };
	end: { x: number; y: number };
}

export interface ContextMapConnectorMeta extends Partial<ConnectorEndpoints> {
	relation: ContextMapRelation;
	upstream?: "from" | "to";
	notes?: string;
}

export type ContextMapConnectorShape = ShapeData<ContextMapConnectorMeta>;

// ── 戦術レベル ──

export interface AggregateMeta {
	rootName: string;
	invariants?: string[];
}

export type AggregateShape = ShapeData<AggregateMeta>;

export type ClassStereotype =
	| "Entity"
	| "ValueObject"
	| "Service"
	| "Repository"
	| "DomainEvent"
	| "Factory";

export interface ClassBoxMeta {
	className: string;
	stereotype: ClassStereotype;
	attributes: string[];
	methods: string[];
}

export type ClassBoxShape = ShapeData<ClassBoxMeta>;

export type TacticalRelation =
	| "inheritance"
	| "composition"
	| "aggregation"
	| "association"
	| "dependency"
	| "realization";

export interface TacticalConnectorMeta extends Partial<ConnectorEndpoints> {
	relation: TacticalRelation;
	multiplicityFrom?: string;
	multiplicityTo?: string;
	label?: string;
}

export type TacticalConnectorShape = ShapeData<TacticalConnectorMeta>;
