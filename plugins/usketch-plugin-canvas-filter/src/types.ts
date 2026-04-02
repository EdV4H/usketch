import type { ShapeData } from "@edv4h/usketch-shared";

// ── Filter rule types ──

export interface TimeRangeFilter {
	kind: "time-range";
	field: "_createdAt" | "_updatedAt";
	from?: number; // epoch ms, inclusive
	to?: number; // epoch ms, inclusive
}

export type AttributeOperator = "eq" | "neq" | "has" | "not-has";

export interface AttributeFilter {
	kind: "attribute";
	field: string;
	operator: AttributeOperator;
	value?: unknown;
}

export type FilterRule = TimeRangeFilter | AttributeFilter;

export interface ShapeFilterConfig {
	rules: FilterRule[];
	combinator: "and" | "or";
}

export type ShapeFilterPredicate = (shape: ShapeData) => boolean;

// ── Filter events ──

export interface FilterChangedEvent {
	predicate: ShapeFilterPredicate | null;
	config: ShapeFilterConfig | null;
}

// ── Presets ──

export interface FilterPreset {
	label: string;
	description: string;
	config: ShapeFilterConfig;
}
