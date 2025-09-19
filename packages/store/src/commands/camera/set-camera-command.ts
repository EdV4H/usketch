import type { Camera, Command, CommandContext } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class SetCameraCommand extends BaseCommand {
	private previousCamera?: Camera;

	constructor(private camera: Partial<Camera>) {
		super("Set camera position");
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		// Save previous camera state for undo
		this.previousCamera = { ...state.camera };

		context.setState((state) => {
			state.camera = { ...state.camera, ...this.camera };
		});
	}

	undo(context: CommandContext): void {
		if (this.previousCamera) {
			context.setState((state) => {
				state.camera = this.previousCamera as Camera;
			});
		}
	}

	override canMerge(other: Command): boolean {
		if (!(other instanceof SetCameraCommand)) return false;

		// Merge camera movements within 500ms for smooth panning/zooming
		const timeDiff = other.timestamp - this.timestamp;
		return timeDiff < 500;
	}

	override merge(other: Command): Command {
		if (!(other instanceof SetCameraCommand)) {
			throw new Error("Cannot merge with non-SetCameraCommand");
		}

		// Create new command with merged camera state
		const mergedCommand = new SetCameraCommand({
			...this.camera,
			...other.camera,
		});

		// Preserve the original previous state for proper undo
		if (this.previousCamera) {
			mergedCommand.previousCamera = this.previousCamera;
		}

		return mergedCommand;
	}
}
