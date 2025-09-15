import { whiteboardStore } from "@usketch/store";
import { createSelectTool } from "@usketch/tools";
import { createActor } from "xstate";

class ToolMachineSingleton {
	private static instance: ToolMachineSingleton;
	private selectToolActor: any = null;
	private currentTool: string | null = null;

	private constructor() {}

	static getInstance(): ToolMachineSingleton {
		if (!ToolMachineSingleton.instance) {
			ToolMachineSingleton.instance = new ToolMachineSingleton();
		}
		return ToolMachineSingleton.instance;
	}

	setCurrentTool(tool: string) {
		if (this.currentTool === tool) {
			return;
		}

		// Stop previous tool actor if exists
		if (this.selectToolActor) {
			this.selectToolActor.stop();
			this.selectToolActor = null;
		}

		this.currentTool = tool;

		// Create new actor for select tool
		if (tool === "select") {
			const selectToolMachine = createSelectTool();
			// Initialize with current selection from store
			const store = whiteboardStore.getState();
			const initialContext = {
				selectedIds: new Set(store.selectedShapeIds),
			};
			this.selectToolActor = createActor(selectToolMachine, {
				input: initialContext,
			});
			this.selectToolActor.start();
		}
	}

	sendEvent(event: any) {
		if (this.selectToolActor && this.currentTool === "select") {
			// Sync selection state from store before sending alignment events
			if (event.type?.startsWith("ALIGN_")) {
				const store = whiteboardStore.getState();
				const currentContext = this.selectToolActor.getSnapshot().context;
				if (currentContext.selectedIds.size !== store.selectedShapeIds.size) {
					// Update the actor's context with current selection
					this.selectToolActor.send({
						type: "UPDATE_SELECTION",
						selectedIds: new Set(store.selectedShapeIds),
					});
				}
			}
			this.selectToolActor.send(event);
		}
	}

	cleanup() {
		if (this.selectToolActor) {
			this.selectToolActor.stop();
			this.selectToolActor = null;
		}
		this.currentTool = null;
	}
}

export const toolMachineSingleton = ToolMachineSingleton.getInstance();
