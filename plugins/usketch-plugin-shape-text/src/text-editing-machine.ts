import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createDeleteShapeCommand, createUpdateShapeCommand } from "@edv4h/usketch-store";
import { createMachine, type MachineSchema } from "@zag-js/core";
import { VanillaMachine } from "@zag-js/vanilla";

/** Subset of TextShapeData fields the machine needs (kept local to avoid circular import with plugin.tsx). */
type TextShapeData = ShapeData & {
	text: string;
	isEditing: boolean;
};

// ── Event Types ──

type TextEvent =
	| { type: "POINTER_DOWN"; shapeId: string | null }
	| { type: "CREATE_SHAPE"; shapeId: string }
	| { type: "ENTER_EDIT" }
	| { type: "CLICK_TIMEOUT" }
	| { type: "SETTLE_TIMEOUT" }
	| { type: "TEXT_INPUT"; id: string; text: string; scrollHeight: number }
	| { type: "TEXT_BLUR"; id: string }
	| { type: "TEXT_ESCAPE"; id: string }
	| { type: "OUTSIDE_CLICK" }
	| { type: "DESELECTED" };

// ── Machine Schema ──

interface TextMachineSchema extends MachineSchema {
	context: {
		editingShapeId: string | null;
		textSnapshot: string | null;
		heightSnapshot: number | null;
		clickedShapeId: string | null;
	};
	refs: {
		clickTimer: ReturnType<typeof setTimeout> | null;
		settleTimer: ReturnType<typeof setTimeout> | null;
		pluginCtx: PluginContext;
	};
	state: "idle" | "clicked" | "creating" | "editing" | "editing.settling" | "editing.active";
	event: TextEvent;
	guard: "hasShape" | "isSameShape" | "isEditingTarget";
	action:
		| "setClicked"
		| "startClickTimer"
		| "clearClicked"
		| "setEditing"
		| "enterEdit"
		| "exitEdit"
		| "updateText"
		| "sendEnterEdit"
		| "startSettleTimer";
	effect: never;
	tag: never;
	props: { id: string };
	computed: Record<string, never>;
}

// ── Machine Definition ──

const textEditingMachine = createMachine<TextMachineSchema>({
	initialState: () => "idle",

	context({ bindable }) {
		return {
			editingShapeId: bindable<string | null>(() => ({ defaultValue: null })),
			textSnapshot: bindable<string | null>(() => ({ defaultValue: null })),
			heightSnapshot: bindable<number | null>(() => ({ defaultValue: null })),
			clickedShapeId: bindable<string | null>(() => ({ defaultValue: null })),
		};
	},

	refs() {
		return {
			clickTimer: null as ReturnType<typeof setTimeout> | null,
			settleTimer: null as ReturnType<typeof setTimeout> | null,
			pluginCtx: null as unknown as PluginContext,
		};
	},

	states: {
		idle: {
			on: {
				POINTER_DOWN: [
					{ guard: "hasShape", target: "clicked", actions: ["setClicked", "startClickTimer"] },
				],
				CREATE_SHAPE: { target: "creating", actions: ["setEditing"] },
			},
		},

		clicked: {
			on: {
				POINTER_DOWN: [
					{ guard: "isSameShape", target: "editing", actions: ["setEditing", "enterEdit"] },
					{
						guard: "hasShape",
						target: "clicked",
						actions: ["setClicked", "startClickTimer"],
						reenter: true,
					},
					{ target: "idle", actions: ["clearClicked"] },
				],
				CLICK_TIMEOUT: { target: "idle", actions: ["clearClicked"] },
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
						TEXT_INPUT: { guard: "isEditingTarget", actions: ["updateText"] },
						TEXT_ESCAPE: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						DESELECTED: { target: "idle", actions: ["exitEdit"] },
						SETTLE_TIMEOUT: { target: "active" },
						// TEXT_BLUR and OUTSIDE_CLICK are ignored in settling
					},
				},
				active: {
					on: {
						TEXT_INPUT: { guard: "isEditingTarget", actions: ["updateText"] },
						TEXT_BLUR: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						OUTSIDE_CLICK: { target: "idle", actions: ["exitEdit"] },
						TEXT_ESCAPE: { guard: "isEditingTarget", target: "idle", actions: ["exitEdit"] },
						DESELECTED: { target: "idle", actions: ["exitEdit"] },
					},
				},
			},
		},
	},

	implementations: {
		guards: {
			hasShape({ event }) {
				return event.shapeId != null;
			},
			isSameShape({ context, event }) {
				return event.shapeId != null && event.shapeId === context.get("clickedShapeId");
			},
			isEditingTarget({ context, event }) {
				return event.id === context.get("editingShapeId");
			},
		},

		actions: {
			setClicked({ context, event, refs }) {
				// Clear previous timer
				const prev = refs.get("clickTimer");
				if (prev != null) clearTimeout(prev);
				context.set("clickedShapeId", event.shapeId);
			},

			startClickTimer({ refs, send }) {
				const prev = refs.get("clickTimer");
				if (prev != null) clearTimeout(prev);
				const timer = setTimeout(() => {
					send({ type: "CLICK_TIMEOUT" });
				}, 300);
				refs.set("clickTimer", timer);
			},

			clearClicked({ context, refs }) {
				context.set("clickedShapeId", null);
				const timer = refs.get("clickTimer");
				if (timer != null) {
					clearTimeout(timer);
					refs.set("clickTimer", null);
				}
			},

			setEditing({ context, event }) {
				context.set("editingShapeId", event.shapeId);
			},

			enterEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape || shape.type !== "text") return;

				context.set("textSnapshot", (shape as TextShapeData).text ?? "");
				context.set("heightSnapshot", shape.height);
				// Clear click state
				context.set("clickedShapeId", null);
				const clickTimer = refs.get("clickTimer");
				if (clickTimer != null) {
					clearTimeout(clickTimer);
					refs.set("clickTimer", null);
				}
				pluginCtx.store.updateShape(id, { isEditing: true } as Partial<TextShapeData>);
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
				const prevText = context.get("textSnapshot");
				const prevHeight = context.get("heightSnapshot");
				const pluginCtx = refs.get("pluginCtx");

				// Clear settle timer
				const settleTimer = refs.get("settleTimer");
				if (settleTimer != null) {
					clearTimeout(settleTimer);
					refs.set("settleTimer", null);
				}

				const shape = pluginCtx.store.getShape(id);
				if (!shape) {
					context.set("editingShapeId", null);
					context.set("textSnapshot", null);
					context.set("heightSnapshot", null);
					return;
				}

				pluginCtx.store.updateShape(id, { isEditing: false } as Partial<TextShapeData>);
				const currentText = (shape as TextShapeData).text ?? "";

				if (currentText.trim() === "") {
					pluginCtx.commands.execute(createDeleteShapeCommand(pluginCtx.store, id));
				} else if (currentText !== prevText) {
					pluginCtx.commands.execute(
						createUpdateShapeCommand(
							pluginCtx.store,
							id,
							{ text: prevText, height: prevHeight ?? shape.height } as Partial<TextShapeData>,
							{ text: currentText, height: shape.height } as Partial<TextShapeData>,
						),
					);
				}

				context.set("editingShapeId", null);
				context.set("textSnapshot", null);
				context.set("heightSnapshot", null);
			},

			updateText({ context, refs, event }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape) return;
				const newHeight = Math.max(28, event.scrollHeight);
				pluginCtx.store.updateShape(id, {
					text: event.text,
					height: newHeight,
				} as Partial<TextShapeData>);
			},

			sendEnterEdit({ send }) {
				send({ type: "ENTER_EDIT" });
			},
		},
	},
});

// ── Service Factory ──

export type { TextEvent };

export function createTextEditingService(pluginCtx: PluginContext) {
	const machine = new VanillaMachine(textEditingMachine);
	// Inject pluginCtx into refs before start
	machine.refs.set("pluginCtx", pluginCtx);
	machine.start();

	return {
		send: machine.send,
		get context() {
			return {
				editingShapeId: machine.context.get("editingShapeId"),
				textSnapshot: machine.context.get("textSnapshot"),
				heightSnapshot: machine.context.get("heightSnapshot"),
				clickedShapeId: machine.context.get("clickedShapeId"),
			};
		},
		matches: (...values: string[]) => {
			const state = machine.state.get();
			return values.some((v) => state === v || state.startsWith(`${v}.`));
		},
		stop() {
			// Clear all timers
			const clickTimer = machine.refs.get("clickTimer");
			if (clickTimer != null) clearTimeout(clickTimer);
			const settleTimer = machine.refs.get("settleTimer");
			if (settleTimer != null) clearTimeout(settleTimer);
			machine.stop();
		},
	};
}
