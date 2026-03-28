import { ShapeAnchorOverlay, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { AiStatusEvent } from "@edv4h/usketch-plugin-ai-agent";
import type { BoardStore, EventBus } from "@edv4h/usketch-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SmartActionRequestEvent } from "./types.js";

// ── Types ──

type BarMode = "actions" | "input" | "thinking" | "done" | "error";

interface ActionBarProps {
	store: BoardStore;
	events: EventBus;
	boardId: string;
}

// ── Styles ──

const barStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	background: "#fff",
	borderRadius: 10,
	boxShadow: "0 2px 12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
	padding: 4,
	gap: 2,
	fontFamily: "system-ui, -apple-system, sans-serif",
	fontSize: 13,
	userSelect: "none",
};

const btnStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 4,
	padding: "6px 10px",
	border: "none",
	background: "none",
	borderRadius: 7,
	cursor: "pointer",
	font: "inherit",
	color: "#333",
	whiteSpace: "nowrap",
};

const sepStyle: React.CSSProperties = {
	width: 1,
	height: 20,
	background: "#e5e5e5",
	flexShrink: 0,
};

const backBtnStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: 28,
	height: 28,
	border: "none",
	background: "none",
	borderRadius: 6,
	cursor: "pointer",
	color: "#666",
	fontSize: 16,
	flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
	flex: 1,
	minWidth: 180,
	border: "none",
	outline: "none",
	font: "inherit",
	fontSize: 13,
	padding: "6px 8px",
	background: "transparent",
	color: "#333",
};

const statusStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 8,
	padding: "6px 10px",
	fontSize: 13,
	color: "#666",
	whiteSpace: "nowrap",
};

// ── useActionBarState Hook ──

function useActionBarState(events: EventBus, selectionSize: number) {
	const [mode, setMode] = useState<BarMode>("actions");
	const [statusMessage, setStatusMessage] = useState("");
	const [shapeCount, setShapeCount] = useState(0);
	const [errorMsg, setErrorMsg] = useState("");
	const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// AI status monitoring
	useEffect(() => {
		return events.on<AiStatusEvent>("ai:status", (status) => {
			if (dismissTimerRef.current) {
				clearTimeout(dismissTimerRef.current);
				dismissTimerRef.current = null;
			}

			switch (status.status) {
				case "thinking":
					setStatusMessage("AI is thinking...");
					setMode("thinking");
					break;
				case "placing":
					setStatusMessage(`Placing ${status.shapeCount ?? 0} shapes...`);
					setShapeCount(status.shapeCount ?? 0);
					setMode("thinking");
					break;
				case "done":
					setShapeCount(status.shapeCount ?? 0);
					setMode("done");
					dismissTimerRef.current = setTimeout(() => {
						setMode("actions");
					}, 3000);
					break;
				case "error":
					setErrorMsg(status.message ?? "Failed");
					setMode("error");
					dismissTimerRef.current = setTimeout(() => {
						setMode("actions");
					}, 5000);
					break;
			}
		});
	}, [events]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
		};
	}, []);

	// Reset mode when selection changes (but not during AI processing)
	useEffect(() => {
		if (selectionSize > 0 && mode !== "thinking" && mode !== "done" && mode !== "error") {
			setMode("actions");
		}
	}, [selectionSize, mode]);

	return { mode, setMode, statusMessage, shapeCount, errorMsg };
}

// ── Sub-components ──

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
	const [hover, setHover] = useState(false);
	return (
		<button
			type="button"
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{ ...btnStyle, background: hover ? "#f0f0f0" : "none" }}
		>
			{label}
		</button>
	);
}

function ActionsMode({
	onEmitAction,
	onAskAi,
	onComment,
	onRecognize,
	canRecognize,
}: {
	onEmitAction: (action: SmartActionRequestEvent["action"]) => void;
	onAskAi: () => void;
	onComment: () => void;
	onRecognize: () => void;
	canRecognize: boolean;
}) {
	return (
		<>
			<ActionButton label="✨ Tidy" onClick={() => onEmitAction("tidy")} />
			<ActionButton label="🏷 Label" onClick={() => onEmitAction("label")} />
			{canRecognize && <ActionButton label="✍ Recognize" onClick={onRecognize} />}
			<div style={sepStyle} />
			<ActionButton label="💬 Comment" onClick={onComment} />
			<ActionButton label="⌨ Ask AI" onClick={onAskAi} />
		</>
	);
}

function InputMode({ onBack, onSubmit }: { onBack: () => void; onSubmit: (text: string) => void }) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [hover, setHover] = useState(false);
	const isComposingRef = useRef(false);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	return (
		<>
			<button
				type="button"
				onClick={onBack}
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				style={{ ...backBtnStyle, background: hover ? "#f0f0f0" : "none" }}
			>
				←
			</button>
			<div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
				<input
					ref={inputRef}
					type="text"
					placeholder="What do you want to do with these shapes?"
					style={inputStyle}
					onCompositionStart={() => {
						isComposingRef.current = true;
					}}
					onCompositionEnd={() => {
						isComposingRef.current = false;
					}}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter" && !isComposingRef.current) {
							const text = (e.target as HTMLInputElement).value.trim();
							if (text) onSubmit(text);
						}
						if (e.key === "Escape") onBack();
					}}
				/>
			</div>
		</>
	);
}

function StatusMode({
	mode,
	statusMessage,
	shapeCount,
	errorMsg,
}: {
	mode: "thinking" | "done" | "error";
	statusMessage: string;
	shapeCount: number;
	errorMsg: string;
}) {
	if (mode === "thinking") {
		return (
			<div style={statusStyle}>
				<div
					style={{
						width: 14,
						height: 14,
						border: "2px solid #ddd",
						borderTopColor: "#666",
						borderRadius: "50%",
						animation: "ab-spin 0.6s linear infinite",
						flexShrink: 0,
					}}
				/>
				<span>{statusMessage || "AI is thinking..."}</span>
				<style>{"@keyframes ab-spin { to { transform: rotate(360deg); } }"}</style>
			</div>
		);
	}

	if (mode === "done") {
		return (
			<div style={{ ...statusStyle, color: "#16a34a" }}>
				<span>{shapeCount > 0 ? `✓ Done — ${shapeCount} shapes` : "✓ Done"}</span>
			</div>
		);
	}

	return (
		<div style={{ ...statusStyle, color: "#dc2626" }}>
			<span>{`✗ ${errorMsg || "Failed"}`}</span>
		</div>
	);
}

// ── Main Component ──

export function ActionBar({ store, events, boardId }: ActionBarProps) {
	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const { mode, setMode, statusMessage, shapeCount, errorMsg } = useActionBarState(
		events,
		selection.size,
	);

	const emitAction = useCallback(
		(action: SmartActionRequestEvent["action"], extra?: Partial<SmartActionRequestEvent>) => {
			const selectedShapeIds = Array.from(store.getSelection());
			events.emit("ai:smart-action", {
				action,
				selectedShapeIds,
				boardId,
				...extra,
			} satisfies SmartActionRequestEvent);
		},
		[store, events, boardId],
	);

	const canRecognize = useCallback(() => {
		const sel = store.getSelection();
		if (sel.size === 0) return false;
		for (const id of sel) {
			const shape = store.getShape(id);
			if (!shape || (shape.type !== "freedraw" && shape.type !== "image")) return false;
		}
		return true;
	}, [store]);

	// Hide when no selection and not in AI processing state
	if (selection.size === 0 && mode !== "thinking") return null;

	const shapeIds = Array.from(selection);

	return (
		<ShapeAnchorOverlay
			shapeIds={shapeIds}
			position="bottom"
			fallback="top"
			gap={12}
			style={{ pointerEvents: "auto" }}
		>
			<div style={barStyle} onPointerDown={(e) => e.stopPropagation()}>
				{mode === "actions" && (
					<ActionsMode
						onEmitAction={emitAction}
						onAskAi={() => setMode("input")}
						onComment={() => {
							events.emit("comments:start-thread", {
								selectedShapeIds: Array.from(store.getSelection()),
							});
						}}
						onRecognize={() => events.emit("ai:recognize", {})}
						canRecognize={canRecognize()}
					/>
				)}
				{mode === "input" && (
					<InputMode
						onBack={() => setMode("actions")}
						onSubmit={(text) => emitAction("custom", { customPrompt: text })}
					/>
				)}
				{(mode === "thinking" || mode === "done" || mode === "error") && (
					<StatusMode
						mode={mode}
						statusMessage={statusMessage}
						shapeCount={shapeCount}
						errorMsg={errorMsg}
					/>
				)}
			</div>
		</ShapeAnchorOverlay>
	);
}
