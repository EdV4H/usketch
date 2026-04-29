import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createUpdateShapeCommand } from "@edv4h/usketch-store";
import { createMachine, type MachineSchema } from "@zag-js/core";
import { VanillaMachine } from "@zag-js/vanilla";
import { DOMAIN_TYPES } from "../types.js";

export const EDITABLE_DOMAIN_TYPES: ReadonlySet<string> = new Set([
	DOMAIN_TYPES.boundedContext,
	DOMAIN_TYPES.aggregate,
	DOMAIN_TYPES.classBox,
]);

type EditingEvent =
	| { type: "POINTER_DOWN"; shapeId: string | null }
	| { type: "CLICK_TIMEOUT" }
	| { type: "COMMIT"; id: string; nextMeta: Record<string, unknown> }
	| { type: "CANCEL"; id: string }
	| { type: "DESELECTED" };

interface EditingMachineSchema extends MachineSchema {
	context: {
		editingShapeId: string | null;
		clickedShapeId: string | null;
		metaSnapshot: Record<string, unknown> | null;
	};
	refs: {
		clickTimer: ReturnType<typeof setTimeout> | null;
		pluginCtx: PluginContext;
	};
	state: "idle" | "clicked" | "editing";
	event: EditingEvent;
	guard: "hasShape" | "isSameShape" | "isSameAsEditing" | "isEditingTarget";
	action:
		| "setClicked"
		| "startClickTimer"
		| "clearClicked"
		| "enterEdit"
		| "commitEdit"
		| "cancelEdit";
	effect: never;
	tag: never;
	props: { id: string };
	computed: Record<string, never>;
}

const editingMachine = createMachine<EditingMachineSchema>({
	initialState: () => "idle",

	context({ bindable }) {
		return {
			editingShapeId: bindable<string | null>(() => ({ defaultValue: null })),
			clickedShapeId: bindable<string | null>(() => ({ defaultValue: null })),
			metaSnapshot: bindable<Record<string, unknown> | null>(() => ({
				defaultValue: null,
			})),
		};
	},

	refs() {
		return {
			clickTimer: null as ReturnType<typeof setTimeout> | null,
			pluginCtx: null as unknown as PluginContext,
		};
	},

	states: {
		idle: {
			on: {
				POINTER_DOWN: [
					{ guard: "hasShape", target: "clicked", actions: ["setClicked", "startClickTimer"] },
				],
			},
		},

		clicked: {
			on: {
				POINTER_DOWN: [
					{ guard: "isSameShape", target: "editing", actions: ["enterEdit"] },
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

		editing: {
			on: {
				COMMIT: { guard: "isEditingTarget", target: "idle", actions: ["commitEdit"] },
				CANCEL: { guard: "isEditingTarget", target: "idle", actions: ["cancelEdit"] },
				DESELECTED: { target: "idle", actions: ["cancelEdit"] },
				// editing 中のキャンバスクリックは state 維持。
				// editor の onBlur が COMMIT を発火するのを待つため、
				// ここで先回りして idle に遷移しない（events の発火順で COMMIT が
				// 取りこぼされるのを避ける）。
				POINTER_DOWN: [{ guard: "isSameAsEditing", target: "editing" }],
			},
		},
	},

	implementations: {
		guards: {
			hasShape({ event }) {
				return event.type === "POINTER_DOWN" && event.shapeId != null;
			},
			isSameShape({ context, event }) {
				if (event.type !== "POINTER_DOWN") return false;
				return event.shapeId != null && event.shapeId === context.get("clickedShapeId");
			},
			isSameAsEditing({ context, event }) {
				if (event.type !== "POINTER_DOWN") return false;
				return event.shapeId != null && event.shapeId === context.get("editingShapeId");
			},
			isEditingTarget({ context, event }) {
				if (event.type !== "COMMIT" && event.type !== "CANCEL") return false;
				return event.id === context.get("editingShapeId");
			},
		},

		actions: {
			setClicked({ context, event, refs }) {
				if (event.type !== "POINTER_DOWN") return;
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

			enterEdit({ context, refs }) {
				const id = context.get("clickedShapeId");
				if (!id) return;
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape) return;

				context.set("editingShapeId", id);
				context.set("metaSnapshot", { ...((shape.meta ?? {}) as Record<string, unknown>) });
				context.set("clickedShapeId", null);
				const clickTimer = refs.get("clickTimer");
				if (clickTimer != null) {
					clearTimeout(clickTimer);
					refs.set("clickTimer", null);
				}

				pluginCtx.store.updateShape(id, { "x-domain-editing": true } as Partial<ShapeData>);
			},

			commitEdit({ context, refs, event }) {
				if (event.type !== "COMMIT") return;
				const id = event.id;
				const prevMeta = context.get("metaSnapshot");
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape) {
					context.set("editingShapeId", null);
					context.set("metaSnapshot", null);
					return;
				}

				// editing flag を消す（変更通知のため updateShape を経由）
				pluginCtx.store.updateShape(id, {
					"x-domain-editing": false,
				} as Partial<ShapeData>);

				const before = (prevMeta ?? {}) as Record<string, unknown>;
				// nextMeta は partial patch なので、既存 meta にマージする。
				// （TitleEditor は { contextName: text } のように 1 フィールドだけ送る）
				const after = { ...before, ...event.nextMeta };
				const changed = !shallowEqual(before, after);
				if (changed) {
					pluginCtx.commands.execute(
						createUpdateShapeCommand(
							pluginCtx.store,
							id,
							{ meta: before } as Partial<ShapeData>,
							{ meta: after } as Partial<ShapeData>,
						),
					);
				}

				context.set("editingShapeId", null);
				context.set("metaSnapshot", null);
			},

			cancelEdit({ context, refs }) {
				const id = context.get("editingShapeId");
				if (!id) return;
				const prevMeta = context.get("metaSnapshot");
				const pluginCtx = refs.get("pluginCtx");
				const shape = pluginCtx.store.getShape(id);
				if (!shape) {
					context.set("editingShapeId", null);
					context.set("metaSnapshot", null);
					return;
				}

				pluginCtx.store.updateShape(id, {
					"x-domain-editing": false,
					meta: prevMeta ?? {},
				} as Partial<ShapeData>);

				context.set("editingShapeId", null);
				context.set("metaSnapshot", null);
			},
		},
	},
});

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) return false;
	for (const k of ka) {
		const va = a[k];
		const vb = b[k];
		if (Array.isArray(va) && Array.isArray(vb)) {
			if (va.length !== vb.length) return false;
			for (let i = 0; i < va.length; i++) {
				if (va[i] !== vb[i]) return false;
			}
			continue;
		}
		if (va !== vb) return false;
	}
	return true;
}

export function createDomainEditingService(pluginCtx: PluginContext) {
	const machine = new VanillaMachine(editingMachine);
	machine.refs.set("pluginCtx", pluginCtx);
	machine.start();

	return {
		send: machine.send,
		get editingShapeId() {
			return machine.context.get("editingShapeId");
		},
		matches(...values: string[]) {
			const state = machine.state.get();
			return values.some((v) => state === v || state.startsWith(`${v}.`));
		},
		stop() {
			const clickTimer = machine.refs.get("clickTimer");
			if (clickTimer != null) clearTimeout(clickTimer);
			machine.stop();
		},
	};
}
