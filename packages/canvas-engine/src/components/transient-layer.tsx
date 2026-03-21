import type { LayerRenderContext, TransientRegistry } from "@edv4h/usketch-shared";
import { useTransientSubscribe } from "../hooks/use-transient-subscribe.js";

export function TransientLayer({
	registry,
	ctx,
}: {
	registry: TransientRegistry;
	ctx: LayerRenderContext;
}) {
	const objects = useTransientSubscribe(registry);

	return (
		<div data-layer="transient">
			{[...objects.values()].map((obj) => {
				const renderer = registry.getRenderer(obj.type);
				if (!renderer) return null;
				return (
					<div
						key={obj.id}
						style={{
							position: "absolute",
							left: obj.position.x,
							top: obj.position.y,
							pointerEvents: obj.data.interactive ? "auto" : "none",
						}}
					>
						{renderer.render(obj, ctx)}
					</div>
				);
			})}
		</div>
	);
}
