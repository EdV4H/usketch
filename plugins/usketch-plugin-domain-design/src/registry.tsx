import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import {
	type AggregateShape,
	type BoundedContextShape,
	type ClassBoxShape,
	type ContextMapRelation,
	DOMAIN_TYPES,
	type TacticalRelation,
} from "./types.js";

/**
 * `DOMAIN_SUBTYPES` の各エントリ。
 *
 * - `kind: "shape"` は drag で四角を描く通常 shape (BoundedContext / Aggregate / ClassBox)
 * - `kind: "connector"` は 2 つの shape を結ぶ DDD connector（同じ `domain-connector`
 *   shape type を使い、`domainKind` と `defaultRelation` で初期 meta を分ける）
 *
 * `type` フィールドは picker / event 用のサブタイプ識別子であり、
 * connector の場合の実際の shape type は draw tool 内で `DOMAIN_TYPES.connector` に
 * 統一されることに注意。
 */
export type DomainSubtype = DomainShapeSubtype | DomainConnectorSubtype;

interface DomainSubtypeBase {
	type: string;
	label: string;
	category: "strategic" | "tactical" | "relation";
	icon: () => ReactElement;
	defaultSize: { width: number; height: number };
}

export interface DomainShapeSubtype extends DomainSubtypeBase {
	kind: "shape";
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
}

export interface DomainConnectorSubtype extends DomainSubtypeBase {
	kind: "connector";
	domainKind: "context-map" | "tactical";
	defaultRelation: ContextMapRelation | TacticalRelation;
}

// ── アイコン ──

function BoundedContextIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="1.5"
				y="3"
				width="13"
				height="10"
				rx="1"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeDasharray="2 1.5"
			/>
		</svg>
	);
}

function AggregateIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<ellipse cx="8" cy="8" rx="6.5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
		</svg>
	);
}

function ClassBoxIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<rect
				x="2"
				y="2"
				width="12"
				height="12"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.2"
			/>
			<line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1" />
			<line x1="2" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1" />
		</svg>
	);
}

function ContextMapIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line
				x1="2"
				y1="8"
				x2="14"
				y2="8"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeDasharray="2 1.5"
			/>
			<text x="8" y="6" textAnchor="middle" fontSize="4" fill="currentColor">
				U/D
			</text>
		</svg>
	);
}

function TacticalRelationIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="2" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.4" />
			<polygon points="12,5 15,8 12,11" fill="none" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

// ── createDefault (shape only) ──

function createBoundedContext(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: DOMAIN_TYPES.boundedContext,
		x: params.x,
		y: params.y,
		width: 320,
		height: 200,
		style: { ...DEFAULT_STYLE, fill: "#fff7ed", stroke: "#f97316", strokeWidth: 2 },
		meta: {
			contextName: "BoundedContext",
			coreDomain: "supporting",
		} satisfies BoundedContextShape["meta"],
	} satisfies BoundedContextShape;
}

function createAggregate(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: DOMAIN_TYPES.aggregate,
		x: params.x,
		y: params.y,
		width: 200,
		height: 140,
		style: { ...DEFAULT_STYLE, fill: "#fefce8", stroke: "#a16207", strokeWidth: 3 },
		meta: { rootName: "AggregateRoot" } satisfies AggregateShape["meta"],
	} satisfies AggregateShape;
}

function createClassBox(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: DOMAIN_TYPES.classBox,
		x: params.x,
		y: params.y,
		width: 180,
		height: 120,
		style: { ...DEFAULT_STYLE, fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 1.5 },
		meta: {
			className: "ClassName",
			stereotype: "Entity",
			attributes: ["id: ID"],
			methods: [],
		} satisfies ClassBoxShape["meta"],
	} satisfies ClassBoxShape;
}

// ── 一覧 ──

/**
 * Subtype identifier used by the picker for connector subtypes. Multiple picker
 * entries map to the same underlying `domain-connector` shape type — they only
 * differ in default `domainKind` / `relation`.
 */
const CONTEXT_MAP_SUBTYPE = "domain-context-map";
const TACTICAL_SUBTYPE = "domain-tactical";

export const DOMAIN_SUBTYPES: DomainSubtype[] = [
	{
		kind: "shape",
		type: DOMAIN_TYPES.boundedContext,
		label: "Bounded Context",
		category: "strategic",
		icon: BoundedContextIcon,
		createDefault: createBoundedContext,
		defaultSize: { width: 320, height: 200 },
	},
	{
		kind: "connector",
		type: CONTEXT_MAP_SUBTYPE,
		label: "Context Map 関係",
		category: "relation",
		icon: ContextMapIcon,
		domainKind: "context-map",
		defaultRelation: "customer-supplier",
		defaultSize: { width: 160, height: 0 },
	},
	{
		kind: "shape",
		type: DOMAIN_TYPES.aggregate,
		label: "Aggregate",
		category: "tactical",
		icon: AggregateIcon,
		createDefault: createAggregate,
		defaultSize: { width: 200, height: 140 },
	},
	{
		kind: "shape",
		type: DOMAIN_TYPES.classBox,
		label: "Class Box",
		category: "tactical",
		icon: ClassBoxIcon,
		createDefault: createClassBox,
		defaultSize: { width: 180, height: 120 },
	},
	{
		kind: "connector",
		type: TACTICAL_SUBTYPE,
		label: "戦術関係",
		category: "relation",
		icon: TacticalRelationIcon,
		domainKind: "tactical",
		defaultRelation: "association",
		defaultSize: { width: 160, height: 0 },
	},
];
