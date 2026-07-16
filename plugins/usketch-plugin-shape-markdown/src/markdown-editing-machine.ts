import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createDeleteShapeCommand, createUpdateShapeCommand } from "@edv4h/usketch-store";
import { createMachine, type MachineSchema } from "@zag-js/core";
import { VanillaMachine } from "@zag-js/vanilla";
import { MARKDOWN_TYPE, type MarkdownMeta, readMarkdownMeta } from "./types.js";

// ── Event Types ──
// Editing is entered only by explicit intent: CREATE_SHAPE (tool placement) or
// BEGIN_EDIT (Control HUD "Edit source" action). There is no double-click path
// so rendered content clicks are free for the shape's own interactions.

type MarkdownEvent =
	| { type: "CREATE_SHAPE"; shapeId: string }
	| { type: "BEGIN_EDIT"; shapeId: string }
	| { type: "ENTER_EDIT" }
	| { type: "SETTLE_TIMEOUT" }
	| { type: "EDIT_INPUT"; id: string; source: string; scrollHeight: number }
	| { type: "EDIT_BLUR"; id: string }
	| { type: "EDIT_ESCAPE"; id: string }
	| { type: "OUTSIDE_CLICK" }
	| { type: "DESELECTED" };

// ── Machine Schema ──

interface MarkdownMachineSchema extends MachineSchema {
	context: {
		editingShapeId: string | null;
		metaSnapshot: Record<string, unknown> | null;
		heightSnapshot: number | null;
	};
	refs: {
		settleTimer: ReturnType<typeof setTimeout> | null;
		pluginCtx: PluginContext;
	};
	state: "idle" | "creating" | "editing" | "editing.settling" | "editing.active";
	event: MarkdownEvent;
	guard: "isEditingTarget";
	action:
		| "setEditing"
		| "enterEdit"
		| "exitEdit"
		| "updateSource"
		| "sendEnterEdit"
		| "startSettleTimer";
	effect: never;
	tag: never;
	props: { id: string };
	computed: Record<string, never>;
}

/**
 * Merge a partial patch onto the shape's current meta. Spreads the **raw**
 * existing meta (not the normalized {source,isEditing}) so any extra keys —
 * present now or added later by other tooling — are preserved through edits.
 * `store.updateShape` replaces `meta` wholesale, so we must carry it forward.
 */
function metaPatch(
	shape: ShapeData,
	patch: Partial<MarkdownMeta>,
): { meta: Record<string, unknown> } {
	const existing = (shape.meta ?? {}) as Record<string, unknown>;
	return { meta: { ...existing, ...patch } };
}

// ── Machine Definition ──

const markdownEditingMachine = createMachine<MarkdownMachineSchema>({
	initialState: () => "idle",

	context({ bindable }) {
		return {
			editingShapeId: bindable<string | null>(() => ({ defaultValue: null })),
			metaSnapshot: bindable<Record<string, unknown> | null>(() => ({ defaultValue: null })),
			heightSnapshot: bindable<number | null>(() => ({ defaultValue: null })),
		};
	},

	refs() {
		return {
			settleTimer: null as ReturnType<typeof setTimeout> | null,
			pluginCtx: null as unknown as PluginContext,
		};
	},

	states: {
		idle: {
			on: {
				CREATE_SHAPE: { target: "creating", actions: ["setEditing"] },
				BEGIN_EDIT: { target: "creating", actions: ["setEditing"] },
			},
		},

		creating: {
			entry: ["sendEnterEdit"],
			on: {
				ENTER_EDIT: { target: "editing", actions: ["enterEdit"] },
			},
		},

		editing: {
			initial: "settling",
			states: {
				settling: {
					entry: ["startSettleTimer"],
					on: {
						EDIT_INPUT: { guard: "isEditingTarget", actions: ["updateSource"] },
						EDIT_ESCAPE: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						DESELECTED: { target: "idle", actions: ["exitEdit"] },
						SETTLE_TIMEOUT: { target: "active" },
						// EDIT_BLUR and OUTSIDE_CLICK are ignored while settling
					},
				},
				active: {
					on: {
						EDIT_INPUT: { guard: "isEditingTarget", actions: ["updateSource"] },
						EDIT_BLUR: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						OUTSIDE_CLICK: { target: "idle", actions: ["exitEdit"] },
						EDIT_ESCAPE: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						DESELECTED: { target: "idle", actions: ["exitEdit"] },
					},
				},
			},
		},
	},

	implementations: {
		guards: {
			isEditingTarget({ context, event }) {
				return event.id === context.get("editingShapeId");
			},
		},

		actions: {
			setEditing({ context, event }) {
				context.set("editingShapeId", event.shapeId);
			},

			enterEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape || shape.type !== MARKDOWN_TYPE) return;

				context.set("metaSnapshot", { ...((shape.meta ?? {}) as Record<string, unknown>) });
				context.set("heightSnapshot", shape.height);
				pluginCtx.store.updateShape(id, metaPatch(shape, { isEditing: true }));
			},

			startSettleTimer({ refs, send }) {
				const prev = refs.get("settleTimer");
				if (prev != null) clearTimeout(prev);
				const timer = setTimeout(() => {
					send({ type: "SETTLE_TIMEOUT" });
				}, 200);
				refs.set("settleTimer", timer);
			},

			exitEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const prevMeta = context.get("metaSnapshot") ?? {};
				const prevSource = readMarkdownMeta({ meta: prevMeta } as unknown as ShapeData).source;
				const prevHeight = context.get("heightSnapshot");
				const pluginCtx = refs.get("pluginCtx");

				const settleTimer = refs.get("settleTimer");
				if (settleTimer != null) {
					clearTimeout(settleTimer);
					refs.set("settleTimer", null);
				}

				const shape = pluginCtx.store.getShape(id);
				if (!shape) {
					context.set("editingShapeId", null);
					context.set("metaSnapshot", null);
					context.set("heightSnapshot", null);
					return;
				}

				// Leave edit mode first so the from/to snapshots capture the
				// non-editing meta (isEditing:false) on both sides of the undo step.
				pluginCtx.store.updateShape(id, metaPatch(shape, { isEditing: false }));
				const currentShape = pluginCtx.store.getShape(id) ?? shape;
				const currentSource = readMarkdownMeta(currentShape).source;

				if (currentSource.trim() === "") {
					pluginCtx.commands.execute(createDeleteShapeCommand(pluginCtx.store, id));
				} else if (currentSource !== prevSource) {
					// Preserve any extra meta keys on both sides of the undo step.
					pluginCtx.commands.execute(
						createUpdateShapeCommand(
							pluginCtx.store,
							id,
							{
								meta: { ...prevMeta, isEditing: false },
								height: prevHeight ?? currentShape.height,
							},
							{
								meta: {
									...((currentShape.meta ?? {}) as Record<string, unknown>),
									isEditing: false,
								},
								height: currentShape.height,
							},
						),
					);
				}

				context.set("editingShapeId", null);
				context.set("metaSnapshot", null);
				context.set("heightSnapshot", null);
			},

			updateSource({ refs, event }) {
				const id = event.id;
				if (!id) return;
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape) return;
				const newHeight = Math.max(48, event.scrollHeight);
				pluginCtx.store.updateShape(id, {
					...metaPatch(shape, { source: event.source }),
					height: newHeight,
				});
			},

			sendEnterEdit({ send }) {
				send({ type: "ENTER_EDIT" });
			},
		},
	},
});

// ── Service Factory ──

export type { MarkdownEvent };

export function createMarkdownEditingService(pluginCtx: PluginContext) {
	const machine = new VanillaMachine(markdownEditingMachine);
	machine.refs.set("pluginCtx", pluginCtx);
	machine.start();

	return {
		send: machine.send,
		get context() {
			return {
				editingShapeId: machine.context.get("editingShapeId"),
				metaSnapshot: machine.context.get("metaSnapshot"),
				heightSnapshot: machine.context.get("heightSnapshot"),
			};
		},
		matches: (...values: string[]) => {
			const state = machine.state.get();
			return values.some((v) => state === v || state.startsWith(`${v}.`));
		},
		stop() {
			const settleTimer = machine.refs.get("settleTimer");
			if (settleTimer != null) clearTimeout(settleTimer);
			machine.stop();
		},
	};
}
