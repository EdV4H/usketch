import type {
	LayerRenderContext,
	TransientObject,
	TransientRegistry,
	TransientRenderer,
} from "@edv4h/usketch-shared";
import { memo } from "react";
import { useTransientSubscribe } from "../hooks/use-transient-subscribe.js";

/**
 * One transient object. Memoized so an `emit` / `dismiss` of one object (e.g. a
 * single remote cursor moving) re-renders only that object instead of every
 * transient on the board. The registry stores the emitted object as-is, so this
 * relies on callers emitting a new object for every change (all current callers
 * pass a fresh literal; never mutate an emitted object and re-emit it). A Canvas
 * re-render passes a new `ctx` and re-renders all.
 */
const TransientItem = memo(function TransientItem({
	obj,
	renderer,
	ctx,
}: {
	obj: TransientObject;
	renderer: TransientRenderer;
	ctx: LayerRenderContext;
}) {
	return (
		<div
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
});

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
				return <TransientItem key={obj.id} obj={obj} renderer={renderer} ctx={ctx} />;
			})}
		</div>
	);
}
