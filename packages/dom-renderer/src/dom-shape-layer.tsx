import type { LayerRenderContext, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";

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
	// Sort shapes so containers (frame/island) render below their children.
	// Shapes with parentId get a higher z-index than their parent.
	const CONTAINER_TYPES = new Set(["frame", "island", "group"]);
	const shapes = [...ctx.shapes.values()].sort((a, b) => {
		const aIsContainer = CONTAINER_TYPES.has(a.type);
		const bIsContainer = CONTAINER_TYPES.has(b.type);
		// If one is a container of the other, container goes first (lower z)
		if (a.parentId === b.id) return 1; // a is child of b → b first
		if (b.parentId === a.id) return -1; // b is child of a → a first
		// Containers before non-containers at same level
		if (aIsContainer && !bIsContainer) return -1;
		if (!aIsContainer && bIsContainer) return 1;
		return 0;
	});

	return (
		<div data-layer="shapes">
			{shapes.map((shape, index) => {
				// Skip invalid shapes (e.g. leaked Yjs internal objects)
				if (!shape || typeof shape.id !== "string" || typeof shape.type !== "string") {
					return null;
				}
				// Skip shapes claimed by another renderer
				if (claimedIds?.has(shape.id)) {
					return null;
				}
				const def = shapeRegistry.get(shape.type);
				if (!def) {
					const sx = shape.x || 0;
					const sy = shape.y || 0;
					const sw = shape.width || 0;
					const sh = shape.height || 0;
					const fbW = Math.max(sw, 1);
					const fbH = Math.max(sh, 1);
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
