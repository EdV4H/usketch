import type { CommandContext } from "@usketch/shared-types";
import type { ExtendedWhiteboardState } from "../../store";
import { whiteboardStore } from "../../store";
import { BaseCommand } from "../base-command";

/**
 * Z-index順序変更コマンド
 * レイヤーの順序を変更する（Undo/Redo対応）
 */
export class ReorderCommand extends BaseCommand {
	private newOrder: string[];
	private previousOrder: string[] = [];

	constructor(newOrder: string[]) {
		super("Reorder layers");
		this.newOrder = newOrder;
	}

	execute(context: CommandContext): void {
		const fullStore = whiteboardStore.getState();

		// 現在の順序を保存
		this.previousOrder = fullStore.zOrder ? [...fullStore.zOrder] : [];

		context.setState((draft) => {
			const draftStore = draft as ExtendedWhiteboardState;
			draftStore.zOrder = this.newOrder;
		});
	}

	undo(context: CommandContext): void {
		context.setState((draft) => {
			const draftStore = draft as ExtendedWhiteboardState;
			draftStore.zOrder = this.previousOrder;
		});
	}
}
