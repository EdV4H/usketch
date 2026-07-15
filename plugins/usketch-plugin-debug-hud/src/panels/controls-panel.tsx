import type {
	ActionParam,
	ActionRegistry,
	BoardStore,
	EventBus,
	PluginAction,
	ShapeStyle,
	ToolRegistry,
} from "@edv4h/usketch-shared";
import type React from "react";
import { useEffect, useReducer, useState } from "react";
import {
	ACCENT,
	INLINE_INPUT,
	LABEL_STYLE,
	MINI_BUTTON,
	MINI_BUTTON_ACCENT,
	PANEL_BASE,
	SECTION_STYLE,
	TEXT_LABEL,
	TEXT_MUTED,
} from "../styles.js";

interface ControlsPanelProps {
	store: BoardStore;
	tools: ToolRegistry;
	actions: ActionRegistry;
	events: EventBus;
	activeToolId: string;
}

/**
 * Universal control panel (#671-adjacent). Drives plugin operations without any
 * demo-app UI: a tool palette (from `tools.getOrdered()`), the declarative
 * action registry (`actions.getOrdered()`), a raw event-emit console fallback,
 * and default-style controls.
 */
export function ControlsPanel({ store, tools, actions, events, activeToolId }: ControlsPanelProps) {
	// Re-render when actions register/unregister at runtime.
	const [, bump] = useReducer((n: number) => n + 1, 0);
	useEffect(() => actions.subscribe(bump), [actions]);

	const toolList = tools.getOrdered();
	const actionList = actions.getOrdered();
	const groups = groupActions(actionList);

	return (
		<div style={panelStyle}>
			<div style={titleStyle}>Controls</div>

			{/* Tools */}
			<div style={SECTION_STYLE}>
				<div style={LABEL_STYLE}>Tools</div>
				<div style={toolGridStyle}>
					{toolList.map(({ id, definition }) => (
						<button
							type="button"
							key={id}
							title={id}
							onClick={() => store.setActiveToolId(id)}
							style={{
								...MINI_BUTTON,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: 28,
								height: 28,
								background: id === activeToolId ? ACCENT : "rgba(255,255,255,0.1)",
							}}
						>
							<IconSlot render={definition.icon} />
						</button>
					))}
				</div>
			</div>

			{/* Actions (from the registry) */}
			{groups.map(([group, items]) => (
				<div key={group} style={SECTION_STYLE}>
					<div style={LABEL_STYLE}>{group}</div>
					{items.map(({ id, action }) => (
						<ActionRow key={id} action={action} />
					))}
				</div>
			))}
			{actionList.length === 0 && (
				<div style={{ color: TEXT_MUTED, fontSize: 10, marginBottom: 6 }}>
					No registered actions. Plugins expose operations via <code>ctx.actions.register</code>.
				</div>
			)}

			{/* Raw event console (fallback for anything not registered as an action) */}
			<EventConsole events={events} />

			{/* Default style + clear */}
			<StyleControls store={store} />
		</div>
	);
}

function groupActions(
	list: readonly { id: string; action: PluginAction }[],
): [string, { id: string; action: PluginAction }[]][] {
	const map = new Map<string, { id: string; action: PluginAction }[]>();
	for (const entry of list) {
		const g = entry.action.group ?? "Actions";
		const bucket = map.get(g) ?? [];
		bucket.push(entry);
		map.set(g, bucket);
	}
	return [...map.entries()];
}

function IconSlot({ render }: { render: () => React.ReactElement }) {
	try {
		return render();
	} catch {
		return <span>?</span>;
	}
}

/** One action: a button (no params) or inline param controls + Run. */
function ActionRow({ action }: { action: PluginAction }) {
	const [args, setArgs] = useState<Record<string, unknown>>(() => defaultArgs(action.params));
	const enabled = action.isEnabled ? action.isEnabled() : true;
	const active = action.isActive?.() ?? false;

	if (!action.params || action.params.length === 0) {
		return (
			<button
				type="button"
				disabled={!enabled}
				onClick={() => action.run({})}
				style={{
					...(active ? MINI_BUTTON_ACCENT : MINI_BUTTON),
					display: "block",
					width: "100%",
					textAlign: "left",
					marginBottom: 3,
					opacity: enabled ? 1 : 0.4,
				}}
			>
				{active ? "● " : ""}
				{action.label}
			</button>
		);
	}

	return (
		<div style={{ marginBottom: 4 }}>
			<div style={{ color: TEXT_LABEL, fontSize: 10 }}>{action.label}</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
				{action.params.map((p) => (
					<ParamControl
						key={p.name}
						param={p}
						value={args[p.name]}
						onChange={(v) => setArgs((prev) => ({ ...prev, [p.name]: v }))}
					/>
				))}
				<button
					type="button"
					disabled={!enabled}
					onClick={() => action.run(args)}
					style={{ ...MINI_BUTTON_ACCENT, opacity: enabled ? 1 : 0.4 }}
				>
					Run
				</button>
			</div>
		</div>
	);
}

function defaultArgs(params?: ActionParam[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const p of params ?? []) {
		if (p.default !== undefined) out[p.name] = p.default;
		else if (p.type === "enum") out[p.name] = p.options?.[0]?.value;
		else if (p.type === "boolean") out[p.name] = false;
		else if (p.type === "number") out[p.name] = p.min ?? 0;
		else if (p.type === "color") out[p.name] = "#000000";
		else out[p.name] = "";
	}
	return out;
}

function ParamControl({
	param,
	value,
	onChange,
}: {
	param: ActionParam;
	value: unknown;
	onChange: (v: unknown) => void;
}) {
	switch (param.type) {
		case "enum":
			return (
				<select
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={{ ...INLINE_INPUT, width: "auto" }}
				>
					{param.options?.map((o) => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			);
		case "boolean":
			return (
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
				/>
			);
		case "color":
			return (
				<input
					type="color"
					value={String(value ?? "#000000")}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
		case "number":
			return (
				<input
					type="number"
					value={Number(value ?? 0)}
					min={param.min}
					max={param.max}
					step={param.step}
					onChange={(e) => onChange(Number(e.target.value))}
					style={INLINE_INPUT}
				/>
			);
		default:
			return (
				<input
					type="text"
					value={String(value ?? "")}
					onChange={(e) => onChange(e.target.value)}
					style={INLINE_INPUT}
				/>
			);
	}
}

/** Emit an arbitrary event with a JSON payload — the universal fallback. */
function EventConsole({ events }: { events: EventBus }) {
	const [name, setName] = useState("");
	const [payload, setPayload] = useState("{}");
	const [err, setErr] = useState<string | null>(null);

	const emit = () => {
		if (!name.trim()) return;
		let data: unknown = {};
		if (payload.trim()) {
			try {
				data = JSON.parse(payload);
			} catch {
				setErr("invalid JSON");
				return;
			}
		}
		setErr(null);
		events.emit(name.trim(), data);
	};

	return (
		<div style={SECTION_STYLE}>
			<div style={LABEL_STYLE}>Emit event</div>
			<input
				type="text"
				value={name}
				placeholder="event:name"
				onChange={(e) => setName(e.target.value)}
				style={{ ...INLINE_INPUT, width: "100%", marginBottom: 3 }}
			/>
			<textarea
				value={payload}
				onChange={(e) => setPayload(e.target.value)}
				spellCheck={false}
				style={{
					...INLINE_INPUT,
					width: "100%",
					height: 36,
					resize: "vertical",
					marginBottom: 3,
				}}
			/>
			<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
				<button type="button" onClick={emit} style={MINI_BUTTON_ACCENT}>
					Emit
				</button>
				{err && <span style={{ color: "#f87171", fontSize: 10 }}>{err}</span>}
			</div>
		</div>
	);
}

/** Edit the default draw style (applies to new shapes via setStyleSettings). */
function StyleControls({ store }: { store: BoardStore }) {
	const s = store.getStyleSettings();
	const set = (patch: Partial<ShapeStyle>) => store.setStyleSettings({ ...s, ...patch });

	const clearCanvas = () => {
		const ids = [...store.getShapes().keys()];
		for (const id of ids) store.deleteShape(id);
	};

	return (
		<div style={SECTION_STYLE}>
			<div style={LABEL_STYLE}>Default style</div>
			<div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
				<label style={swatchLabel}>
					fill
					<input
						type="color"
						value={toHex(s.fill)}
						onChange={(e) => set({ fill: e.target.value })}
					/>
				</label>
				<label style={swatchLabel}>
					stroke
					<input
						type="color"
						value={toHex(s.stroke)}
						onChange={(e) => set({ stroke: e.target.value })}
					/>
				</label>
			</div>
			<button
				type="button"
				onClick={clearCanvas}
				style={{ ...MINI_BUTTON, color: "#f87171", borderColor: "#f87171" }}
			>
				Clear canvas
			</button>
		</div>
	);
}

function toHex(color: unknown): string {
	return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000";
}

const panelStyle: React.CSSProperties = {
	...PANEL_BASE,
	position: "absolute",
	left: 8,
	top: 316,
	width: 240,
	maxHeight: "calc(100vh - 430px)",
	overflowY: "auto",
};

const titleStyle: React.CSSProperties = {
	color: ACCENT,
	fontSize: 11,
	fontWeight: 700,
	marginBottom: 6,
};

const toolGridStyle: React.CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: 4,
};

const swatchLabel: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 3,
	color: TEXT_LABEL,
	fontSize: 10,
};
