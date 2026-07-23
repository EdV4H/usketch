import type { LayerRenderContext, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { isShapeOutsideViewport, safeRotation } from "@edv4h/usketch-shared";
import { memo } from "react";
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

// When dragging shapes onto a frame (drop target detected), boost their
// zIndex so they render above the frame's opaque background.
// Only applied when a drop target is active, not during normal selection.
const DROP_TARGET_Z_BOOST = 100_000;
const CONTAINER_SHAPE_TYPES = new Set(["frame", "island", "group"]);

/**
 * 1 シェイプ分のラッパ。`React.memo` で囲み、props が参照的に等しいフレームでは
 * `def.render` の再実行と再 reconcile をスキップする。
 *
 * ストアは未変更シェイプのオブジェクト参照を保持する（`updateShape` は対象 1 件だけ
 * 新オブジェクトに差し替える）ため、ドラッグ中の 1 件以外は `shape` 参照が変わらず、
 * デフォルトの shallow 比較でそのまま再描画を回避できる（プラグイン側の memo 実装は不要）。
 */
const ShapeWrapper = memo(function ShapeWrapper({
	shape,
	index,
	selected,
	overDropTarget,
	def,
}: {
	shape: ShapeData;
	index: number;
	selected: boolean;
	overDropTarget: boolean;
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
	const isContainer = CONTAINER_SHAPE_TYPES.has(shape.type);
	const boosted = selected && !isContainer && overDropTarget;

	return (
		<div
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				zIndex: boosted ? index + DROP_TARGET_Z_BOOST : index,
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
});

export function DomShapeLayer({
	ctx,
	shapeRegistry,
	claimedIds,
	dropTargetId,
	viewportLod = true,
	viewportLodRatio = 1.2,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
	/** Shape IDs already claimed by another renderer (e.g. GPU). These are skipped. */
	claimedIds?: ReadonlySet<string>;
	/** Frame/group ID that the dragged shapes are hovering over. */
	dropTargetId?: string | null;
	/** Render shapes outside the (scaled) viewport in simplified LOD form. */
	viewportLod?: boolean;
	/** Full-detail region as a multiple of the viewport (1.2 = 120%). See isShapeOutsideViewport. */
	viewportLodRatio?: number;
}) {
	// `gpu-only` mode: hide the DOM layer entirely (reserved for future use).
	if (ctx.renderMode === "gpu-only") return null;

	// Global LOD (zoom/count/fps): every shape renders simplified.
	const globalLod = ctx.renderMode === "lod";
	// GPU is "active" only when it is both enabled (non-interactive mode) AND has
	// actually claimed shapes (`claimedIds` is set — the plugin passes `undefined`
	// when the GPU claimed nothing). This keeps DOM as the fallback in DOM-only
	// setups (or before the first GPU claim): otherwise GPU-capable shapes like
	// `freedraw` would be skipped here yet never drawn by GPU, i.e. vanish. In
	// `interactive` mode any lingering claimedIds from a previous pass are ignored
	// so DOM owns the full shape set.
	const gpuActive = ctx.renderMode !== "interactive" && claimedIds !== undefined;
	const effectiveClaimedIds = gpuActive ? claimedIds : undefined;

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
				// LOD when the global mode says so, OR (per-shape) when the shape sits
				// outside the scaled viewport — off-screen shapes render simplified.
				const isLod =
					globalLod ||
					(viewportLod && isShapeOutsideViewport(shape, ctx.viewportBounds, viewportLodRatio));
				// LOD mode: render the shape's simplifiedComponent (or LodFallback)
				// instead of its full component. The simplifiedComponent is
				// responsible for its own positioning (it receives the full
				// ShapeData and uses shape.x/y directly), so no wrapper div is
				// needed — a wrapper without position:absolute would break
				// zIndex stacking anyway.
				//
				// Skip shapes the GPU is drawing this frame (only when GPU is active);
				// otherwise render the simplified DOM form. Deferring to GPU in
				// `interactive` mode would blank the shape since GPU isn't rendering.
				if (isLod) {
					if (def?.gpuPrimitive && gpuActive) return null;
					const Simplified = def?.simplifiedComponent ?? LodFallback;
					return <Simplified key={shape.id} shape={shape} />;
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
				// `overDropTarget` only affects `boosted` when the shape is selected,
				// so gate it on selection here. This keeps the prop stably `false` for
				// non-selected shapes, preserving the memo skip when the drop target
				// toggles — only the selected shape(s) re-render.
				const selected = ctx.selection.has(shape.id);
				return (
					<ShapeWrapper
						key={shape.id}
						shape={shape}
						index={index}
						selected={selected}
						overDropTarget={selected && !!dropTargetId}
						def={def}
					/>
				);
			})}
		</div>
	);
}
