// Registers the image resize controls on the Control HUD (no bespoke panel).
// `get` reads the selection and `set` calls the pure operations — no operation
// logic in the closures (per docs/plugin-system-design.md).
import type { PluginContext } from "@edv4h/usketch-shared";
import { getImageResizeMode } from "../image-resize.js";
import { getImageShapes, setImageFit, setImageResizeMode } from "../image-service.js";
import {
	DEFAULT_IMAGE_FIT,
	DEFAULT_IMAGE_RESIZE_MODE,
	type ImageFit,
	type ImageResizeMode,
} from "../types.js";

export function registerImageHud(ctx: PluginContext): () => void {
	const firstSelectedImage = () => getImageShapes(ctx.store, ctx.store.getSelection())[0];

	return ctx.hud.registerSettings({
		id: "usketch-plugin-shape-image:resize",
		label: "画像のリサイズ（選択中の画像）",
		fields: [
			{
				name: "resizeMode",
				label: "リサイズ",
				type: "enum",
				options: [
					{ value: "keep-aspect", label: "比率固定" },
					{ value: "free", label: "自由" },
				],
			},
			{
				name: "fit",
				label: "収まり方（自由のとき）",
				type: "enum",
				options: [
					{ value: "contain", label: "余白あり" },
					{ value: "cover", label: "トリミング" },
					{ value: "fill", label: "引き伸ばし" },
				],
			},
		],
		get: (name) => {
			const image = firstSelectedImage();
			if (name === "resizeMode")
				return image ? getImageResizeMode(image) : DEFAULT_IMAGE_RESIZE_MODE;
			if (name === "fit") return image?.fit ?? DEFAULT_IMAGE_FIT;
			return undefined;
		},
		set: (name, value) => {
			const ids = ctx.store.getSelection();
			const cmd =
				name === "resizeMode"
					? setImageResizeMode(ctx.store, ids, value as ImageResizeMode)
					: name === "fit"
						? setImageFit(ctx.store, ids, value as ImageFit)
						: null;
			if (cmd) ctx.commands.execute(cmd);
		},
		subscribe: (listener) => ctx.store.subscribe(listener),
	});
}
