import type { Command, CommandRegistry } from "@edv4h/usketch-shared";

const MAX_HISTORY = 100;

export function createCommandRegistry(): CommandRegistry {
	const undoStack: Command[] = [];
	const redoStack: Command[] = [];

	return {
		execute(command: Command): void {
			command.execute();
			undoStack.push(command);
			redoStack.length = 0;
			if (undoStack.length > MAX_HISTORY) {
				undoStack.shift();
			}
		},

		undo(): void {
			const command = undoStack.pop();
			if (command) {
				command.undo();
				redoStack.push(command);
			}
		},

		redo(): void {
			const command = redoStack.pop();
			if (command) {
				command.execute();
				undoStack.push(command);
			}
		},

		canUndo(): boolean {
			return undoStack.length > 0;
		},

		canRedo(): boolean {
			return redoStack.length > 0;
		},
	};
}
