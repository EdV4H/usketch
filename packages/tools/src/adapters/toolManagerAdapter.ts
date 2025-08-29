import type { Point, Shape } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type { Actor, AnyStateMachine } from "xstate";
import { createActor } from "xstate";
import { createToolManager } from "../machines/toolManager";
import type { ToolConfig, ToolManagerOptions } from "../schemas";
import { formatToolConfigError, ToolManagerOptionsSchema, validateToolConfig } from "../schemas";
import { ToolValidationError } from "../utils/error-handler";
import { getShapeAtPoint } from "../utils/geometry";

/**
 * ToolManager with external configuration support and validation
 */
export class ToolManager {
	private toolManagerActor: Actor<AnyStateMachine>;
	private currentToolId: string;
	private toolConfigs: Map<string, ToolConfig>;
	private options: ToolManagerOptions;

	constructor(options: unknown) {
		// Validate options with Zod
		const validationResult = ToolManagerOptionsSchema.safeParse(options);
		if (!validationResult.success) {
			throw new ToolValidationError(
				`Invalid ToolManager options: ${formatToolConfigError(validationResult.error)}`,
				validationResult.error,
			);
		}

		this.options = validationResult.data;
		this.toolConfigs = new Map();

		// Store and validate tool configurations
		validationResult.data.tools.forEach((config) => {
			if (config.enabled !== false) {
				this.validateAndAddToolConfig(config);
			}
		});

		// Ensure at least one tool is enabled
		if (this.toolConfigs.size === 0) {
			throw new Error("At least one enabled tool is required");
		}

		// Create tool machines object for XState
		const toolMachines = Object.fromEntries(
			Array.from(this.toolConfigs.entries()).map(([id, config]) => [id, config.machine]),
		);

		// Create and start the tool manager machine
		const toolManagerMachine = createToolManager(toolMachines);
		this.toolManagerActor = createActor(toolManagerMachine);
		this.toolManagerActor.start();

		// Subscribe to tool changes
		this.toolManagerActor.subscribe((state) => {
			const activeToolId = state.context.activeTool;
			if (activeToolId !== this.currentToolId && activeToolId) {
				const previousToolId = this.currentToolId;
				this.currentToolId = activeToolId;

				// Call tool change callback if provided
				if (this.options.onToolChange) {
					(this.options.onToolChange as (toolId: string) => void)(activeToolId);
				}
			}
		});

		// Set default tool
		const defaultToolId = this.validateDefaultToolId(
			this.options.defaultToolId || this.options.tools[0]?.id,
		);
		this.currentToolId = defaultToolId;
		this.setActiveTool(defaultToolId);
	}

	private validateAndAddToolConfig(config: ToolConfig): void {
		// Check for duplicates if not allowed
		if (!this.options.allowDuplicates && this.toolConfigs.has(config.id)) {
			throw new Error(`Tool with id "${config.id}" already exists`);
		}

		this.toolConfigs.set(config.id, config);
	}

	private validateDefaultToolId(toolId: string | undefined): string {
		if (!toolId) {
			const firstTool = Array.from(this.toolConfigs.keys())[0];
			if (!firstTool) {
				throw new Error("No tools available to set as default");
			}
			return firstTool;
		}

		if (!this.toolConfigs.has(toolId)) {
			throw new Error(`Default tool "${toolId}" not found in available tools`);
		}

		return toolId;
	}

	// Tool management methods
	setActiveTool(toolId: string, updateStore = true): void {
		const previousToolId = this.currentToolId;
		const previousTool = this.toolConfigs.get(previousToolId);
		const nextTool = this.toolConfigs.get(toolId);

		if (!nextTool) {
			throw new Error(`Tool "${toolId}" not found`);
		}

		// Execute previous tool's deactivate behavior
		if (previousTool?.behaviors?.onDeactivate) {
			previousTool.behaviors.onDeactivate({
				store: whiteboardStore.getState(),
				nextToolId: toolId,
			});
		}

		// Send switch event to XState machine
		this.toolManagerActor.send({
			type: "SWITCH_TOOL",
			tool: toolId,
		});

		// Execute new tool's activate behavior
		if (nextTool.behaviors?.onActivate) {
			nextTool.behaviors.onActivate({
				store: whiteboardStore.getState(),
				previousToolId,
			});
		}

		// Update state
		this.currentToolId = toolId;
		if (updateStore) {
			whiteboardStore.setState({ currentTool: toolId });
		}
	}

	getActiveTool(): string {
		return this.currentToolId;
	}

	// Dynamic tool management
	addTool(config: unknown): void {
		const validationResult = validateToolConfig(config);

		if (this.options.validateOnAdd && !validationResult.success) {
			throw new ToolValidationError(
				`Invalid tool configuration: ${formatToolConfigError(validationResult.error)}`,
				validationResult.error,
			);
		}

		const validatedConfig = validationResult.success
			? validationResult.data
			: (config as ToolConfig);

		this.validateAndAddToolConfig(validatedConfig);

		// Register with XState machine
		this.toolManagerActor.send({
			type: "REGISTER_TOOL",
			id: validatedConfig.id,
			machine: validatedConfig.machine,
		});
	}

	removeTool(toolId: string): void {
		if (!this.toolConfigs.has(toolId)) {
			console.warn(`Tool "${toolId}" not found`);
			return;
		}

		// Switch to another tool if removing the active one
		if (this.currentToolId === toolId) {
			const nextTool = Array.from(this.toolConfigs.keys()).find((id) => id !== toolId);
			if (nextTool) {
				this.setActiveTool(nextTool);
			}
		}

		this.toolConfigs.delete(toolId);
	}

	// Tool configuration access
	getAvailableTools(): ToolConfig[] {
		return Array.from(this.toolConfigs.values());
	}

	getToolConfig(toolId: string): ToolConfig | undefined {
		return this.toolConfigs.get(toolId);
	}

	updateToolConfig(toolId: string, updates: Partial<ToolConfig>): void {
		const existing = this.toolConfigs.get(toolId);
		if (!existing) {
			throw new Error(`Tool "${toolId}" not found`);
		}

		const updated = { ...existing, ...updates };
		const validationResult = validateToolConfig(updated);

		if (!validationResult.success) {
			throw new ToolValidationError(
				`Invalid tool configuration update: ${formatToolConfigError(validationResult.error)}`,
				validationResult.error,
			);
		}

		this.toolConfigs.set(toolId, validationResult.data);
	}

	// Get preview shape from the current tool
	getPreviewShape(): Shape | null {
		const currentTool = this.toolConfigs.get(this.currentToolId);
		if (!currentTool) return null;

		const snapshot = this.toolManagerActor.getSnapshot();
		const toolActor = snapshot.context.currentToolActor;
		if (toolActor) {
			const toolSnapshot = toolActor.getSnapshot();
			return toolSnapshot.context.previewShape;
		}
		return null;
	}

	// Event handling with behaviors support
	handlePointerDown(event: PointerEvent, worldPos: Point): void {
		const currentTool = this.toolConfigs.get(this.currentToolId);

		// Execute tool-specific pre-processing
		if (currentTool?.behaviors?.beforePointerDown) {
			const handled = currentTool.behaviors.beforePointerDown({
				event,
				worldPos,
				store: whiteboardStore.getState(),
			});

			// Skip default processing if tool handled the event
			if (handled) return;
		}

		// Default processing - send to XState machine
		const shape = getShapeAtPoint(worldPos);
		const shapeId = shape?.id;

		this.toolManagerActor.send({
			type: "POINTER_DOWN" as const,
			point: worldPos,
			position: worldPos, // For compatibility
			target: shapeId,
			event: event,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		});
	}

	handlePointerMove(event: PointerEvent, worldPos: Point): void {
		const currentTool = this.toolConfigs.get(this.currentToolId);

		// Execute tool-specific pre-processing
		if (currentTool?.behaviors?.beforePointerMove) {
			const handled = currentTool.behaviors.beforePointerMove({
				event,
				worldPos,
				store: whiteboardStore.getState(),
			});

			if (handled) return;
		}

		// Default processing
		this.toolManagerActor.send({
			type: "POINTER_MOVE" as const,
			point: worldPos,
			position: worldPos,
			event: event,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		});
	}

	handlePointerUp(event: PointerEvent, worldPos: Point): void {
		const currentTool = this.toolConfigs.get(this.currentToolId);

		// Execute tool-specific pre-processing
		if (currentTool?.behaviors?.beforePointerUp) {
			const handled = currentTool.behaviors.beforePointerUp({
				event,
				worldPos,
				store: whiteboardStore.getState(),
			});

			if (handled) return;
		}

		// Default processing
		this.toolManagerActor.send({
			type: "POINTER_UP" as const,
			point: worldPos,
			position: worldPos,
			event: event,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		});

		// Check if tool created a shape (for compatibility with legacy behavior)
		if (typeof window !== "undefined" && window.__lastCreatedShape) {
			const shape = window.__lastCreatedShape;
			delete window.__lastCreatedShape;

			// Execute onShapeCreated behavior if defined
			if (currentTool?.behaviors?.onShapeCreated) {
				currentTool.behaviors.onShapeCreated({
					shape,
					store: whiteboardStore.getState(),
				});
			} else {
				// Default behavior - add to store
				whiteboardStore.getState().addShape(shape);
			}
		}
	}

	handleKeyDown(event: KeyboardEvent): void {
		const currentTool = this.toolConfigs.get(this.currentToolId);

		// Execute tool-specific pre-processing
		if (currentTool?.behaviors?.beforeKeyDown) {
			const handled = currentTool.behaviors.beforeKeyDown({
				event,
				store: whiteboardStore.getState(),
			});

			if (handled) return;
		}

		// Default processing
		this.toolManagerActor.send({
			type: "KEY_DOWN",
			key: event.key,
			code: event.code,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
		});
	}

	handleKeyUp(event: KeyboardEvent): void {
		// Currently no tool has keyUp behaviors, but send to XState machine
		this.toolManagerActor.send({
			type: "KEY_UP",
			key: event.key,
			code: event.code,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
		});
	}

	// Clean up method
	destroy(): void {
		// Execute deactivate for current tool
		const currentTool = this.toolConfigs.get(this.currentToolId);
		if (currentTool?.behaviors?.onDeactivate) {
			currentTool.behaviors.onDeactivate({
				store: whiteboardStore.getState(),
				nextToolId: "", // No next tool
			});
		}

		this.toolManagerActor.stop();
	}
}
