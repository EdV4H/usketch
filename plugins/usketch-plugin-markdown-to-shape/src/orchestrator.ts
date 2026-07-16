import {
	DEFAULT_STYLE,
	generateId,
	type MarkdownConverterContext,
	type MarkdownConverterRegistry,
	type MarkdownShapeSpec,
	type ShapeData,
	type ShapeRegistry,
} from "@edv4h/usketch-shared";
import { nodeSource, topLevelBlocks } from "./mdast.js";

export interface ConvertOptions {
	source: string;
	/** Placement origin (typically the source markdown shape's position/size). */
	origin: { x: number; y: number; width: number };
	registry: MarkdownConverterRegistry;
	shapes: ShapeRegistry;
	/** Vertical gap between stacked shapes. Default 16. */
	gap?: number;
}

const DEFAULT_FALLBACK_HEIGHT = 96;
const TRANSPARENT_STYLE = { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 };

/**
 * Convert Markdown source into laid-out shapes. Each top-level block resolves to
 * a registered converter, or falls back to a `markdown` shape carrying the raw
 * source slice (so unsupported blocks — tables, code, mermaid — still render).
 * Shapes are stacked vertically from `origin`; the caller commits them.
 */
export function convertMarkdownToShapes(opts: ConvertOptions): ShapeData[] {
	const { source, origin, registry, shapes: shapeReg, gap = 16 } = opts;
	const converterCtx: MarkdownConverterContext = { source, shapes: shapeReg };
	const width = origin.width > 0 ? origin.width : 320;

	const specs: MarkdownShapeSpec[] = [];
	for (const node of topLevelBlocks(source)) {
		if (node.type === "thematicBreak") continue; // horizontal rule → skip
		const converter = registry.resolve(node);
		if (converter) {
			specs.push(...converter.convert(node, converterCtx));
		} else {
			// Fallback: keep the raw markdown for this block in a markdown shape.
			specs.push({
				type: "markdown",
				meta: { source: nodeSource(node, source), isEditing: false },
				style: { fill: "transparent", strokeWidth: 0 },
			});
		}
	}

	let y = origin.y;
	const result: ShapeData[] = [];
	for (const spec of specs) {
		const { type, style, meta, width: specW, height: specH, ...rest } = spec;
		const w = specW ?? width;
		const h = specH ?? DEFAULT_FALLBACK_HEIGHT;
		result.push({
			id: generateId(),
			type,
			x: origin.x,
			y,
			width: w,
			height: h,
			style: { ...TRANSPARENT_STYLE, ...(style ?? {}) },
			...(meta ? { meta } : {}),
			...rest,
		} as ShapeData);
		y += h + gap;
	}
	return result;
}
