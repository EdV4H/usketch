import {
	type BoundingBox,
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand, createUpdateShapeCommand } from "@edv4h/usketch-store";
import { createMachine, type MachineSchema } from "@zag-js/core";
import { VanillaMachine } from "@zag-js/vanilla";
import { DEFAULT_STICKY_COLOR, DEFAULT_STICKY_SIZE, STICKY_COLORS } from "./constants.js";
import { render } from "./render.js";

/**
 * LOD component: colored rectangle with one line of text truncated.
 * Drops the rich formatting / editing affordances.
 */
function SimplifiedSticky({ shape }: { shape: ShapeData }) {
	const fill = (shape.style?.fill as string) || (shape.color as string) || "#fff59d";
	const text = String((shape.text as string) || "").split("\n")[0] ?? "";
	const rotation = typeof shape.rotation === "number" ? shape.rotation : 0;
	return (
		<div
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				background: fill,
				boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
				padding: 6,
				fontSize: Math.max(10, shape.height * 0.18),
				color: "#333",
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
				pointerEvents: "none",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			{text}
		</div>
	);
}

// ── Shape helpers ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}

function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}

function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return {
		...data,
		x,
		y,
		width: Math.max(100, width),
		height: Math.max(100, height),
	};
}

function createDefault(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "sticky",
		x: params.x,
		y: params.y,
		width: DEFAULT_STICKY_SIZE.width,
		height: DEFAULT_STICKY_SIZE.height,
		style: {
			fill: STICKY_COLORS[DEFAULT_STICKY_COLOR],
			stroke: "none",
			strokeWidth: 0,
			opacity: 1,
		},
		text: "",
		fontSize: 16,
		isEditing: false,
		stickyColor: DEFAULT_STICKY_COLOR,
	};
}

// ── Text Editing State Machine ──

type StickyTextEvent =
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

interface StickyTextMachineSchema extends MachineSchema {
	context: {
		editingShapeId: string | null;
		textSnapshot: string | null;
		heightSnapshot: number | null;
	};
	refs: {
		clickTimer: ReturnType<typeof setTimeout> | null;
		settleTimer: ReturnType<typeof setTimeout> | null;
		pluginCtx: PluginContext;
	};
	state: "idle" | "clicked" | "creating" | "editing" | "editing.settling" | "editing.active";
	event: StickyTextEvent;
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

const stickyTextMachine = createMachine<StickyTextMachineSchema>({
	initialState: () => "idle",

	context({ bindable }) {
		return {
			editingShapeId: bindable<string | null>(() => ({ defaultValue: null })),
			textSnapshot: bindable<string | null>(() => ({ defaultValue: null })),
			heightSnapshot: bindable<number | null>(() => ({ defaultValue: null })),
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
				return event.shapeId != null && event.shapeId === context.get("editingShapeId");
			},
			isEditingTarget({ context, event }) {
				return event.id === context.get("editingShapeId");
			},
		},

		actions: {
			setClicked({ context, event, refs }) {
				const prev = refs.get("clickTimer");
				if (prev != null) clearTimeout(prev);
				context.set("editingShapeId", event.shapeId);
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
				context.set("editingShapeId", null);
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
				if (!shape || shape.type !== "sticky") return;

				context.set("textSnapshot", (shape.text as string) ?? "");
				context.set("heightSnapshot", shape.height);
				const clickTimer = refs.get("clickTimer");
				if (clickTimer != null) {
					clearTimeout(clickTimer);
					refs.set("clickTimer", null);
				}
				pluginCtx.store.updateShape(id, { isEditing: true });
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

				pluginCtx.store.updateShape(id, { isEditing: false });
				const currentText = (shape.text as string) ?? "";

				// Sticky notes are kept even when empty (unlike text shapes)
				if (currentText !== prevText || shape.height !== prevHeight) {
					pluginCtx.commands.execute(
						createUpdateShapeCommand(
							pluginCtx.store,
							id,
							{ text: prevText, height: prevHeight ?? shape.height },
							{ text: currentText, height: shape.height },
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
				// padding(12px top + 12px bottom = 24px) を加算した必要高さ
				const contentHeight = event.scrollHeight;
				const newHeight = Math.max(shape.height, contentHeight);
				pluginCtx.store.updateShape(id, { text: event.text, height: newHeight });
			},

			sendEnterEdit({ send }) {
				send({ type: "ENTER_EDIT" });
			},
		},
	},
});

function createStickyTextService(pluginCtx: PluginContext) {
	const machine = new VanillaMachine(stickyTextMachine);
	machine.refs.set("pluginCtx", pluginCtx);
	machine.start();

	return {
		send: machine.send,
		get context() {
			return {
				editingShapeId: machine.context.get("editingShapeId"),
			};
		},
		matches: (...values: string[]) => {
			const state = machine.state.get();
			return values.some((v) => state === v || state.startsWith(`${v}.`));
		},
		stop() {
			const clickTimer = machine.refs.get("clickTimer");
			if (clickTimer != null) clearTimeout(clickTimer);
			const settleTimer = machine.refs.get("settleTimer");
			if (settleTimer != null) clearTimeout(settleTimer);
			machine.stop();
		},
	};
}

// ── Icon ──

function StickyIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<path
				d="M4 3h12a1 1 0 011 1v9l-4 4H4a1 1 0 01-1-1V4a1 1 0 011-1z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<path d="M13 13v4l4-4h-4z" fill="currentColor" opacity="0.3" />
		</svg>
	);
}

// ── Plugin ──

export const stickyPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-sticky",
	name: "付箋",

	setup(ctx: PluginContext) {
		// ── State Machine ──
		const service = createStickyTextService(ctx);
		const { send, matches, stop: stopMachine } = service;

		// ── CustomEvent listeners (shared with text plugin via same event names) ──
		const onTextInput = (e: Event) => {
			const { id, text, scrollHeight } = (e as CustomEvent).detail;
			// Only handle events for sticky shapes
			const shape = ctx.store.getShape(id);
			if (!shape || shape.type !== "sticky") return;
			send({ type: "TEXT_INPUT", id, text, scrollHeight });
		};

		const onTextBlur = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			const shape = ctx.store.getShape(id);
			if (!shape || shape.type !== "sticky") return;
			requestAnimationFrame(() => {
				send({ type: "TEXT_BLUR", id });
			});
		};

		const onTextEscape = (e: Event) => {
			const { id } = (e as CustomEvent).detail;
			const shape = ctx.store.getShape(id);
			if (!shape || shape.type !== "sticky") return;
			send({ type: "TEXT_ESCAPE", id });
		};

		window.addEventListener("usketch:text-input", onTextInput);
		window.addEventListener("usketch:text-blur", onTextBlur);
		window.addEventListener("usketch:text-escape", onTextEscape);

		// ── Global pointerdown to exit edit mode on outside click ──
		const onWindowPointerDown = (e: PointerEvent) => {
			if (!matches("editing")) return;
			const target = e.target instanceof Element ? e.target : (e.target as Node).parentElement;
			if (target?.closest("[contenteditable]")) return;
			send({ type: "OUTSIDE_CLICK" });
		};
		window.addEventListener("pointerdown", onWindowPointerDown, true);

		// ── Double-click detection via EventBus ──
		const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
			const shapes = ctx.store.getShapes();
			let hitShapeId: string | null = null;
			for (const [id, shape] of shapes) {
				if (shape.type === "sticky" && hitTest(shape, event.worldPoint)) {
					hitShapeId = id;
				}
			}
			if (hitShapeId) {
				send({ type: "POINTER_DOWN", shapeId: hitShapeId });
			}
		});

		// ── Selection change monitoring ──
		const unsubscribe = ctx.store.subscribe(() => {
			const editingShapeId = service.context.editingShapeId;
			if (!editingShapeId) return;
			const selection = ctx.store.getSelection();
			if (!selection.has(editingShapeId)) {
				send({ type: "DESELECTED" });
			}
		});

		// ── Sticky color state ──
		let currentColor = DEFAULT_STICKY_COLOR;

		ctx.events.on<{ color: string }>("sticky:select-color", (data) => {
			currentColor = data.color;
		});

		// ── Shape registration ──
		ctx.shapes.register("sticky", {
			render,
			getBounds,
			hitTest: withRotation(hitTest),
			resize,
			createDefault,
			renderTarget: "html",
			minSize: { width: 100, height: 100 },
			simplifiedComponent: SimplifiedSticky,
		});

		// ── Draw tool registration ──
		let drawState: { startX: number; startY: number; shapeId: string } | null = null;

		ctx.tools.register("sticky-draw", {
			icon: StickyIcon,
			cursor: "crosshair",
			shortcut: "s",
			order: 26,

			onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				const id = generateId();
				const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
				shape.stickyColor = currentColor;
				shape.style = {
					...shape.style,
					fill: STICKY_COLORS[currentColor] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR],
				};
				drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
				shape.width = 0;
				shape.height = 0;
				toolCtx.store.addShape(shape);
			},

			onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (!drawState) return;
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			},

			onPointerUp(toolCtx: ToolContext) {
				if (!drawState) return;
				const shape = toolCtx.store.getShape(drawState.shapeId);
				toolCtx.store.deleteShape(drawState.shapeId);

				if (shape && shape.width > 2 && shape.height > 2) {
					// Dragged: use custom size
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
					toolCtx.store.setSelection([shape.id]);
				} else {
					// Clicked: use default size, center on click point
					const defaultShape = createDefault({
						id: drawState.shapeId,
						x: drawState.startX - DEFAULT_STICKY_SIZE.width / 2,
						y: drawState.startY - DEFAULT_STICKY_SIZE.height / 2,
					});
					defaultShape.stickyColor = currentColor;
					defaultShape.style = {
						...defaultShape.style,
						fill: STICKY_COLORS[currentColor] ?? STICKY_COLORS[DEFAULT_STICKY_COLOR],
					};
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, defaultShape));
					toolCtx.store.setSelection([defaultShape.id]);
					send({ type: "CREATE_SHAPE", shapeId: defaultShape.id });
				}

				drawState = null;
				toolCtx.store.setActiveToolId("select");
			},
		});

		// ── Teardown ──
		(this as UsketchPlugin).teardown = () => {
			stopMachine();
			window.removeEventListener("usketch:text-input", onTextInput);
			window.removeEventListener("usketch:text-blur", onTextBlur);
			window.removeEventListener("usketch:text-escape", onTextEscape);
			window.removeEventListener("pointerdown", onWindowPointerDown, true);
			offPointerDown();
			unsubscribe();
		};
	},
};
