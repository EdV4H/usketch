import type { BoardStore, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { useRef, useState } from "react";
import {
	ACCENT_DIM,
	fmt,
	INLINE_INPUT,
	LABEL_STYLE,
	MINI_BUTTON,
	MINI_BUTTON_ACCENT,
	PANEL_BASE,
	SCROLLABLE_STYLE,
	shortId,
	TEXT_MUTED,
} from "../styles.js";

interface ShapesPanelProps {
	store: BoardStore;
	commands: CommandRegistry;
	shapes: ReadonlyMap<string, ShapeData>;
	selection: ReadonlySet<string>;
	onHoverShape: (id: string | null) => void;
}

const KNOWN_KEYS = new Set(["id", "type", "x", "y", "width", "height", "style", "rotation"]);

function EditableField({
	label,
	value,
	onCommit,
}: {
	label: string;
	value: number;
	onCommit: (v: number) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");

	const committedRef = useRef(false);

	const start = () => {
		committedRef.current = false;
		setDraft(String(value));
		setEditing(true);
	};
	const commit = () => {
		if (committedRef.current) return;
		committedRef.current = true;
		const n = Number.parseFloat(draft);
		if (!Number.isNaN(n)) onCommit(n);
		setEditing(false);
	};

	if (editing) {
		return (
			<span>
				{label}:{" "}
				<input
					style={{ ...INLINE_INPUT, width: 44 }}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commit();
						if (e.key === "Escape") setEditing(false);
					}}
					onBlur={commit}
					// biome-ignore lint/a11y/noAutofocus: debug tool inline edit needs immediate focus
					autoFocus
				/>
			</span>
		);
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: debug tool
		// biome-ignore lint/a11y/noStaticElementInteractions: debug tool
		<span onClick={start} style={{ cursor: "text" }} title="Click to edit">
			{label}: {fmt(value)}
		</span>
	);
}

export function ShapesPanel({
	store,
	commands,
	shapes,
	selection,
	onHoverShape,
}: ShapesPanelProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const shapeEntries = Array.from(shapes.values());

	const updateField = (id: string, field: string, value: number) => {
		const shape = store.getShape(id);
		if (!shape) return;
		const from = { [field]: shape[field] as number };
		const to = { [field]: value };
		commands.execute({
			execute: () => store.updateShape(id, to),
			undo: () => store.updateShape(id, from),
		});
	};

	const deleteShape = (id: string) => {
		const snapshot = store.getShape(id);
		if (!snapshot) return;
		commands.execute({
			execute: () => store.deleteShape(id),
			undo: () => store.addShape(snapshot),
		});
	};

	return (
		<div
			style={{
				...PANEL_BASE,
				position: "absolute",
				top: 8,
				left: 8,
				width: 240,
				height: 300,
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div style={LABEL_STYLE}>Shapes ({shapes.size})</div>
			<div style={{ ...SCROLLABLE_STYLE, flexGrow: 1, maxHeight: "none" }}>
				{shapeEntries.length === 0 ? (
					<div style={{ color: TEXT_MUTED }}>No shapes</div>
				) : (
					shapeEntries.map((s) => {
						const isSelected = selection.has(s.id);
						const isExpanded = expandedId === s.id;
						return (
							// biome-ignore lint/a11y/noStaticElementInteractions: debug tool
							<div
								key={s.id}
								onMouseEnter={() => onHoverShape(s.id)}
								onMouseLeave={() => onHoverShape(null)}
							>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: debug tool */}
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: debug tool */}
								<div
									onClick={() => setExpandedId(isExpanded ? null : s.id)}
									style={{
										padding: "2px 4px",
										borderRadius: 3,
										background: isSelected ? ACCENT_DIM : "transparent",
										cursor: "pointer",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<span>
										{isExpanded ? "▾" : "▸"} {shortId(s.id)}{" "}
										<span style={{ color: TEXT_MUTED }}>{s.type}</span>
									</span>
									<span style={{ color: TEXT_MUTED, fontSize: 9 }}>
										({fmt(s.x)}, {fmt(s.y)})
									</span>
								</div>

								{isExpanded && (
									<ShapeDetail
										shape={s}
										store={store}
										selection={selection}
										onUpdate={updateField}
										onDelete={deleteShape}
									/>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

function ShapeDetail({
	shape,
	store,
	selection,
	onUpdate,
	onDelete,
}: {
	shape: ShapeData;
	store: BoardStore;
	selection: ReadonlySet<string>;
	onUpdate: (id: string, field: string, value: number) => void;
	onDelete: (id: string) => void;
}) {
	const customKeys = Object.keys(shape).filter((k) => !KNOWN_KEYS.has(k));

	return (
		<div
			style={{
				padding: "4px 8px",
				fontSize: 10,
				lineHeight: "16px",
				borderLeft: `2px solid ${ACCENT_DIM}`,
			}}
		>
			<div style={{ color: TEXT_MUTED }}>id: {shape.id}</div>
			<div style={{ color: TEXT_MUTED }}>type: {shape.type}</div>
			<div>
				<EditableField label="x" value={shape.x} onCommit={(v) => onUpdate(shape.id, "x", v)} />{" "}
				<EditableField label="y" value={shape.y} onCommit={(v) => onUpdate(shape.id, "y", v)} />
			</div>
			<div>
				<EditableField
					label="w"
					value={shape.width}
					onCommit={(v) => onUpdate(shape.id, "width", v)}
				/>{" "}
				<EditableField
					label="h"
					value={shape.height}
					onCommit={(v) => onUpdate(shape.id, "height", v)}
				/>
			</div>
			{shape.rotation !== undefined && (
				<div>
					<EditableField
						label="rot"
						value={shape.rotation}
						onCommit={(v) => onUpdate(shape.id, "rotation", v)}
					/>
				</div>
			)}
			<div style={{ color: TEXT_MUTED, marginTop: 2 }}>
				style: fill={shape.style.fill} stroke={shape.style.stroke} w={shape.style.strokeWidth} op=
				{shape.style.opacity}
			</div>
			{customKeys.length > 0 && (
				<div style={{ marginTop: 2 }}>
					<div style={{ color: TEXT_MUTED }}>custom:</div>
					<pre
						style={{
							margin: 0,
							fontSize: 9,
							color: "#a0a0a0",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all",
						}}
					>
						{JSON.stringify(Object.fromEntries(customKeys.map((k) => [k, shape[k]])), null, 1)}
					</pre>
				</div>
			)}
			<div style={{ display: "flex", gap: 4, marginTop: 4 }}>
				{!selection.has(shape.id) && (
					<button
						type="button"
						style={MINI_BUTTON_ACCENT}
						onClick={() => store.setSelection([shape.id])}
					>
						Select
					</button>
				)}
				<button
					type="button"
					style={{ ...MINI_BUTTON, color: "#f87171" }}
					onClick={() => onDelete(shape.id)}
				>
					Delete
				</button>
			</div>
		</div>
	);
}
