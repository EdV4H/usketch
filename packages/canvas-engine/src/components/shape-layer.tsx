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
	const rotation = shape.rotation ?? 0;
	const isHtml = def.renderTarget === "html";

	// For SVG shapes with zero width or height, use a minimum viewBox size
	// to avoid NaN from SVG coordinate scaling (e.g. horizontal/vertical lines,
	// groups with no children, connectors between aligned shapes).
	const svgW = Math.max(bounds.width, 1);
	const svgH = Math.max(bounds.height, 1);

	return (
		<div
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				zIndex: index,
				pointerEvents: "auto",
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

export function ShapeLayer({
	ctx,
	shapeRegistry,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
}) {
	const shapes = [...ctx.shapes.values()];

	return (
		<div data-layer="shapes">
			{shapes.map((shape, index) => {
				// Skip invalid shapes (e.g. leaked Yjs internal objects)
				if (!shape || typeof shape.id !== "string" || typeof shape.type !== "string") {
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
					const fbRotation = shape.rotation ?? 0;
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
