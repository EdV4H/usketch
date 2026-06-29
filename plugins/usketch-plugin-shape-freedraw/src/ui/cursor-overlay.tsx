import type { Point, Viewport } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { penMeta } from "../pen-meta.js";
import type { FreedrawSettingsStore } from "../settings-store.js";

/** ポインタの world 位置（ペン先カーソル用）。null=非表示。 */
export interface PointerStore {
	getSnapshot(): Point | null;
	subscribe(listener: () => void): () => void;
	set(world: Point | null): void;
}

export function createPointerStore(): PointerStore {
	let pos: Point | null = null;
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => pos,
		subscribe(l) {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		set(world) {
			pos = world;
			for (const l of listeners) l();
		},
	};
}

interface Props {
	settings: FreedrawSettingsStore;
	pointer: PointerStore;
	viewport: Viewport;
}

/**
 * ペン先カーソル（fixed レイヤー）。現在の太さ・色の円リングをポインタ追従表示。
 * 消しゴムは破線リング＋淡塗り。直径は実際の描画幅に合わせて size×zoom。
 */
export function FreedrawCursor({ settings, pointer, viewport }: Props) {
	const s = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
	const world = useSyncExternalStore(pointer.subscribe, pointer.getSnapshot);
	if (!s.cursorPreview || !world) return null;

	const sx = world.x * viewport.zoom + viewport.x;
	const sy = world.y * viewport.zoom + viewport.y;
	const eraser = s.mode === "eraser";
	const sizeWorld = eraser ? s.eraserSize : s.sizes[s.pen];
	const d = Math.max(6, sizeWorld * viewport.zoom);
	const m = penMeta(s.pen);

	return (
		<div
			style={{
				position: "absolute",
				left: sx - d / 2,
				top: sy - d / 2,
				width: d,
				height: d,
				borderRadius: "9999px",
				pointerEvents: "none",
				border: eraser ? "1.5px dashed #6b7280" : `1.5px solid ${s.color}`,
				background: eraser ? "rgba(120,120,120,0.10)" : "transparent",
				opacity: !eraser && m.blend === "multiply" ? 0.5 : 1,
			}}
		/>
	);
}
