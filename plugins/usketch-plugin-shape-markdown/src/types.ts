import type { ShapeData } from "@edv4h/usketch-shared";

/** Shape type id for the markdown shape. */
export const MARKDOWN_TYPE = "markdown";

/**
 * Markdown shape metadata. Shape-specific data lives under `meta` (per the
 * project convention: prefer `ShapeData<TMeta>` over `extends ShapeData`).
 *
 * - `source` — raw Markdown source (edited directly, rendered to GFM on view).
 * - `isEditing` — transient edit-mode flag the renderer switches on.
 */
export interface MarkdownMeta {
	source: string;
	isEditing: boolean;
	// Index signature keeps MarkdownMeta assignable to the store's default
	// `Record<string, unknown>` meta so store/command calls type-check.
	[key: string]: unknown;
}

export type MarkdownShapeData = ShapeData<MarkdownMeta>;

/** Read `meta` with safe defaults (meta is optional / loosely typed on ShapeData). */
export function readMarkdownMeta(shape: ShapeData): MarkdownMeta {
	const meta = shape.meta as Partial<MarkdownMeta> | undefined;
	return {
		source: typeof meta?.source === "string" ? meta.source : "",
		isEditing: meta?.isEditing === true,
	};
}
