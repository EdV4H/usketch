import { type ShapeSpec, type VimConfig, type VimConfigInput, VimConfigSchema } from "./schema.js";

/**
 * insert モードの既定マッピング（短い別名 → shape）。
 * ここに無い文字列は `ctx.shapes.getAll()` の型名そのもので自動補完される
 * （例 "ellipse" や "triangle" はマップ不要で打てる）。
 */
export const DEFAULT_SHAPE_MAP: Record<string, ShapeSpec> = {
	rect: { type: "rectangle", width: 120, height: 80, label: "Rectangle" },
	box: { type: "rectangle", width: 120, height: 80, label: "Rectangle" },
	text: { type: "text", label: "Text" },
	note: { type: "sticky", meta: { stickyColor: "#fef08a" }, label: "Sticky note" },
	sticky: { type: "sticky", meta: { stickyColor: "#fef08a" }, label: "Sticky note" },
	circle: { type: "ellipse", width: 100, height: 100, label: "Ellipse" },
	line: { type: "line", label: "Line" },
	arrow: { type: "arrow", label: "Arrow" },
	diamond: { type: "diamond", label: "Diamond" },
	star: { type: "star", label: "Star" },
	tri: { type: "triangle", label: "Triangle" },
	frame: { type: "frame", width: 320, height: 240, label: "Frame" },
};

/**
 * 部分設定を既定値とディープマージして検証済みの {@link VimConfig} を返す。
 * `shapeMap` と `keymap` は「上書き」ではなく「マージ」する（既定の別名を保ったまま
 * 追加・変更できる）。それ以外のスカラ値は上書き。
 */
export function parseVimConfig(input?: VimConfigInput): VimConfig {
	const raw = input ?? {};
	const merged: VimConfigInput = {
		...raw,
		shapeMap: { ...DEFAULT_SHAPE_MAP, ...(raw.shapeMap ?? {}) },
		keymap: raw.keymap ?? {},
	};
	return VimConfigSchema.parse(merged);
}
