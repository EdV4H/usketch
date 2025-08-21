import type { ActorRefFrom, AnyStateMachine } from "xstate";
import { assign, createActor, setup } from "xstate";

// === Tool Registry Machine (XState v5) ===
interface ToolManagerContext {
	availableTools: Map<string, AnyStateMachine>;
	currentToolId: string | null;
	currentToolActor: ActorRefFrom<any> | null;
	toolHistory: string[];
}

type ToolManagerEvent =
	| { type: "REGISTER_TOOL"; id: string; machine: AnyStateMachine }
	| { type: "ACTIVATE_TOOL"; toolId: string }
	| { type: "SWITCH_TOOL"; toolId: string }
	| { type: "FORWARD_EVENT"; payload: any }
	| { type: "DEACTIVATE" };

export const toolManagerMachine = setup({
	types: {
		context: {} as ToolManagerContext,
		events: {} as ToolManagerEvent,
	},
	actions: {
		registerTool: assign(({ context, event }) => {
			if (event.type === "REGISTER_TOOL") {
				const newTools = new Map(context.availableTools);
				newTools.set(event.id, event.machine);
				return {
					...context,
					availableTools: newTools,
				};
			}
			return context;
		}),

		activateTool: assign(({ context, event }) => {
			if (event.type !== "ACTIVATE_TOOL" && event.type !== "SWITCH_TOOL") return context;

			const toolId = event.type === "ACTIVATE_TOOL" ? event.toolId : event.toolId;
			const machine = context.availableTools.get(toolId);
			if (!machine) {
				console.error(`Tool ${toolId} not found`);
				return context;
			}

			// Stop current tool if exists
			if (context.currentToolActor) {
				// In v5, we need to properly stop the actor
				// stopChild is for child actors spawned within the machine
				// For external actors, we use the actor's stop method
				context.currentToolActor.stop?.();
			}

			// Create and start new tool actor
			const actor = createActor(machine);
			actor.start();

			return {
				...context,
				currentToolId: toolId,
				currentToolActor: actor,
				toolHistory: [...context.toolHistory, toolId],
			};
		}),

		deactivateCurrentTool: assign(({ context }) => {
			if (context.currentToolActor) {
				context.currentToolActor.stop?.();
			}

			return {
				...context,
				currentToolActor: null,
				currentToolId: null,
			};
		}),

		forwardToTool: ({ context, event }) => {
			if (event.type === "FORWARD_EVENT" && context.currentToolActor) {
				context.currentToolActor.send(event.payload);
			}
		},
	},
}).createMachine({
	id: "toolManager",

	context: {
		availableTools: new Map(),
		currentToolId: null,
		currentToolActor: null,
		toolHistory: [],
	},

	initial: "idle",

	states: {
		idle: {
			on: {
				REGISTER_TOOL: {
					actions: "registerTool",
				},

				ACTIVATE_TOOL: {
					target: "active",
					actions: "activateTool",
				},
			},
		},

		active: {
			on: {
				SWITCH_TOOL: {
					actions: ["deactivateCurrentTool", "activateTool"],
				},

				FORWARD_EVENT: {
					actions: "forwardToTool",
				},

				DEACTIVATE: {
					target: "idle",
					actions: "deactivateCurrentTool",
				},

				REGISTER_TOOL: {
					actions: "registerTool",
				},
			},
		},
	},
});

// Types for the createToolManager factory
interface CustomToolManagerContext {
	tools: Record<string, AnyStateMachine>;
	currentToolId: string | null;
	currentToolActor: any | null;
	activeTool: string | null;
}

type CustomToolManagerEvent =
	| { type: "REGISTER_TOOL"; id: string; machine: AnyStateMachine }
	| { type: "ACTIVATE_TOOL"; toolId: string }
	| { type: "SWITCH_TOOL"; tool: string }
	| { type: "DEACTIVATE" }
	| { type: "FORWARD_EVENT"; payload: any }
	| { type: "POINTER_DOWN"; position?: any; event?: any }
	| { type: "POINTER_MOVE"; position?: any; event?: any }
	| { type: "POINTER_UP"; position?: any; event?: any }
	| {
			type: "KEY_DOWN";
			key?: string;
			code?: string;
			shiftKey?: boolean;
			ctrlKey?: boolean;
			metaKey?: boolean;
			altKey?: boolean;
	  };

// Factory function to create a tool manager with custom tools
export function createToolManager(tools: Record<string, AnyStateMachine>) {
	return setup({
		types: {
			context: {} as CustomToolManagerContext,
			events: {} as CustomToolManagerEvent,
		},
		actions: {
			registerTool: assign(({ context, event }) => {
				if (event.type !== "REGISTER_TOOL") return {};
				return {
					tools: { ...context.tools, [event.id]: event.machine },
				};
			}),
			activateTool: assign(({ event }) => {
				if (event.type !== "ACTIVATE_TOOL") return {};
				// Spawn the tool actor
				const toolMachine = tools[event.toolId];
				if (!toolMachine) {
					console.warn(`Tool ${event.toolId} not found`);
					return {};
				}
				const toolActor = createActor(toolMachine);
				toolActor.start();
				return {
					currentToolId: event.toolId,
					currentToolActor: toolActor,
					activeTool: event.toolId,
				};
			}),
			switchTool: assign(({ context, event }) => {
				if (event.type !== "SWITCH_TOOL") return {};
				// Stop current tool if exists
				if (context.currentToolActor) {
					context.currentToolActor.stop();
				}
				// Start new tool
				const toolMachine = context.tools[event.tool];
				if (!toolMachine) {
					console.warn(`Tool ${event.tool} not found`);
					return {};
				}
				const toolActor = createActor(toolMachine);
				toolActor.start();
				return {
					currentToolId: event.tool,
					currentToolActor: toolActor,
					activeTool: event.tool,
				};
			}),
			deactivateTool: assign(() => ({
				currentToolId: null,
				currentToolActor: null,
				activeTool: null,
			})),
			forwardToTool: ({ context, event }) => {
				if (event.type !== "FORWARD_EVENT" || !context.currentToolActor) return;
				if (context.currentToolActor.getSnapshot().status === "active") {
					context.currentToolActor.send(event.payload);
				}
			},
		},
	}).createMachine({
		id: "toolManager",
		initial: "active",
		states: {
			active: {},
		},
		context: () => {
			// Start the first tool immediately
			const firstToolId = Object.keys(tools)[0];
			if (firstToolId && tools[firstToolId]) {
				const toolActor = createActor(tools[firstToolId]);
				toolActor.start();
				return {
					tools: tools,
					currentToolId: firstToolId,
					currentToolActor: toolActor,
					activeTool: firstToolId,
				};
			}
			return {
				tools: tools,
				currentToolId: null,
				currentToolActor: null,
				activeTool: null,
			};
		},
		on: {
			REGISTER_TOOL: {
				actions: "registerTool",
			},
			ACTIVATE_TOOL: {
				actions: "activateTool",
			},
			SWITCH_TOOL: {
				actions: "switchTool",
			},
			DEACTIVATE: {
				actions: "deactivateTool",
			},
			FORWARD_EVENT: {
				actions: "forwardToTool",
			},
			// Forward common events as FORWARD_EVENT
			POINTER_DOWN: {
				actions: ({ context, event }) => {
					if (
						context.currentToolActor &&
						context.currentToolActor.getSnapshot().status === "active"
					) {
						context.currentToolActor.send(event);
					}
				},
			},
			POINTER_MOVE: {
				actions: ({ context, event }) => {
					if (
						context.currentToolActor &&
						context.currentToolActor.getSnapshot().status === "active"
					) {
						context.currentToolActor.send(event);
					}
				},
			},
			POINTER_UP: {
				actions: ({ context, event }) => {
					if (
						context.currentToolActor &&
						context.currentToolActor.getSnapshot().status === "active"
					) {
						context.currentToolActor.send(event);
					}
				},
			},
			KEY_DOWN: {
				actions: ({ context, event }) => {
					if (
						context.currentToolActor &&
						context.currentToolActor.getSnapshot().status === "active"
					) {
						// Forward KEY_DOWN as ESCAPE if it's the Escape key
						if (event.type === "KEY_DOWN" && event.key === "Escape") {
							context.currentToolActor.send({ type: "ESCAPE" });
						} else {
							context.currentToolActor.send(event);
						}
					}
				},
			},
		},
	});
}
