import type { LayerRenderContext, ShapeRegistry } from "@usketch/shared";

export function ShapeLayer({
	ctx,
	shapeRegistry,
}: {
	ctx: LayerRenderContext;
	shapeRegistry: ShapeRegistry;
}) {
	const shapes = [...ctx.shapes.values()];

	return (
		<g data-layer="shapes">
			{shapes.map((shape) => {
				const def = shapeRegistry.get(shape.type);
				if (!def) return null;
				return <g key={shape.id}>{def.render(shape)}</g>;
			})}
		</g>
	);
}
