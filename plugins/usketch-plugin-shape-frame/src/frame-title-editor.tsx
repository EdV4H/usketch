import type { PluginContext, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { TITLE_HEIGHT } from "./constants.js";
import type { FrameShapeData } from "./types.js";

// ── Title editing state (module-level, mirrors connector-label) ──
//
// The frame's title bar (see `renderFrame`) starts editing on double-click via
// `setEditingFrameTitle`; this overlay renders the input and commits the result.

let editingFrameId: string | null = null;
const editListeners = new Set<() => void>();

function notifyEdit() {
	for (const fn of editListeners) fn();
}

export function setEditingFrameTitle(id: string | null): void {
	editingFrameId = id;
	notifyEdit();
}

export function getEditingFrameTitle(): string | null {
	return editingFrameId;
}

function subscribeEditingFrameTitle(cb: () => void): () => void {
	editListeners.add(cb);
	return () => editListeners.delete(cb);
}

// ── Title editor overlay ──

interface FrameTitleEditorProps {
	ctx: PluginContext;
	viewport: Viewport;
}

export function FrameTitleEditor({ ctx, viewport }: FrameTitleEditorProps) {
	const editingId = useSyncExternalStore(subscribeEditingFrameTitle, getEditingFrameTitle);
	const shapes = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getShapes(),
	);

	if (!editingId) return null;
	const frame = shapes.get(editingId);
	if (!frame || frame.type !== "frame") return null;

	return <TitleInput frame={frame} ctx={ctx} viewport={viewport} />;
}

function TitleInput({
	frame,
	ctx,
	viewport,
}: {
	frame: ShapeData;
	ctx: PluginContext;
	viewport: Viewport;
}) {
	const frameData = frame as FrameShapeData;
	const inputRef = useRef<HTMLInputElement>(null);
	const openedAt = useRef(Date.now());
	const currentTitle = frameData.frameTitle ?? "";

	// Title bar sits just above the frame body; position the input over it.
	const left = frame.x * viewport.zoom + viewport.x;
	const top = (frame.y - TITLE_HEIGHT) * viewport.zoom + viewport.y;

	const commit = useCallback(
		(next: string) => {
			const trimmed = next.trim();
			const before = frameData.frameTitle ?? undefined;
			const after = trimmed || undefined;
			if (before !== after) {
				ctx.commands.execute(
					createBatchUpdateShapesCommand(ctx.store, [
						{
							id: frame.id,
							from: { frameTitle: before } as Partial<FrameShapeData>,
							to: { frameTitle: after } as Partial<FrameShapeData>,
						},
					]),
				);
			}
			setEditingFrameTitle(null);
		},
		[ctx, frame.id, frameData.frameTitle],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			e.stopPropagation();
			if (e.key === "Enter" && !e.nativeEvent.isComposing) {
				commit((e.target as HTMLInputElement).value);
			} else if (e.key === "Escape" && !e.nativeEvent.isComposing) {
				setEditingFrameTitle(null);
			}
		},
		[commit],
	);

	useEffect(() => {
		// Focus immediately, then retry once — the opening double-click's trailing
		// events can otherwise move focus back to the canvas just after we grab it.
		const focus = () => {
			const el = inputRef.current;
			if (el && document.activeElement !== el) {
				el.focus();
				el.select();
			}
		};
		focus();
		const t = setTimeout(focus, 30);
		return () => clearTimeout(t);
	}, []);

	return (
		<div
			onPointerDown={(e) => e.stopPropagation()}
			style={{
				position: "absolute",
				left,
				top,
				height: TITLE_HEIGHT * viewport.zoom,
				display: "flex",
				alignItems: "center",
				pointerEvents: "auto",
			}}
		>
			<input
				ref={inputRef}
				type="text"
				// biome-ignore lint/a11y/noAutofocus: inline edit should focus immediately
				autoFocus
				defaultValue={currentTitle}
				onKeyDown={onKeyDown}
				onBlur={(e) => {
					// The opening double-click can bounce focus back to the canvas right
					// after mount; treat that first transient blur as spurious and re-grab
					// focus instead of committing + closing the editor.
					if (Date.now() - openedAt.current < 250) {
						const el = e.currentTarget;
						requestAnimationFrame(() => el.focus());
						return;
					}
					commit(e.target.value);
				}}
				placeholder="Frame"
				style={{
					minWidth: 80,
					height: 20,
					padding: "1px 6px",
					fontSize: 12,
					fontFamily: "system-ui, sans-serif",
					border: "2px solid #2680eb",
					borderRadius: 4,
					outline: "none",
					background: "white",
				}}
			/>
		</div>
	);
}
