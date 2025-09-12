import { assign, setup } from "xstate";
import type { ToolContext, ToolEvent } from "../types/index";

// === XState v5: Setup API を使用したTool Machine Factory ===
export function createToolMachine<
	TContext extends ToolContext = ToolContext,
	TEvent extends ToolEvent = ToolEvent,
>(config: {
	id: string;
	context?: Partial<TContext>;
	states: any;
	actions?: Record<string, any>;
	guards?: Record<string, any>;
	actors?: Record<string, any>;
}) {
	// v5: setup APIで型安全性を向上
	return setup({
		types: {
			context: {} as TContext,
			events: {} as TEvent,
		},
		actions: {
			// Default actions with proper typing
			resetCursor: assign({
				cursor: () => "default",
			} as any),
			setCursor: assign(
				({ event }: any) =>
					({
						cursor: event.cursor || "default",
					}) as any,
			),
			...(config.actions || {}),
		},
		guards: {
			// Default guards
			always: () => true,
			never: () => false,
			...config.guards,
		},
		actors: config.actors || {},
	}).createMachine({
		id: config.id,

		context: {
			cursor: "default",
			selectedIds: new Set(),
			hoveredId: null,
			...config.context,
		} as TContext,

		states: config.states,
	});
}
