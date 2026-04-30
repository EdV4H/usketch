import type { ConnectableShapeData } from "@edv4h/usketch-connector-anchor";
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
	connector: "domain-connector",
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

// ── DDD connector (anchor 接続: shape を結ぶ) ──

/**
 * `domain-connector` shape の meta payload。
 * `domainKind` discriminator で context-map / tactical を分け、relation 種別と
 * それぞれの追加メタデータを保持する。
 */
export type DomainConnectorMeta =
	| {
			domainKind: "context-map";
			relation: ContextMapRelation;
			upstream?: "from" | "to";
			notes?: string;
	  }
	| {
			domainKind: "tactical";
			relation: TacticalRelation;
			multiplicityFrom?: string;
			multiplicityTo?: string;
			label?: string;
	  };

/**
 * DDD connector shape: 既存 `connector` shape と同じ anchor 構造（sourceId /
 * targetId / sourceAnchor / sourcePoint 等）を持ちつつ、`type` と `meta` を
 * domain-design 専用にしたもの。
 */
export interface DomainConnectorShape extends ConnectableShapeData {
	type: typeof DOMAIN_TYPES.connector;
	meta: DomainConnectorMeta;
}
