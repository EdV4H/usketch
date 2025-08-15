import type { ActorRefFrom, AnyStateMachine } from "xstate";
import { assign, createActor, setup } from "xstate";
import { drawingToolMachine } from "./drawingTool";
import { selectToolMachine } from "./selectTool";

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

// === Tool Manager Service (XState v5) ===
export class ToolManager {
	private actor: ActorRefFrom<typeof toolManagerMachine>;

	constructor() {
		this.actor = createActor(toolManagerMachine);
		this.actor.subscribe((snapshot) => {
			console.log("Tool Manager State:", snapshot.value);
			console.log("Current Tool:", snapshot.context.currentToolId);
		});
		this.actor.start();

		// Register default tools
		this.registerDefaultTools();
	}

	private registerDefaultTools() {
		this.register("select", selectToolMachine);
		this.register("draw", drawingToolMachine);
		// Add more tools as they are implemented
		// this.register('rectangle', rectangleToolMachine);
		// this.register('ellipse', ellipseToolMachine);
		// this.register('arrow', arrowToolMachine);
		// this.register('text', textToolMachine);
	}

	register(id: string, machine: AnyStateMachine) {
		this.actor.send({ type: "REGISTER_TOOL", id, machine });
	}

	activate(toolId: string) {
		this.actor.send({ type: "ACTIVATE_TOOL", toolId });
	}

	switch(toolId: string) {
		this.actor.send({ type: "SWITCH_TOOL", toolId });
	}

	deactivate() {
		this.actor.send({ type: "DEACTIVATE" });
	}

	send(event: any) {
		this.actor.send({ type: "FORWARD_EVENT", payload: event });
	}

	getCurrentTool(): string | null {
		return this.actor.getSnapshot().context.currentToolId;
	}

	getSnapshot() {
		return this.actor.getSnapshot();
	}

	subscribe(callback: (snapshot: any) => void) {
		return this.actor.subscribe(callback);
	}
}

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
	| { type: "POINTER_UP"; position?: any; event?: any };

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
			activateTool: assign(({ context, event }) => {
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
				const toolMachine = tools[event.tool];
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
				context.currentToolActor.send(event.payload);
			},
		},
	}).createMachine({
		id: "toolManager",
		context: {
			tools,
			currentToolId: null,
			currentToolActor: null,
			activeTool: Object.keys(tools)[0] || null,
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
					if (context.currentToolActor) {
						context.currentToolActor.send(event);
					}
				},
			},
			POINTER_MOVE: {
				actions: ({ context, event }) => {
					if (context.currentToolActor) {
						context.currentToolActor.send(event);
					}
				},
			},
			POINTER_UP: {
				actions: ({ context, event }) => {
					if (context.currentToolActor) {
						context.currentToolActor.send(event);
					}
				},
			},
		},
	});
}
