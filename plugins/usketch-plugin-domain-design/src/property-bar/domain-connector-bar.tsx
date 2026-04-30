import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import type { ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import type React from "react";
import { useCallback } from "react";
import {
	type ContextMapRelation,
	DOMAIN_TYPES,
	type DomainConnectorMeta,
	readMeta,
	type TacticalRelation,
} from "../types.js";

const CONTEXT_MAP_OPTIONS: { value: ContextMapRelation; label: string }[] = [
	{ value: "customer-supplier", label: "Customer/Supplier" },
	{ value: "conformist", label: "Conformist" },
	{ value: "anticorruption-layer", label: "Anticorruption Layer" },
	{ value: "shared-kernel", label: "Shared Kernel" },
	{ value: "open-host-service", label: "Open Host Service" },
	{ value: "partnership", label: "Partnership" },
	{ value: "published-language", label: "Published Language" },
	{ value: "separate-ways", label: "Separate Ways" },
];

const TACTICAL_OPTIONS: { value: TacticalRelation; label: string }[] = [
	{ value: "association", label: "Association" },
	{ value: "aggregation", label: "Aggregation" },
	{ value: "composition", label: "Composition" },
	{ value: "inheritance", label: "Inheritance" },
	{ value: "realization", label: "Realization" },
	{ value: "dependency", label: "Dependency" },
];

const UPSTREAM_OPTIONS: { value: "from" | "to" | "none"; label: string }[] = [
	{ value: "none", label: "—" },
	{ value: "from", label: "U → D" },
	{ value: "to", label: "D ← U" },
];

export function DomainConnectorPropertyBar() {
	const app = useApp();
	const store = app.store;
	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const shapes = useStoreSubscribe(store, (s) => s.getShapes());

	const ids = [...selection];
	if (ids.length !== 1) return null;
	const id = ids[0];
	if (!id) return null;
	const shape = shapes.get(id);
	if (!shape || shape.type !== DOMAIN_TYPES.connector) return null;

	const meta = readMeta<DomainConnectorMeta>(shape);
	if (!meta.domainKind) return null;

	return (
		<ShapeAnchorOverlay shapeIds={[id]} position="top" fallback="bottom">
			<DomainConnectorControls connectorId={id} shape={shape} />
		</ShapeAnchorOverlay>
	);
}

function DomainConnectorControls({
	connectorId,
	shape,
}: {
	connectorId: string;
	shape: ShapeData;
}) {
	const app = useApp();
	const store = app.store;
	const meta = readMeta<DomainConnectorMeta>(shape);

	const updateMeta = useCallback(
		(nextMeta: DomainConnectorMeta) => {
			app.commands.execute(
				createBatchUpdateShapesCommand(store, [
					{
						id: connectorId,
						from: { meta: meta as Record<string, unknown> },
						to: { meta: nextMeta as Record<string, unknown> },
					},
				]),
			);
		},
		[app.commands, store, connectorId, meta],
	);

	// Toggling domainKind also has to refresh `arrowHead` to stay consistent with
	// `createDefaultDomainConnector` (context-map: undirected line, tactical: forward arrow).
	// Without this, switching context-map → tactical → context-map leaves a stray
	// arrow head on what should be an undirected context-map relation.
	const setDomainKind = useCallback(
		(kind: "context-map" | "tactical") => {
			if (meta.domainKind === kind) return;
			const nextMeta: DomainConnectorMeta =
				kind === "context-map"
					? { domainKind: "context-map", relation: "customer-supplier" }
					: { domainKind: "tactical", relation: "association" };
			const nextArrowHead = kind === "tactical" ? "forward" : "none";
			const currentArrowHead = (shape as ShapeData & { arrowHead?: string }).arrowHead;
			app.commands.execute(
				createBatchUpdateShapesCommand(store, [
					{
						id: connectorId,
						from: {
							meta: meta as Record<string, unknown>,
							arrowHead: currentArrowHead,
						} as Partial<ShapeData>,
						to: {
							meta: nextMeta as Record<string, unknown>,
							arrowHead: nextArrowHead,
						} as Partial<ShapeData>,
					},
				]),
			);
		},
		[app.commands, store, connectorId, meta, shape],
	);

	const setContextMapRelation = useCallback(
		(relation: ContextMapRelation) => {
			if (meta.domainKind !== "context-map") return;
			updateMeta({
				...(meta as Extract<DomainConnectorMeta, { domainKind: "context-map" }>),
				domainKind: "context-map",
				relation,
			});
		},
		[meta, updateMeta],
	);

	const setTacticalRelation = useCallback(
		(relation: TacticalRelation) => {
			if (meta.domainKind !== "tactical") return;
			updateMeta({
				...(meta as Extract<DomainConnectorMeta, { domainKind: "tactical" }>),
				domainKind: "tactical",
				relation,
			});
		},
		[meta, updateMeta],
	);

	const setUpstream = useCallback(
		(value: "from" | "to" | "none") => {
			if (meta.domainKind !== "context-map") return;
			const next: DomainConnectorMeta = {
				...(meta as Extract<DomainConnectorMeta, { domainKind: "context-map" }>),
				domainKind: "context-map",
				upstream: value === "none" ? undefined : value,
			};
			updateMeta(next);
		},
		[meta, updateMeta],
	);

	const setMultiplicity = useCallback(
		(side: "from" | "to", value: string) => {
			if (meta.domainKind !== "tactical") return;
			const trimmed = value.trim();
			const next: DomainConnectorMeta = {
				...(meta as Extract<DomainConnectorMeta, { domainKind: "tactical" }>),
				domainKind: "tactical",
				...(side === "from"
					? { multiplicityFrom: trimmed || undefined }
					: { multiplicityTo: trimmed || undefined }),
			};
			updateMeta(next);
		},
		[meta, updateMeta],
	);

	const setLabel = useCallback(
		(value: string) => {
			if (meta.domainKind !== "tactical") return;
			const trimmed = value.trim();
			const next: DomainConnectorMeta = {
				...(meta as Extract<DomainConnectorMeta, { domainKind: "tactical" }>),
				domainKind: "tactical",
				label: trimmed || undefined,
			};
			updateMeta(next);
		},
		[meta, updateMeta],
	);

	return (
		<div onPointerDown={(e) => e.stopPropagation()} style={barStyle}>
			{/* Domain kind toggle */}
			<ToggleButton
				active={meta.domainKind === "context-map"}
				onClick={() => setDomainKind("context-map")}
				title="Context Map (戦略)"
			>
				CM
			</ToggleButton>
			<ToggleButton
				active={meta.domainKind === "tactical"}
				onClick={() => setDomainKind("tactical")}
				title="Tactical (戦術)"
			>
				TX
			</ToggleButton>

			<div style={sepStyle} />

			{/* Relation dropdown */}
			{meta.domainKind === "context-map" ? (
				<select
					style={selectStyle}
					value={meta.relation ?? "customer-supplier"}
					onChange={(e) => setContextMapRelation(e.target.value as ContextMapRelation)}
				>
					{CONTEXT_MAP_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			) : (
				<select
					style={selectStyle}
					value={meta.relation ?? "association"}
					onChange={(e) => setTacticalRelation(e.target.value as TacticalRelation)}
				>
					{TACTICAL_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			)}

			<div style={sepStyle} />

			{/* Context map: upstream toggle */}
			{meta.domainKind === "context-map" && (
				<select
					style={shortSelectStyle}
					value={meta.upstream ?? "none"}
					onChange={(e) => setUpstream(e.target.value as "from" | "to" | "none")}
					title="Upstream"
				>
					{UPSTREAM_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			)}

			{/* Tactical: multiplicity & label.
			    Inputs are uncontrolled (defaultValue) so the user can type freely
			    without per-keystroke commits, but we re-mount via `key` whenever
			    the persisted meta changes (undo/redo, switching connectors,
			    programmatic updates) so they reflect current store state. */}
			{meta.domainKind === "tactical" && (
				<>
					<input
						key={`mfrom:${connectorId}:${meta.multiplicityFrom ?? ""}`}
						type="text"
						placeholder="From"
						defaultValue={meta.multiplicityFrom ?? ""}
						onBlur={(e) => setMultiplicity("from", e.currentTarget.value)}
						style={multiplicityInputStyle}
						title="Multiplicity (source)"
					/>
					<input
						key={`mto:${connectorId}:${meta.multiplicityTo ?? ""}`}
						type="text"
						placeholder="To"
						defaultValue={meta.multiplicityTo ?? ""}
						onBlur={(e) => setMultiplicity("to", e.currentTarget.value)}
						style={multiplicityInputStyle}
						title="Multiplicity (target)"
					/>
					<input
						key={`label:${connectorId}:${meta.label ?? ""}`}
						type="text"
						placeholder="Label"
						defaultValue={meta.label ?? ""}
						onBlur={(e) => setLabel(e.currentTarget.value)}
						style={labelInputStyle}
						title="Relation label"
					/>
				</>
			)}
		</div>
	);
}

function ToggleButton({
	active,
	onClick,
	title,
	children,
}: {
	active: boolean;
	onClick: () => void;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<button type="button" onClick={onClick} title={title} style={toggleBtnStyle(active)}>
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
	fontSize: 11,
	whiteSpace: "nowrap",
	pointerEvents: "auto",
};

const sepStyle: React.CSSProperties = {
	width: 1,
	height: 18,
	background: "#e0e0e0",
	flexShrink: 0,
	margin: "0 2px",
};

const selectStyle: React.CSSProperties = {
	height: 22,
	border: "1px solid #e0e0e0",
	borderRadius: 4,
	padding: "0 4px",
	fontSize: 11,
	background: "#fff",
	cursor: "pointer",
};

const shortSelectStyle: React.CSSProperties = {
	...selectStyle,
	width: 64,
};

const multiplicityInputStyle: React.CSSProperties = {
	width: 48,
	height: 22,
	border: "1px solid #e0e0e0",
	borderRadius: 4,
	padding: "0 4px",
	fontSize: 11,
	background: "#fff",
};

const labelInputStyle: React.CSSProperties = {
	...multiplicityInputStyle,
	width: 96,
};

function toggleBtnStyle(active: boolean): React.CSSProperties {
	return {
		width: 28,
		height: 22,
		padding: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: active ? "#e8f0fe" : "transparent",
		border: active ? "1px solid #2680eb" : "1px solid transparent",
		borderRadius: 4,
		cursor: "pointer",
		color: active ? "#2680eb" : "#333",
		fontSize: 10,
		fontWeight: 600,
	};
}
