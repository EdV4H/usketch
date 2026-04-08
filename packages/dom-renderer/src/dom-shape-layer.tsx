import type { LayerRenderContext, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import { LodFallback } from "./lod-fallback.js";

/**
 * Reorder shapes so that each child appears immediately after its parent container,
 * while preserving the relative order within each sibling group. The input must
 * already be sorted by z-order (e.g. zIndex ascending).
 *
 * Rationale: DOM z-ordering is controlled by source order + zIndex; containers
 * (frame/island/group) must render before their children so the child elements
 * appear on top. Using a stable group-by-parent pass keeps the zIndex-based
 * order within siblings intact.
 */
function stableParentSort(
	sorted: readonly ShapeData[],
	_containerTypes: ReadonlySet<string>,
): ShapeData[] {
	// Group children by parentId (preserving order from `sorted`)
	const childrenByParent = new Map<string, ShapeData[]>();
	const topLevel: ShapeData[] = [];
	for (const shape of sorted) {
		const parentId =
			typeof shape.parentId === "string" && shape.parentId.length > 0 ? shape.parentId : null;
		if (parentId === null) {
			topLevel.push(shape);
		} else {
			let bucket = childrenByParent.get(parentId);
			if (!bucket) {
				bucket = [];
				childrenByParent.set(parentId, bucket);
			}
			bucket.push(shape);
		}
	}

	// Recursive emit: parent first, then its children (each child may also be a parent)
	const result: ShapeData[] = [];
	function emit(shape: ShapeData) {
		result.push(shape);
		const children = childrenByParent.get(shape.id);
		if (children) {
			for (const child of children) emit(child);
		}
	}
	for (const shape of topLevel) emit(shape);

	// Append orphaned children (whose parent is missing) in their original order
	const emittedIds = new Set(result.map((s) => s.id));
	for (const shape of sorted) {
		if (!emittedIds.has(shape.id)) result.push(shape);
	}
	return result;
}

function ShapeWrapper({
	shape,
	index,
	def,
}: {
	shape: ShapeData;
	index: number;
	def: { render: (data: ShapeData) => React.ReactElement; renderTarget?: string };
}) {
	const bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const rotation = safeRotation(shape.rotation);
	const isHtml = def.renderTarget === "html";

	// For SVG shapes with zero width or height, use a minimum viewBox size
	// to avoid NaN from SVG coordinate scaling (e.g. horizontal/vertical lines,
	// groups with no children, connectors between aligned shapes).
	const svgW = Math.max(bounds.width, 1);
	const svgH = Math.max(bounds.height, 1);

	// Containers (island/frame/group) use pointerEvents: none to let children receive clicks
	const isContainer = shape.type === "island" || shape.type === "group";

	return (
		<div
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				zIndex: index,
				pointerEvents: isContainer ? "none" : "auto",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{isHtml ? (
				def.render(shape)
			) : (
				<svg
					width={svgW}
					height={svgH}
					viewBox={`${bounds.x} ${bounds.y} ${svgW} ${svgH}`}
					style={{ display: "block", overflow: "visible" }}
				>
					{def.render(shape)}
				</svg>
			)}
		</div>
	);
}

export function DomShapeLayer({
	ctx,
	shapeRegistry,
	claimedIds,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
	/** Shape IDs already claimed by another renderer (e.g. GPU). These are skipped. */
	claimedIds?: ReadonlySet<string>;
}) {
	// `gpu-only` mode: hide the DOM layer entirely (reserved for future use).
	if (ctx.renderMode === "gpu-only") return null;

	// In `interactive` mode the GPU layer does not render, so any lingering
	// claimedIds from a previous `lod` pass must be ignored — otherwise a
	// stale closure in the plugin layer can keep hiding shapes until the next
	// store mutation. DOM owns the full shape set in interactive mode.
	const isLod = ctx.renderMode === "lod";
	const effectiveClaimedIds = isLod ? claimedIds : undefined;

	// Use pre-sorted shapes (by zIndex ascending) from the layer render context,
	// then reorder so that each child appears immediately after its parent container.
	// This preserves user-controlled z-order within each sibling group while keeping
	// the container-before-child invariant required by the DOM stacking context.
	const CONTAINER_TYPES = new Set(["frame", "island", "group"]);
	const shapes = stableParentSort(ctx.shapesSorted, CONTAINER_TYPES);

	return (
		<div data-layer="shapes">
			{shapes.map((shape, index) => {
				// Skip invalid shapes (e.g. leaked Yjs internal objects)
				if (!shape || typeof shape.id !== "string" || typeof shape.type !== "string") {
					return null;
				}
				// Skip shapes claimed by another renderer (lod mode only)
				if (effectiveClaimedIds?.has(shape.id)) {
					return null;
				}
				const def = shapeRegistry.get(shape.type);
				// LOD mode: render the shape's simplifiedComponent (or LodFallback)
				// instead of its full component. This sheds React/SVG cost when
				// shapes are too small to be interactable anyway.
				if (isLod) {
					const Simplified = def?.simplifiedComponent ?? LodFallback;
					return (
						<div key={shape.id} style={{ zIndex: index }}>
							<Simplified shape={shape} />
						</div>
					);
				}
				if (!def) {
					const sx = shape.x || 0;
					const sy = shape.y || 0;
					const sw = shape.width || 0;
					const sh = shape.height || 0;
					const fbW = Math.max(sw, 1);
					const fbH = Math.max(sh, 1);
					const fbRotation = safeRotation(shape.rotation);
					return (
						<div
							key={shape.id}
							style={{
								position: "absolute",
								left: sx,
								top: sy,
								width: sw,
								height: sh,
								zIndex: index,
								pointerEvents: "auto",
								transform: fbRotation ? `rotate(${fbRotation}deg)` : undefined,
								transformOrigin: "center center",
							}}
						>
							<svg
								width={fbW}
								height={fbH}
								viewBox={`${sx} ${sy} ${fbW} ${fbH}`}
								style={{ display: "block", overflow: "visible" }}
							>
								<rect
									x={sx}
									y={sy}
									width={sw}
									height={sh}
									fill="rgba(200,200,200,0.3)"
									stroke="#999"
									strokeWidth={1}
									strokeDasharray="4 2"
								/>
								<text
									x={sx + sw / 2}
									y={sy + sh / 2}
									textAnchor="middle"
									dominantBaseline="central"
									fontSize={11}
									fill="#999"
								>
									{shape.type}
								</text>
							</svg>
						</div>
					);
				}
				return <ShapeWrapper key={shape.id} shape={shape} index={index} def={def} />;
			})}
		</div>
	);
}
