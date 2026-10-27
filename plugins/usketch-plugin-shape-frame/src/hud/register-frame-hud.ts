// Registers the frame delete option on the Control HUD (no bespoke panel).
// `get` reads the selection and `set` calls the pure operation — no operation
// logic in the closures (per docs/plugin-system-design.md).
import type { PluginContext } from "@edv4h/usketch-shared";
import {
	getFrameShapes,
	setFrameDeleteContents,
	shouldDeleteFrameContents,
} from "../frame-service.js";

export function registerFrameHud(ctx: PluginContext): () => void {
	const firstSelectedFrame = () => getFrameShapes(ctx.store, ctx.store.getSelection())[0];

	return ctx.hud.registerSettings({
		id: "usketch-plugin-shape-frame:delete",
		label: "フレームの削除（選択中のフレーム）",
		fields: [{ name: "deleteContents", label: "削除時に中身も削除", type: "boolean" }],
		get: (name) => {
			if (name !== "deleteContents") return undefined;
			const frame = firstSelectedFrame();
			return frame ? shouldDeleteFrameContents(frame) : true;
		},
		set: (name, value) => {
			if (name !== "deleteContents") return;
			const cmd = setFrameDeleteContents(
				ctx.store,
				ctx.store.getSelection(),
				value === true || value === "true",
			);
			if (cmd) ctx.commands.execute(cmd);
		},
		subscribe: (listener) => ctx.store.subscribe(listener),
	});
}
