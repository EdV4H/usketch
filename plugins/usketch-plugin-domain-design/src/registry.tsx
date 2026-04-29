import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import {
	type AggregateShape,
	type BoundedContextShape,
	type ClassBoxShape,
	type ContextMapConnectorShape,
	DOMAIN_TYPES,
	type TacticalConnectorShape,
} from "./types.js";

export interface DomainSubtype {
	type: string;
	label: string;
	category: "strategic" | "tactical" | "relation";
	icon: () => ReactElement;
	createDefault: (params: { id: string; x: number; y: number }) => ShapeData;
	defaultSize: { width: number; height: number };
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

// ── createDefault ──

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

function createContextMapConnector(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: DOMAIN_TYPES.contextMapConnector,
		x: params.x,
		y: params.y,
		width: 160,
		height: 0,
		style: { ...DEFAULT_STYLE, fill: "transparent", stroke: "#1e1e1e", strokeWidth: 1.5 },
		meta: {
			relation: "customer-supplier",
			upstream: "from",
		} satisfies ContextMapConnectorShape["meta"],
	} satisfies ContextMapConnectorShape;
}

function createTacticalConnector(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: DOMAIN_TYPES.tacticalConnector,
		x: params.x,
		y: params.y,
		width: 160,
		height: 0,
		style: { ...DEFAULT_STYLE, fill: "transparent", stroke: "#1e1e1e", strokeWidth: 1.5 },
		meta: { relation: "association" } satisfies TacticalConnectorShape["meta"],
	} satisfies TacticalConnectorShape;
}

// ── 一覧 ──

export const DOMAIN_SUBTYPES: DomainSubtype[] = [
	{
		type: DOMAIN_TYPES.boundedContext,
		label: "Bounded Context",
		category: "strategic",
		icon: BoundedContextIcon,
		createDefault: createBoundedContext,
		defaultSize: { width: 320, height: 200 },
	},
	{
		type: DOMAIN_TYPES.contextMapConnector,
		label: "Context Map 関係",
		category: "relation",
		icon: ContextMapIcon,
		createDefault: createContextMapConnector,
		defaultSize: { width: 160, height: 0 },
	},
	{
		type: DOMAIN_TYPES.aggregate,
		label: "Aggregate",
		category: "tactical",
		icon: AggregateIcon,
		createDefault: createAggregate,
		defaultSize: { width: 200, height: 140 },
	},
	{
		type: DOMAIN_TYPES.classBox,
		label: "Class Box",
		category: "tactical",
		icon: ClassBoxIcon,
		createDefault: createClassBox,
		defaultSize: { width: 180, height: 120 },
	},
	{
		type: DOMAIN_TYPES.tacticalConnector,
		label: "戦術関係",
		category: "relation",
		icon: TacticalRelationIcon,
		createDefault: createTacticalConnector,
		defaultSize: { width: 160, height: 0 },
	},
];
