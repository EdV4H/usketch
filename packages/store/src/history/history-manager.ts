import type { Command, CommandContext } from "@usketch/shared-types";
import { nanoid } from "nanoid";

export interface HistoryOptions {
	maxSize?: number;
	mergeThreshold?: number;
}

export interface BatchCommand extends Command {
	commands: Command[];
}

export class HistoryManager {
	private commands: Command[] = [];
	private currentIndex: number = -1;
	private readonly maxSize: number;
	private readonly mergeThreshold: number;
	private batchMode: boolean = false;
	private batchCommands: Command[] = [];
	private batchDescription: string = "";

	constructor(options: HistoryOptions = {}) {
		this.maxSize = options.maxSize ?? 100;
		this.mergeThreshold = options.mergeThreshold ?? 1000;
	}

	execute(command: Command, context: CommandContext): void {
		if (this.batchMode) {
			this.batchCommands.push(command);
			command.execute(context);
			return;
		}

		// Check if we can merge with the last command
		if (this.currentIndex >= 0 && this.currentIndex < this.commands.length) {
			const lastCommand = this.commands[this.currentIndex];
			if (
				lastCommand?.canMerge &&
				command.canMerge &&
				command.timestamp - lastCommand.timestamp < this.mergeThreshold &&
				lastCommand.canMerge(command)
			) {
				// Execute the new command first
				command.execute(context);

				// Then merge it with the last command
				const mergedCommand = lastCommand.merge!(command);
				this.commands[this.currentIndex] = mergedCommand;
				return;
			}
		}

		// Execute the command
		command.execute(context);

		// Remove any commands after currentIndex (redo stack)
		if (this.currentIndex < this.commands.length - 1) {
			this.commands = this.commands.slice(0, this.currentIndex + 1);
		}

		// Add the new command
		this.commands.push(command);
		this.currentIndex++;

		// Limit history size
		if (this.commands.length > this.maxSize) {
			const removeCount = this.commands.length - this.maxSize;
			this.commands = this.commands.slice(removeCount);
			this.currentIndex -= removeCount;
		}
	}

	undo(context: CommandContext): boolean {
		if (!this.canUndo) {
			return false;
		}

		const command = this.commands[this.currentIndex];
		if (command) {
			command.undo(context);
			this.currentIndex--;
			return true;
		}
		return false;
	}

	redo(context: CommandContext): boolean {
		if (!this.canRedo) {
			return false;
		}

		this.currentIndex++;
		const command = this.commands[this.currentIndex];
		if (command) {
			if (command.redo) {
				command.redo(context);
			} else {
				command.execute(context);
			}
			return true;
		}
		return false;
	}

	beginBatch(description?: string): void {
		if (this.batchMode) {
			console.warn(
				`beginBatch called when already in batch mode. Current batch: "${this.batchDescription}", commands: ${this.batchCommands.length}`,
			);
			return;
		}
		this.batchMode = true;
		this.batchCommands = [];
		this.batchDescription = description ?? "Batch operation";
	}

	endBatch(context: CommandContext): void {
		if (!this.batchMode) {
			console.warn(
				`endBatch called when not in batch mode. Current batchMode: ${this.batchMode}, batchCommands length: ${this.batchCommands?.length ?? 0}, batchDescription: "${this.batchDescription ?? ""}"`,
			);
			return;
		}

		this.batchMode = false;

		if (this.batchCommands.length === 0) {
			return;
		}

		if (this.batchCommands.length === 1) {
			// Single command, no need for batch
			const command = this.batchCommands[0];
			if (command) {
				this.execute(command, context);
			}
			return;
		}

		// Create a batch command - capture batchCommands in closure
		const commands = [...this.batchCommands];
		const batchCommand: BatchCommand = {
			id: nanoid(),
			timestamp: Date.now(),
			description: this.batchDescription,
			commands: commands,
			execute: (_ctx: CommandContext) => {
				// Already executed during batch mode
			},
			undo: (ctx: CommandContext) => {
				// Undo in reverse order
				for (let i = commands.length - 1; i >= 0; i--) {
					const cmd = commands[i];
					if (cmd) {
						cmd.undo(ctx);
					}
				}
			},
			redo: (ctx: CommandContext) => {
				// Redo in forward order
				for (const cmd of commands) {
					if (cmd.redo) {
						cmd.redo(ctx);
					} else {
						cmd.execute(ctx);
					}
				}
			},
		};

		// Add batch command to history without executing (already executed)
		if (this.currentIndex < this.commands.length - 1) {
			this.commands = this.commands.slice(0, this.currentIndex + 1);
		}

		this.commands.push(batchCommand);
		this.currentIndex++;

		// Limit history size
		if (this.commands.length > this.maxSize) {
			const removeCount = this.commands.length - this.maxSize;
			this.commands = this.commands.slice(removeCount);
			this.currentIndex -= removeCount;
		}

		this.batchCommands = [];
		this.batchDescription = "";
	}

	clear(): void {
		this.commands = [];
		this.currentIndex = -1;
		this.batchMode = false;
		this.batchCommands = [];
		this.batchDescription = "";
	}

	get canUndo(): boolean {
		return this.currentIndex >= 0;
	}

	get canRedo(): boolean {
		return this.currentIndex < this.commands.length - 1;
	}

	get commandHistory(): ReadonlyArray<Command> {
		return this.commands;
	}

	get commandCount(): number {
		return this.commands.length;
	}

	get currentCommandIndex(): number {
		return this.currentIndex;
	}
}
