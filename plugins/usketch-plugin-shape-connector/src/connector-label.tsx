import type { PluginContext, Point, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { getPathMidpoint, type PathType } from "./path-utils.js";

// ── Label editing state ──

let editingConnectorId: string | null = null;
const editListeners: Set<() => void> = new Set();

function notifyEdit() {
	for (const fn of editListeners) fn();
}

export function setEditingLabel(id: string | null): void {
	editingConnectorId = id;
	notifyEdit();
}

export function getEditingLabel(): string | null {
	return editingConnectorId;
}

function subscribeEditingLabel(cb: () => void): () => void {
	editListeners.add(cb);
	return () => editListeners.delete(cb);
}

// ── Double-click detection ──

let lastClickTime = 0;
let lastClickConnectorId: string | null = null;
const DOUBLE_CLICK_THRESHOLD = 400;

export function handleConnectorClick(connectorId: string): void {
	const now = Date.now();
	if (lastClickConnectorId === connectorId && now - lastClickTime < DOUBLE_CLICK_THRESHOLD) {
		setEditingLabel(connectorId);
		lastClickTime = 0;
		lastClickConnectorId = null;
	} else {
		lastClickTime = now;
		lastClickConnectorId = connectorId;
	}
}

// ── Label editor overlay ──

interface ConnectorLabelEditorProps {
	ctx: PluginContext;
	viewport: Viewport;
}

export function ConnectorLabelEditor({ ctx, viewport }: ConnectorLabelEditorProps) {
	const editingId = useSyncExternalStore(subscribeEditingLabel, getEditingLabel);

	const shapes = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getShapes(),
	);

	if (!editingId) return null;
	const connector = shapes.get(editingId);
	if (!connector || connector.type !== "connector") return null;

	return <LabelInput connectorId={editingId} connector={connector} ctx={ctx} viewport={viewport} />;
}

function LabelInput({
	connectorId,
	connector,
	ctx,
	viewport,
}: {
	connectorId: string;
	connector: ShapeData;
	ctx: PluginContext;
	viewport: Viewport;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const currentLabel = (connector.label as string) ?? "";

	const midpoint = getMidpointScreen(connector, viewport);

	const commit = useCallback(
		(newLabel: string) => {
			const trimmed = newLabel.trim();
			const oldLabel = (connector.label as string | undefined) ?? undefined;
			const nextLabel = trimmed || undefined;
			if (oldLabel !== nextLabel) {
				ctx.commands.execute(
					createBatchUpdateShapesCommand(ctx.store, [
						{ id: connectorId, from: { label: oldLabel }, to: { label: nextLabel } },
					]),
				);
			}
			setEditingLabel(null);
		},
		[connectorId, connector.label, ctx],
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				commit((e.target as HTMLInputElement).value);
			} else if (e.key === "Escape") {
				setEditingLabel(null);
			}
		},
		[commit],
	);

	const handleBlur = useCallback(
		(e: React.FocusEvent<HTMLInputElement>) => {
			commit(e.target.value);
		},
		[commit],
	);

	useEffect(() => {
		const el = inputRef.current;
		if (el) {
			el.focus();
			el.select();
		}
	}, []);

	return (
		<div
			onPointerDown={(e) => e.stopPropagation()}
			style={{
				position: "absolute",
				left: midpoint.x,
				top: midpoint.y,
				transform: "translate(-50%, -50%)",
				pointerEvents: "auto",
			}}
		>
			<input
				ref={inputRef}
				type="text"
				defaultValue={currentLabel}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				style={{
					width: Math.max(80, currentLabel.length * 8 + 24),
					height: 24,
					padding: "2px 8px",
					fontSize: 12,
					fontFamily: "system-ui, sans-serif",
					border: `2px solid #2680eb`,
					borderRadius: 4,
					outline: "none",
					textAlign: "center",
					background: "white",
				}}
			/>
		</div>
	);
}

function getMidpointScreen(connector: ShapeData, viewport: Viewport): Point {
	const sourcePoint = connector.sourcePoint as Point | undefined;
	const targetPoint = connector.targetPoint as Point | undefined;
	if (!sourcePoint || !targetPoint) {
		return {
			x: connector.x * viewport.zoom + viewport.x,
			y: connector.y * viewport.zoom + viewport.y,
		};
	}
	const pathType = (connector.pathType as PathType) ?? "straight";
	const controlPoint = connector.controlPoint as Point | undefined;
	const mid = getPathMidpoint(pathType, sourcePoint, targetPoint, controlPoint);
	return {
		x: mid.x * viewport.zoom + viewport.x,
		y: mid.y * viewport.zoom + viewport.y,
	};
}
