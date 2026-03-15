import type { Command, CommandRegistry } from "@edv4h/usketch-shared";

const MAX_HISTORY = 100;

export function createCommandRegistry(): CommandRegistry {
	const history: Command[] = [];
	let cursor = -1;

	return {
		execute(command: Command): void {
			// Discard redo history beyond cursor
			history.length = cursor + 1;
			command.execute();
			history.push(command);
			cursor++;
			if (history.length > MAX_HISTORY) {
				history.shift();
				cursor--;
			}
		},

		undo(): void {
			if (cursor < 0) return;
			history[cursor].undo();
			cursor--;
		},

		redo(): void {
			if (cursor >= history.length - 1) return;
			cursor++;
			history[cursor].execute();
		},

		canUndo(): boolean {
			return cursor >= 0;
		},

		canRedo(): boolean {
			return cursor < history.length - 1;
		},
	};
}
