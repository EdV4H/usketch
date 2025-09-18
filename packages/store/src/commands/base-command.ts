import type { Command, CommandContext } from "@usketch/shared-types";
import { nanoid } from "nanoid";

export abstract class BaseCommand implements Command {
	readonly id: string;
	readonly timestamp: number;
	readonly description: string;

	constructor(description: string) {
		this.id = nanoid();
		this.timestamp = Date.now();
		this.description = description;
	}

	abstract execute(context: CommandContext): void;
	abstract undo(context: CommandContext): void;

	redo(context: CommandContext): void {
		this.execute(context);
	}

	canMerge?(_other: Command): boolean {
		return false;
	}

	merge?(_other: Command): Command {
		throw new Error("Merge not implemented for this command");
	}
}
