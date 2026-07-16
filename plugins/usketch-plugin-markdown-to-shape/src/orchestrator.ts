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
	/** Vertical gap between stacked blocks. Default 16. */
	gap?: number;
}

const DEFAULT_FALLBACK_HEIGHT = 96;
const TRANSPARENT_STYLE = { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 };

/**
 * Convert Markdown source into laid-out shapes. Each top-level block resolves to
 * a registered converter, or falls back to a `markdown` shape carrying the raw
 * source slice (so unsupported blocks still render). Blocks are stacked
 * vertically from `origin`.
 *
 * A converter may return either simple specs (no `x`/`y`/`id` — the orchestrator
 * places & ids them in the slot) or a fully self-laid-out group (specs with
 * absolute `x`/`y`/`id`, e.g. a mermaid flowchart of `rectangle`s + `connector`s
 * positioned via `ctx.origin`). The orchestrator advances past whichever bottom
 * the block actually occupies.
 */
export function convertMarkdownToShapes(opts: ConvertOptions): ShapeData[] {
	const { source, origin, registry, shapes: shapeReg, gap = 16 } = opts;
	const width = origin.width > 0 ? origin.width : 320;

	const result: ShapeData[] = [];
	let y = origin.y;

	for (const node of topLevelBlocks(source)) {
		if (node.type === "thematicBreak") continue; // horizontal rule → skip

		const converterCtx: MarkdownConverterContext = {
			source,
			shapes: shapeReg,
			origin: { x: origin.x, y },
		};
		const converter = registry.resolve(node);
		const specs: MarkdownShapeSpec[] = converter
			? converter.convert(node, converterCtx)
			: [
					{
						type: "markdown",
						meta: { source: nodeSource(node, source), isEditing: false },
						style: { fill: "transparent", strokeWidth: 0 },
					},
				];

		if (specs.length === 0) continue;

		let slotBottom = y;
		for (const spec of specs) {
			const {
				id,
				type,
				x: specX,
				y: specY,
				style,
				meta,
				width: specW,
				height: specH,
				...rest
			} = spec;
			const shapeX = specX ?? origin.x;
			const shapeY = specY ?? y;
			const w = specW ?? width;
			const h = specH ?? DEFAULT_FALLBACK_HEIGHT;
			result.push({
				id: id ?? generateId(),
				type,
				x: shapeX,
				y: shapeY,
				width: w,
				height: h,
				style: { ...TRANSPARENT_STYLE, ...(style ?? {}) },
				...(meta ? { meta } : {}),
				...rest,
			} as ShapeData);
			slotBottom = Math.max(slotBottom, shapeY + h);
		}
		y = slotBottom + gap;
	}
	return result;
}
