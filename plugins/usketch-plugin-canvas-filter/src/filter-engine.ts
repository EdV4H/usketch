import type { ShapeData } from "@edv4h/usketch-shared";
import type {
	AttributeFilter,
	FilterRule,
	ShapeFilterConfig,
	ShapeFilterPredicate,
	TimeRangeFilter,
} from "./types.js";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}

function matchTimeRange(shape: ShapeData, rule: TimeRangeFilter): boolean {
	const value = (shape as Record<string, unknown>)[rule.field] as number | undefined;
	// Legacy shapes without timestamps always pass (they have _createdAt = 0)
	if (value == null) return true;
	if (rule.from != null && value < rule.from) return false;
	if (rule.to != null && value > rule.to) return false;
	return true;
}

function matchAttribute(shape: ShapeData, rule: AttributeFilter): boolean {
	const value = getNestedValue(shape as unknown as Record<string, unknown>, rule.field);
	switch (rule.operator) {
		case "eq":
			return value === rule.value;
		case "neq":
			return value !== rule.value;
		case "has":
			return value !== undefined && value !== null;
		case "not-has":
			return value === undefined || value === null;
		default:
			return true;
	}
}

function matchRule(shape: ShapeData, rule: FilterRule): boolean {
	switch (rule.kind) {
		case "time-range":
			return matchTimeRange(shape, rule);
		case "attribute":
			return matchAttribute(shape, rule);
		default:
			return true;
	}
}

/**
 * Compile a filter config into a single predicate function.
 * The predicate is created once and reused for all shapes.
 */
export function compileFilter(config: ShapeFilterConfig): ShapeFilterPredicate {
	const { rules, combinator } = config;

	if (rules.length === 0) return () => true;
	if (rules.length === 1) {
		const rule = rules[0];
		return (shape) => matchRule(shape, rule);
	}

	if (combinator === "and") {
		return (shape) => rules.every((rule) => matchRule(shape, rule));
	}
	return (shape) => rules.some((rule) => matchRule(shape, rule));
}

/**
 * Apply a filter predicate to a shapes map, returning a new map with only matching shapes.
 */
export function applyFilter(
	shapes: ReadonlyMap<string, ShapeData>,
	predicate: ShapeFilterPredicate,
): Map<string, ShapeData> {
	const filtered = new Map<string, ShapeData>();
	for (const [id, shape] of shapes) {
		if (predicate(shape)) {
			filtered.set(id, shape);
		}
	}
	return filtered;
}
