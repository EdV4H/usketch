import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import {
	computeGroupBounds,
	createDeleteWithChildrenCommand,
	createGroupCommand,
	createUngroupCommand,
	getChildShapes,
} from "@edv4h/usketch-store";
import {
	createDefaultGroup,
	getBoundsGroup,
	hitTestGroup,
	renderGroup,
	resizeGroup,
} from "./shapes/group.js";

export const groupPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-group",
	name: "グループ",

	setup(ctx: PluginContext) {
		// Register the "group" shape type
		ctx.shapes.register("group", {
			render: renderGroup,
			getBounds: getBoundsGroup,
			hitTest: hitTestGroup,
			resize: resizeGroup,
			createDefault: createDefaultGroup,
			minSize: { width: 1, height: 1 },
			resizable: false,
		});

		function groupSelected() {
			const selection = ctx.store.getSelection();
			if (selection.size < 2) return;

			const childIds = [...selection];
			const children: ShapeData[] = [];
			for (const id of childIds) {
				const shape = ctx.store.getShape(id);
				if (shape) children.push(shape);
			}
			if (children.length < 2) return;

			const bounds = computeGroupBounds(children);
			const groupId = generateId();
			const groupShape: ShapeData = {
				...createDefaultGroup({ id: groupId, x: bounds.x, y: bounds.y }),
				width: bounds.width,
				height: bounds.height,
			};

			ctx.commands.execute(createGroupCommand(ctx.store, groupShape, childIds));
			ctx.store.setSelection([groupId]);
		}

		function ungroupSelected() {
			const selection = ctx.store.getSelection();
			const groupIds: string[] = [];
			const restoredChildIds: string[] = [];

			for (const id of selection) {
				const shape = ctx.store.getShape(id);
				if (shape?.type === "group") {
					groupIds.push(id);
					const children = getChildShapes(ctx.store, id);
					for (const child of children) {
						restoredChildIds.push(child.id);
					}
				}
			}

			if (groupIds.length === 0) return;

			for (const groupId of groupIds) {
				ctx.commands.execute(createUngroupCommand(ctx.store, groupId));
			}

			ctx.store.setSelection(restoredChildIds);
		}

		// Ctrl+G (Cmd+G on Mac) to group
		ctx.shortcuts.register("Ctrl+g", groupSelected);
		// Ctrl+Shift+G (Cmd+Shift+G on Mac) to ungroup
		ctx.shortcuts.register("Ctrl+Shift+g", ungroupSelected);

		// Override delete for groups to cascade
		ctx.events.on<{ shapeId: string }>("group:delete-request", (data) => {
			const shape = ctx.store.getShape(data.shapeId);
			if (shape?.type === "group") {
				ctx.commands.execute(createDeleteWithChildrenCommand(ctx.store, data.shapeId));
			}
		});

		// Update group bounds when children move.
		// Skip if bounds haven't actually changed to avoid extra re-renders.
		const unsubscribe = ctx.store.onMutation((event) => {
			if (event.type !== "shape:updated") return;
			const payload = event.payload as { id: string } | undefined;
			if (!payload?.id) return;

			const shape = ctx.store.getShape(payload.id);
			if (!shape || typeof shape.parentId !== "string") return;

			const parent = ctx.store.getShape(shape.parentId);
			if (!parent || parent.type !== "group") return;

			// Recalculate group bounds
			const children = getChildShapes(ctx.store, parent.id);
			if (children.length === 0) return;
			const bounds = computeGroupBounds(children);

			// Skip update if bounds are unchanged
			if (
				Math.abs(parent.x - bounds.x) < 0.1 &&
				Math.abs(parent.y - bounds.y) < 0.1 &&
				Math.abs(parent.width - bounds.width) < 0.1 &&
				Math.abs(parent.height - bounds.height) < 0.1
			) {
				return;
			}

			ctx.store.updateShape(parent.id, {
				x: bounds.x,
				y: bounds.y,
				width: bounds.width,
				height: bounds.height,
			});
		});

		(this as UsketchPlugin).teardown = () => {
			unsubscribe();
		};
	},
};
