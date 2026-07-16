import type { CanvasPointerEvent, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createMachine, type MachineSchema } from "@zag-js/core";
import { VanillaMachine } from "@zag-js/vanilla";

/**
 * Shared editable-text controller for shapes that hold a `text` string plus an
 * `isEditing` flag (text / sticky / geo). Extracted from the original per-plugin
 * XState machines so the double-click-to-edit, IME-safe input, blur/escape/
 * outside-click/deselect exit, and undoable commit behaviour live in one place.
 *
 * Edit is entered by a double-click on an editable shape (detected via the
 * `canvas:pointerdown` event) or by `beginEdit(id)` (explicit). The render layer
 * dispatches the `usketch:text-*` window events (see `editableTextProps`).
 */

type EditableEvent =
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

interface EditableRefs {
	clickTimer: ReturnType<typeof setTimeout> | null;
	settleTimer: ReturnType<typeof setTimeout> | null;
	ctx: PluginContext;
	isEditableType: (type: string) => boolean;
	growHeight: boolean;
	minHeight: number;
}

interface EditableSchema extends MachineSchema {
	context: {
		editingShapeId: string | null;
		textSnapshot: string | null;
		heightSnapshot: number | null;
		clickedShapeId: string | null;
	};
	refs: EditableRefs;
	state: "idle" | "clicked" | "creating" | "editing" | "editing.settling" | "editing.active";
	event: EditableEvent;
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
	props: Record<string, never>;
	computed: Record<string, never>;
}

const machine = createMachine<EditableSchema>({
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
			clickTimer: null,
			settleTimer: null,
			ctx: null as unknown as PluginContext,
			isEditableType: () => false,
			growHeight: true,
			minHeight: 24,
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
			on: { ENTER_EDIT: { target: "editing", actions: ["enterEdit"] } },
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
			hasShape: ({ event }) => "shapeId" in event && event.shapeId != null,
			isSameShape: ({ context, event }) =>
				"shapeId" in event &&
				event.shapeId != null &&
				event.shapeId === context.get("clickedShapeId"),
			isEditingTarget: ({ context, event }) =>
				"id" in event && event.id === context.get("editingShapeId"),
		},
		actions: {
			setClicked({ context, event, refs }) {
				const prev = refs.get("clickTimer");
				if (prev != null) clearTimeout(prev);
				if ("shapeId" in event) context.set("clickedShapeId", event.shapeId);
			},
			startClickTimer({ refs, send }) {
				const prev = refs.get("clickTimer");
				if (prev != null) clearTimeout(prev);
				refs.set(
					"clickTimer",
					setTimeout(() => send({ type: "CLICK_TIMEOUT" }), 300),
				);
			},
			clearClicked({ context, refs }) {
				context.set("clickedShapeId", null);
				const t = refs.get("clickTimer");
				if (t != null) {
					clearTimeout(t);
					refs.set("clickTimer", null);
				}
			},
			setEditing({ context, event }) {
				if ("shapeId" in event) context.set("editingShapeId", event.shapeId);
			},
			enterEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const ctx = refs.get("ctx");
				const isEditableType = refs.get("isEditableType");
				const shape = ctx.store.getShape(id);
				if (!shape || !isEditableType(shape.type)) return;
				context.set("textSnapshot", (shape as TextLike).text ?? "");
				context.set("heightSnapshot", shape.height);
				context.set("clickedShapeId", null);
				const t = refs.get("clickTimer");
				if (t != null) {
					clearTimeout(t);
					refs.set("clickTimer", null);
				}
				ctx.store.updateShape(id, { isEditing: true } as Partial<ShapeData>);
			},
			startSettleTimer({ refs, send }) {
				const prev = refs.get("settleTimer");
				if (prev != null) clearTimeout(prev);
				refs.set(
					"settleTimer",
					setTimeout(() => send({ type: "SETTLE_TIMEOUT" }), 200),
				);
			},
			exitEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const prevText = context.get("textSnapshot");
				const prevHeight = context.get("heightSnapshot");
				const ctx = refs.get("ctx");
				const settle = refs.get("settleTimer");
				if (settle != null) {
					clearTimeout(settle);
					refs.set("settleTimer", null);
				}
				const shape = ctx.store.getShape(id);
				const reset = () => {
					context.set("editingShapeId", null);
					context.set("textSnapshot", null);
					context.set("heightSnapshot", null);
				};
				if (!shape) return reset();
				ctx.store.updateShape(id, { isEditing: false } as Partial<ShapeData>);
				const currentText = (shape as TextLike).text ?? "";
				if (currentText.trim() === "") {
					const snapshot = { ...shape, isEditing: false } as ShapeData;
					ctx.commands.execute({
						execute: () => ctx.store.deleteShape(id),
						undo: () => ctx.store.addShape(snapshot),
					});
				} else if (currentText !== prevText) {
					const from = { text: prevText, height: prevHeight ?? shape.height } as Partial<ShapeData>;
					const to = { text: currentText, height: shape.height } as Partial<ShapeData>;
					ctx.commands.execute({
						execute: () => ctx.store.updateShape(id, to),
						undo: () => ctx.store.updateShape(id, from),
					});
				}
				reset();
			},
			updateText({ refs, event }) {
				if (!("text" in event)) return;
				const ctx = refs.get("ctx");
				const shape = ctx.store.getShape(event.id);
				if (!shape) return;
				const patch: Partial<ShapeData> = { text: event.text } as Partial<ShapeData>;
				if (refs.get("growHeight")) {
					(patch as { height?: number }).height = Math.max(
						refs.get("minHeight"),
						event.scrollHeight,
					);
				}
				ctx.store.updateShape(event.id, patch);
			},
			sendEnterEdit({ send }) {
				send({ type: "ENTER_EDIT" });
			},
		},
	},
});

type TextLike = ShapeData & { text?: string };

export interface EditableTextOptions {
	/** Which shape types this controller edits. */
	isEditableType: (type: string) => boolean;
	/** Hit-test used for double-click detection (per-shape geometry). */
	hitTest: (shape: ShapeData, point: { x: number; y: number }) => boolean;
	/** Grow the shape's height to fit text on input. Default true. */
	growHeight?: boolean;
	/** Minimum height when growing. Default 24. */
	minHeight?: number;
}

export interface EditableTextController {
	/** Begin editing a specific shape explicitly (e.g. right after creation). */
	beginEdit(shapeId: string): void;
	isEditing(): boolean;
	teardown(): void;
}

/** Wire up the shared editable-text machine + DOM/canvas listeners for a plugin. */
export function createEditableTextController(
	ctx: PluginContext,
	options: EditableTextOptions,
): EditableTextController {
	const service = new VanillaMachine(machine);
	service.refs.set("ctx", ctx);
	service.refs.set("isEditableType", options.isEditableType);
	service.refs.set("growHeight", options.growHeight ?? true);
	service.refs.set("minHeight", options.minHeight ?? 24);
	service.start();

	const matches = (...values: string[]) => {
		const s = service.state.get();
		return values.some((v) => s === v || s.startsWith(`${v}.`));
	};

	const onInput = (e: Event) => {
		const { id, text, scrollHeight } = (e as CustomEvent).detail;
		service.send({ type: "TEXT_INPUT", id, text, scrollHeight });
	};
	const onBlur = (e: Event) => {
		const { id } = (e as CustomEvent).detail;
		requestAnimationFrame(() => service.send({ type: "TEXT_BLUR", id }));
	};
	const onEscape = (e: Event) => {
		const { id } = (e as CustomEvent).detail;
		service.send({ type: "TEXT_ESCAPE", id });
	};
	const onWindowPointerDown = (e: PointerEvent) => {
		if (!matches("editing")) return;
		const target = e.target instanceof Element ? e.target : (e.target as Node)?.parentElement;
		// Match any contenteditable value (we use "plaintext-only"), not just "true".
		if (target?.closest("[contenteditable]")) return;
		service.send({ type: "OUTSIDE_CLICK" });
	};
	window.addEventListener("usketch:text-input", onInput);
	window.addEventListener("usketch:text-blur", onBlur);
	window.addEventListener("usketch:text-escape", onEscape);
	window.addEventListener("pointerdown", onWindowPointerDown, true);

	const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
		let hitShapeId: string | null = null;
		for (const [id, shape] of ctx.store.getShapes()) {
			if (options.isEditableType(shape.type) && options.hitTest(shape, event.worldPoint)) {
				hitShapeId = id;
			}
		}
		service.send({ type: "POINTER_DOWN", shapeId: hitShapeId });
	});

	const unsubscribe = ctx.store.subscribe(() => {
		const editingShapeId = service.context.get("editingShapeId");
		if (!editingShapeId) return;
		if (!ctx.store.getSelection().has(editingShapeId)) {
			service.send({ type: "DESELECTED" });
		}
	});

	return {
		beginEdit(shapeId) {
			service.send({ type: "CREATE_SHAPE", shapeId });
		},
		isEditing: () => matches("editing"),
		teardown() {
			const clickTimer = service.refs.get("clickTimer");
			if (clickTimer != null) clearTimeout(clickTimer);
			const settleTimer = service.refs.get("settleTimer");
			if (settleTimer != null) clearTimeout(settleTimer);
			service.stop();
			window.removeEventListener("usketch:text-input", onInput);
			window.removeEventListener("usketch:text-blur", onBlur);
			window.removeEventListener("usketch:text-escape", onEscape);
			window.removeEventListener("pointerdown", onWindowPointerDown, true);
			offPointerDown();
			unsubscribe();
		},
	};
}
