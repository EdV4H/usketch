export interface ShapeStyle {
	fill: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
}

/**
 * Base contract for every shape stored by uSketch.
 *
 * @typeParam TMeta - Type of application/domain-specific data carried in
 *   `meta`. Defaults to `Record<string, unknown>` so existing code that uses
 *   `ShapeData` without a type argument keeps compiling. Consumers can pass
 *   a concrete meta type to get autocomplete and type-safe reads:
 *
 *   ```ts
 *   interface WeboardMeta { employeeId?: string; documentKey?: string }
 *   const shape: ShapeData<WeboardMeta> = { ... };
 *   shape.meta?.employeeId; // typed as string | undefined
 *   ```
 *
 * Fields fall into three categories:
 *
 * 1. **Core fields** (listed explicitly below) — managed by the uSketch core.
 *    Plugins and applications must not redefine them.
 *
 * 2. **Plugin-specific fields** — a plugin that needs intrinsic data (e.g.
 *    `text` for a text shape, `points` for a freedraw stroke) should extend
 *    this interface:
 *
 *    ```ts
 *    interface TextShapeData extends ShapeData {
 *      text: string;
 *      fontSize: number;
 *    }
 *    ```
 *
 * 3. **Application/domain data — use `meta` (preferred)** — put application-
 *    specific data (e.g. `employeeId`, `documentKey`) into `meta`, and pass
 *    your meta type as `TMeta` for type safety:
 *
 *    ```ts
 *    const shape: ShapeData<WeboardMeta> = {
 *      ...,
 *      meta: { employeeId: "emp_123", documentKey: "doc_456" },
 *    };
 *    ```
 *
 *    **Escape hatch — `x-*` prefix**: for cases `meta` does not fit (e.g.
 *    a gradual migration that temporarily needs a top-level field), use a
 *    field name starting with `x-`. The `x-` namespace is guaranteed to
 *    never clash with core or plugin-extension fields (mirrors HTTP headers,
 *    JSON-LD, OpenAPI, `package.json`). Prefer `meta` whenever possible.
 */
export interface ShapeData<TMeta = Record<string, unknown>> {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	style: ShapeStyle;
	rotation?: number;
	/** Fractional index for z-order (higher lexicographic order = front). */
	zIndex?: string;
	/** Unix millis — set by the store on `addShape`. */
	createdAt?: number;
	/** Unix millis — updated by the store on every mutation. */
	updatedAt?: number;
	/** Parent shape id for hierarchical grouping (frames, islands, groups). */
	parentId?: string;
	/**
	 * Application/domain-specific metadata — the **preferred** place for data
	 * that is not intrinsic to the shape's geometry (e.g. external references,
	 * identifiers, feature flags). Typed via the `TMeta` type parameter.
	 */
	meta?: TMeta;
	/** Escape hatch for top-level application extensions. Prefer `meta`. */
	[key: `x-${string}`]: unknown;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const DEFAULT_STYLE: ShapeStyle = {
	fill: "#ffffff",
	stroke: "#1e1e1e",
	strokeWidth: 2,
	opacity: 1,
};
