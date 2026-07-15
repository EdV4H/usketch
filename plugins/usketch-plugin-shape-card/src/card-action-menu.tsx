import { ShapeAnchorOverlay, useApp } from "@edv4h/usketch-canvas-engine";
import type { ShapeData } from "@edv4h/usketch-shared";
import type React from "react";
import { useSyncExternalStore } from "react";
import { CARD_TYPE, DECK_TYPE } from "./factory.js";
import { readCardMeta } from "./types.js";

/**
 * Decide what the action menu targets for a selection. Pure so it can be unit
 * tested without rendering. Returns `null` when the menu should not show.
 */
export function cardMenuKind(
	shapes: ReadonlyMap<string, ShapeData>,
	selection: ReadonlySet<string> | string[],
	enableDeck: boolean,
): { kind: "card" | "deck"; id: string; canHand: boolean } | null {
	const ids = [...selection];
	if (ids.length !== 1) return null;
	const id = ids[0];
	const shape = shapes.get(id);
	if (!shape) return null;
	if (shape.type === CARD_TYPE) {
		return { kind: "card", id, canHand: !!readCardMeta(shape).cardType };
	}
	if (enableDeck && shape.type === DECK_TYPE) {
		return { kind: "deck", id, canHand: false };
	}
	return null;
}

/**
 * Floating card action menu (#671). Shows above a single selected card / deck
 * and offers explicit operations, replacing the old implicit double-click.
 * Same `ShapeAnchorOverlay` pattern as the connector property bar; usable with
 * the plain select tool. Buttons emit events handled by the plugin.
 */
export function CardActionMenu({ enableDeck }: { enableDeck: boolean }) {
	const app = useApp();
	const store = app.store;
	const selection = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getSelection(),
		() => store.getSelection(),
	);
	const shapes = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getShapes(),
		() => store.getShapes(),
	);
	const activeToolId = useSyncExternalStore(
		(cb) => store.subscribe(cb),
		() => store.getActiveToolId(),
		() => store.getActiveToolId(),
	);

	if (activeToolId !== "select") return null;
	const target = cardMenuKind(shapes, selection, enableDeck);
	if (!target) return null;
	const { kind, id, canHand } = target;
	const isCard = kind === "card";
	const isDeck = kind === "deck";
	const emit = (type: string) => app.events.emit(type, { id });

	return (
		<ShapeAnchorOverlay shapeIds={[id]} position="top" fallback="bottom">
			<div style={barStyle} onPointerDown={(e) => e.stopPropagation()}>
				{isCard && (
					<MenuButton onClick={() => emit("card:flip")} title="めくる">
						めくる
					</MenuButton>
				)}
				{isCard && canHand && (
					<MenuButton onClick={() => emit("card:to-hand")} title="手札に入れる">
						手札に入れる
					</MenuButton>
				)}
				{isDeck && (
					<MenuButton onClick={() => emit("card-deck:draw")} title="1枚ドロー">
						1枚ドロー
					</MenuButton>
				)}
				{isDeck && (
					<MenuButton onClick={() => emit("card-deck:shuffle")} title="シャッフル">
						シャッフル
					</MenuButton>
				)}
			</div>
		</ShapeAnchorOverlay>
	);
}

function MenuButton({
	onClick,
	title,
	children,
}: {
	onClick: () => void;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<button type="button" onClick={onClick} title={title} style={btnStyle}>
			{children}
		</button>
	);
}

const barStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "4px 6px",
	background: "#fff",
	borderRadius: 8,
	boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
	fontFamily: "system-ui, sans-serif",
	fontSize: 12,
	whiteSpace: "nowrap",
	pointerEvents: "auto",
};

const btnStyle: React.CSSProperties = {
	height: 26,
	padding: "0 10px",
	display: "flex",
	alignItems: "center",
	border: "1px solid #e0e0e0",
	borderRadius: 6,
	background: "#f7f7f8",
	cursor: "pointer",
	color: "#333",
	fontSize: 12,
};
