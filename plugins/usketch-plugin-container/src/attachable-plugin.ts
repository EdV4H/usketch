import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { attachableAcceptsTarget, getAttachableHitTest, isAttachable } from "@edv4h/usketch-shared";
import { createAttachableAttacher } from "@edv4h/usketch-store";

/**
 * Runtime for **attachable child shapes** — the child-side counterpart to
 * {@link createContainerPlugin}. A shape whose `ShapeDefinition` declares an
 * `attachable` object sticks to and follows **any** shape it is dropped on, even
 * a non-container (sticky note, card, …). Use it for stamps, badges, reaction
 * pins, or handwritten annotation widgets.
 *
 * - **Auto-attach** — when an attachable shape finishes a move, it sets its
 *   `parentId` to the front-most shape it lands on (by `attachable.hitTest`,
 *   restricted by `attachable.toAny`), and clears it when dropped over nothing.
 *   Unlike `container.autoAttach`, the *child* decides — so any shape can become
 *   the parent.
 *
 * Move-follow ("drag the parent, the attached child follows") is handled
 * **natively** by `tool-helpers`/`tool-select` from the same `attachable.follow`
 * flag — this plugin only adds the reactive attach step. It is a separate plugin
 * from {@link createContainerPlugin} (register either or both); the shared store
 * util it wires, `createAttachableAttacher`, is distinct from the container
 * attacher.
 */
export function createAttachablePlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-attachable",
		name: "アタッチ可能な子",
		setup(ctx: PluginContext) {
			const stop = createAttachableAttacher({
				store: ctx.store,
				commands: ctx.commands,
				events: ctx.events,
				resolve: (shape: ShapeData) => {
					const def = ctx.shapes.get(shape.type);
					if (!isAttachable(def, shape)) return null;
					return {
						accepts: (target: ShapeData) =>
							target.id !== shape.id &&
							target.type !== "connector" &&
							attachableAcceptsTarget(def, shape, target),
						hitTest: getAttachableHitTest(def, shape),
					};
				},
			});

			return () => {
				stop();
			};
		},
	};
}
