import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { type AnchorType, getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import type {
	ArrowHead,
	ConnectorShapeData,
	PathType,
} from "@edv4h/usketch-plugin-shape-connector";
import type { ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback } from "react";

// ── Arrow Icons ──

function ArrowNoneIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

function ArrowForwardIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="3" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="13,8 9,5.5 9,10.5" fill="currentColor" />
		</svg>
	);
}

function ArrowBackwardIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="4" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="3,8 7,5.5 7,10.5" fill="currentColor" />
		</svg>
	);
}

function ArrowBothIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="3,8 6,5.5 6,10.5" fill="currentColor" />
			<polygon points="13,8 10,5.5 10,10.5" fill="currentColor" />
		</svg>
	);
}

// ── Path Icons ──

function PathStraightIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

function PathElbowIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<polyline points="3,13 3,3 13,3" fill="none" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

function PathCurveIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16">
			<path d="M 3,13 Q 3,3 13,3" fill="none" stroke="currentColor" strokeWidth="1.5" />
		</svg>
	);
}

// ── Anchor labels ──

const ANCHOR_OPTIONS: { value: AnchorType; label: string }[] = [
	{ value: "auto", label: "自動" },
	{ value: "top", label: "上" },
	{ value: "right", label: "右" },
	{ value: "bottom", label: "下" },
	{ value: "left", label: "左" },
	{ value: "custom", label: "手動" },
];

// ── Component ──

export function ConnectorPropertyBar() {
	const app = useApp();
	const store = app.store;
	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const shapes = useStoreSubscribe(store, (s) => s.getShapes());

	const ids = [...selection];
	if (ids.length !== 1) return null;
	const shape = shapes.get(ids[0]);
	if (!shape || shape.type !== "connector") return null;

	const connectorId = ids[0];
	const connectorData = shape as ConnectorShapeData;
	const arrowHead = connectorData.arrowHead ?? "forward";
	const pathType = connectorData.pathType ?? "straight";
	const sourceAnchor = connectorData.sourceAnchor ?? "auto";
	const targetAnchor = connectorData.targetAnchor ?? "auto";

	return (
		<ShapeAnchorOverlay shapeIds={[connectorId]} position="bottom" fallback="top">
			<ConnectorControls
				connectorId={connectorId}
				connector={shape}
				arrowHead={arrowHead}
				pathType={pathType}
				sourceAnchor={sourceAnchor}
				targetAnchor={targetAnchor}
			/>
		</ShapeAnchorOverlay>
	);
}

function ConnectorControls({
	connectorId,
	connector,
	arrowHead,
	pathType,
	sourceAnchor,
	targetAnchor,
}: {
	connectorId: string;
	connector: ShapeData;
	arrowHead: ArrowHead;
	pathType: PathType;
	sourceAnchor: AnchorType;
	targetAnchor: AnchorType;
}) {
	const app = useApp();
	const store = app.store;

	const updateProp = useCallback(
		(key: string, from: unknown, to: unknown) => {
			app.commands.execute(
				createBatchUpdateShapesCommand(store, [
					{ id: connectorId, from: { [key]: from }, to: { [key]: to } },
				]),
			);
		},
		[app.commands, store, connectorId],
	);

	const setArrowHead = useCallback(
		(value: ArrowHead) => {
			if (value === arrowHead) return;
			updateProp("arrowHead", arrowHead, value);
		},
		[arrowHead, updateProp],
	);

	const setPathType = useCallback(
		(value: PathType) => {
			if (value === pathType) return;
			updateProp("pathType", pathType, value);
		},
		[pathType, updateProp],
	);

	const setAnchor = useCallback(
		(endpoint: "source" | "target", value: AnchorType) => {
			const key = endpoint === "source" ? "sourceAnchor" : "targetAnchor";
			const current = endpoint === "source" ? sourceAnchor : targetAnchor;
			if (value === current) return;

			// Recalculate endpoint position with new anchor
			const connectorData = connector as ConnectorShapeData;
			const sourceId = connectorData.sourceId;
			const targetId = connectorData.targetId;
			if (!sourceId || !targetId) return;

			const sourceShape = store.getShape(sourceId);
			const targetShape = store.getShape(targetId);
			if (!sourceShape || !targetShape) return;

			const targetCenter = {
				x: targetShape.x + targetShape.width / 2,
				y: targetShape.y + targetShape.height / 2,
			};
			const sourceCenter = {
				x: sourceShape.x + sourceShape.width / 2,
				y: sourceShape.y + sourceShape.height / 2,
			};

			const newSourceAnchor = endpoint === "source" ? value : sourceAnchor;
			const newTargetAnchor = endpoint === "target" ? value : targetAnchor;

			const newSourcePoint = getAnchorPoint(sourceShape, newSourceAnchor, targetCenter);
			const newTargetPoint = getAnchorPoint(targetShape, newTargetAnchor, sourceCenter);

			const from: Partial<ConnectorShapeData> = {
				[key]: current,
				sourcePoint: connectorData.sourcePoint,
				targetPoint: connectorData.targetPoint,
				x: connector.x,
				y: connector.y,
				width: connector.width,
				height: connector.height,
			};
			const to: Partial<ConnectorShapeData> = {
				[key]: value,
				sourcePoint: newSourcePoint,
				targetPoint: newTargetPoint,
				x: Math.min(newSourcePoint.x, newTargetPoint.x),
				y: Math.min(newSourcePoint.y, newTargetPoint.y),
				width: Math.abs(newTargetPoint.x - newSourcePoint.x),
				height: Math.abs(newTargetPoint.y - newSourcePoint.y),
			};

			app.commands.execute(createBatchUpdateShapesCommand(store, [{ id: connectorId, from, to }]));
		},
		[connectorId, connector, sourceAnchor, targetAnchor, store, app.commands],
	);

	return (
		<div onPointerDown={(e) => e.stopPropagation()} style={barStyle}>
			{/* Arrow head */}
			<ToggleButton
				active={arrowHead === "none"}
				onClick={() => setArrowHead("none")}
				title="矢印なし"
			>
				<ArrowNoneIcon />
			</ToggleButton>
			<ToggleButton
				active={arrowHead === "forward"}
				onClick={() => setArrowHead("forward")}
				title="前方矢印"
			>
				<ArrowForwardIcon />
			</ToggleButton>
			<ToggleButton
				active={arrowHead === "backward"}
				onClick={() => setArrowHead("backward")}
				title="後方矢印"
			>
				<ArrowBackwardIcon />
			</ToggleButton>
			<ToggleButton
				active={arrowHead === "both"}
				onClick={() => setArrowHead("both")}
				title="双方向矢印"
			>
				<ArrowBothIcon />
			</ToggleButton>

			<div style={sepStyle} />

			{/* Path type */}
			<ToggleButton
				active={pathType === "straight"}
				onClick={() => setPathType("straight")}
				title="直線"
			>
				<PathStraightIcon />
			</ToggleButton>
			<ToggleButton active={pathType === "elbow"} onClick={() => setPathType("elbow")} title="L字">
				<PathElbowIcon />
			</ToggleButton>
			<ToggleButton active={pathType === "curve"} onClick={() => setPathType("curve")} title="曲線">
				<PathCurveIcon />
			</ToggleButton>

			<div style={sepStyle} />

			{/* Anchor selectors */}
			<AnchorSelect label="始点" value={sourceAnchor} onChange={(v) => setAnchor("source", v)} />
			<AnchorSelect label="終点" value={targetAnchor} onChange={(v) => setAnchor("target", v)} />
		</div>
	);
}

function AnchorSelect({
	label,
	value,
	onChange,
}: {
	label: string;
	value: AnchorType;
	onChange: (v: AnchorType) => void;
}) {
	return (
		<label style={anchorLabelStyle}>
			<span style={{ fontSize: 10, color: "#888" }}>{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as AnchorType)}
				style={selectStyle}
			>
				{ANCHOR_OPTIONS.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</label>
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

// ── Styles ──

const barStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	gap: 2,
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

const anchorLabelStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: 1,
};

const selectStyle: React.CSSProperties = {
	width: 52,
	height: 22,
	border: "1px solid #e0e0e0",
	borderRadius: 4,
	padding: "0 2px",
	fontSize: 10,
	background: "#fff",
	cursor: "pointer",
};

function toggleBtnStyle(active: boolean): React.CSSProperties {
	return {
		width: 26,
		height: 26,
		padding: 0,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		background: active ? "#e8f0fe" : "transparent",
		border: active ? "1px solid #2680eb" : "1px solid transparent",
		borderRadius: 4,
		cursor: "pointer",
		color: active ? "#2680eb" : "#333",
	};
}
