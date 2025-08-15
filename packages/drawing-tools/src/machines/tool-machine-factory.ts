import { assign, createMachine } from "xstate";
import type { ToolContext, ToolEvent, ToolMachineConfig } from "./types";

/**
 * Factory function to create tool state machines with common configuration
 */
export function createToolMachine<
	TContext extends ToolContext = ToolContext,
	TEvent extends ToolEvent = ToolEvent,
>(config: ToolMachineConfig<TContext>) {
	return createMachine(
		{
			id: config.id,
			predictableActionArguments: true,
			preserveActionOrder: true,

			context: {
				cursor: "default",
				selectedIds: new Set(),
				hoveredId: null,
				...config.context,
			} as TContext,

			// Global event handlers that all tools share
			on: {
				CANCEL: {
					target: ".idle",
					actions: "handleCancel",
				},
				ESCAPE: {
					target: ".idle",
					actions: "handleEscape",
				},
			},

			states: config.states,
		},
		{
			actions: {
				// Default actions that can be overridden
				handleCancel: () => {
					console.log("Tool cancelled");
				},
				handleEscape: () => {
					console.log("Escape pressed");
				},
				setCursor: assign({
					cursor: (_, event: any) => event.cursor || "default",
				}),
				...config.actions,
			},
			guards: {
				// Default guards that can be overridden
				hasSelection: (context) => context.selectedIds.size > 0,
				...config.guards,
			},
			services: config.services || {},
		},
	);
}

/**
 * Helper function to create a simple tool machine
 */
export function createSimpleToolMachine(id: string, states: any, actions?: any) {
	return createToolMachine({
		id,
		states,
		actions,
	});
}
