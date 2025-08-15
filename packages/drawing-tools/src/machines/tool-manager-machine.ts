import { assign, createMachine, interpret } from "xstate";
import { drawingToolMachine, rectangleToolMachine } from "./drawing-tool-machine";
import { selectToolMachine } from "./select-tool-machine";
import type { ToolManagerContext, ToolRegistration } from "./types";

// === Tool Manager Events ===
export type ToolManagerEvent =
	| { type: "REGISTER_TOOL"; id: string; machine: any; registration: ToolRegistration }
	| { type: "UNREGISTER_TOOL"; id: string }
	| { type: "ACTIVATE_TOOL"; toolId: string }
	| { type: "SWITCH_TOOL"; toolId: string }
	| { type: "FORWARD_EVENT"; payload: any }
	| { type: "DEACTIVATE" }
	| { type: "UPDATE_SETTINGS"; settings: Partial<ToolManagerContext["settings"]> };

// === Tool Manager State Machine ===
export const toolManagerMachine = createMachine(
	{
		id: "toolManager",
		types: {} as {
			context: ToolManagerContext;
			events: ToolManagerEvent;
		},

		context: {
			availableTools: new Map(),
			currentToolId: null,
			currentToolActor: null,
			toolHistory: [],
			settings: {
				gridSize: 10,
				snapToGrid: false,
				showGuidelines: false,
				smoothing: true,
				pressure: false,
			},
		},

		initial: "idle",

		states: {
			idle: {
				entry: "registerDefaultTools",

				on: {
					REGISTER_TOOL: {
						actions: "registerTool",
					},

					UNREGISTER_TOOL: {
						actions: "unregisterTool",
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

					UNREGISTER_TOOL: {
						actions: "unregisterTool",
					},

					UPDATE_SETTINGS: {
						actions: "updateSettings",
					},
				},
			},
		},
	},
	{
		actions: {
			// Register default tools on initialization
			registerDefaultTools: assign({
				availableTools: (context: any) => {
					const tools = new Map<string, ToolRegistration>(context.availableTools);

					// Register built-in tools
					tools.set("select", {
						id: "select",
						name: "Select Tool",
						icon: "cursor",
						machine: selectToolMachine,
						category: "select",
					});

					tools.set("draw", {
						id: "draw",
						name: "Drawing Tool",
						icon: "pencil",
						machine: drawingToolMachine,
						category: "draw",
					});

					tools.set("rectangle", {
						id: "rectangle",
						name: "Rectangle Tool",
						icon: "square",
						machine: rectangleToolMachine,
						category: "shape",
					});

					return tools;
				},
			}),

			// Register a new tool
			registerTool: assign({
				availableTools: (context: any, event: any) => {
					if (event.type !== "REGISTER_TOOL") return context.availableTools;

					const tools = new Map(context.availableTools);
					tools.set(event.id, event.registration);

					console.log(`Tool registered: ${event.id}`);

					return tools;
				},
			}),

			// Unregister a tool
			unregisterTool: assign({
				availableTools: (context: any, event: any) => {
					if (event.type !== "UNREGISTER_TOOL") return context.availableTools;

					const tools = new Map(context.availableTools);

					// Don't allow unregistering the current tool
					if (context.currentToolId === event.id) {
						console.warn(`Cannot unregister active tool: ${event.id}`);
						return context.availableTools;
					}

					tools.delete(event.id);
					console.log(`Tool unregistered: ${event.id}`);

					return tools;
				},
			}),

			// Activate a tool
			activateTool: assign((context: any, event: any) => {
				if (event.type !== "ACTIVATE_TOOL" && event.type !== "SWITCH_TOOL") return {};

				const toolId = event.toolId;
				const registration = context.availableTools.get(toolId);

				if (!registration) {
					console.error(`Tool ${toolId} not found`);
					return {};
				}

				// Stop current tool if exists
				if (context.currentToolActor) {
					context.currentToolActor.stop?.();
				}

				// Create new tool actor
				const actor = interpret(registration.machine).start();

				console.log(`Tool activated: ${toolId}`);

				return {
					currentToolId: toolId,
					currentToolActor: actor,
					toolHistory: [...context.toolHistory, toolId].slice(-10), // Keep last 10 tools
				};
			}),

			// Deactivate current tool
			deactivateCurrentTool: assign((context: any) => {
				if (context.currentToolActor) {
					context.currentToolActor.stop?.();
					console.log(`Tool deactivated: ${context.currentToolId}`);
				}

				return {
					currentToolId: null,
					currentToolActor: null,
				};
			}),

			// Forward event to current tool
			forwardToTool: ({ context, event }) => {
				if (!event || event.type !== "FORWARD_EVENT") return;

				if (context.currentToolActor) {
					context.currentToolActor.send(event.payload);
				} else {
					console.warn("No active tool to forward event to");
				}
			},

			// Update settings
			updateSettings: assign((context: any, event: any) => {
				if (!event || event.type !== "UPDATE_SETTINGS") return {};

				return {
					settings: {
						...context.settings,
						...(event as any).settings,
					},
				};
			}),
		},
	},
);

// === Tool Manager Service Class ===
export class ToolManager {
	private service: any;
	private listeners: Map<string, (state: any) => void> = new Map();

	constructor() {
		this.service = interpret(toolManagerMachine).start();

		// Subscribe to state changes
		this.service.subscribe((state: any) => {
			this.notifyListeners(state);
		});
	}

	// Register a custom tool
	register(id: string, registration: ToolRegistration) {
		this.service.send({
			type: "REGISTER_TOOL",
			id,
			machine: registration.machine,
			registration,
		});
	}

	// Unregister a tool
	unregister(id: string) {
		this.service.send({ type: "UNREGISTER_TOOL", id });
	}

	// Activate a tool
	activate(toolId: string) {
		const currentState = this.service.getSnapshot();

		if (currentState.matches("idle")) {
			this.service.send({ type: "ACTIVATE_TOOL", toolId });
		} else {
			this.service.send({ type: "SWITCH_TOOL", toolId });
		}
	}

	// Send event to current tool
	send(event: any) {
		this.service.send({ type: "FORWARD_EVENT", payload: event });
	}

	// Get current tool ID
	getCurrentToolId(): string | null {
		return this.service.getSnapshot().context.currentToolId;
	}

	// Get available tools
	getAvailableTools(): Map<string, ToolRegistration> {
		return this.service.getSnapshot().context.availableTools;
	}

	// Get tool history
	getToolHistory(): string[] {
		return this.service.getSnapshot().context.toolHistory;
	}

	// Get settings
	getSettings(): ToolManagerContext["settings"] {
		return this.service.getSnapshot().context.settings;
	}

	// Update settings
	updateSettings(settings: Partial<ToolManagerContext["settings"]>) {
		this.service.send({ type: "UPDATE_SETTINGS", settings });
	}

	// Subscribe to state changes
	subscribe(id: string, callback: (state: any) => void) {
		this.listeners.set(id, callback);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(id);
		};
	}

	private notifyListeners(state: any) {
		this.listeners.forEach((callback) => callback(state));
	}

	// Get the XState service (for debugging)
	getService() {
		return this.service;
	}

	// Destroy the manager
	destroy() {
		this.service.stop();
		this.listeners.clear();
	}
}

// === Singleton instance ===
let toolManagerInstance: ToolManager | null = null;

export function getToolManager(): ToolManager {
	if (!toolManagerInstance) {
		toolManagerInstance = new ToolManager();
	}
	return toolManagerInstance;
}

export function resetToolManager() {
	if (toolManagerInstance) {
		toolManagerInstance.destroy();
		toolManagerInstance = null;
	}
}
