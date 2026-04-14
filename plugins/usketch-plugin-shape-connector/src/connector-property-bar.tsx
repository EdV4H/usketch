import { ShapeAnchorOverlay, useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback } from "react";
import type { ArrowHead, PathType } from "./shapes/connector.js";

// ── Icons ──

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

// ── Component ──

export function ConnectorPropertyBar() {
	const app = useApp();
	const store = app.store;
	const selection = useStoreSubscribe(store, (s) => s.getSelection());
	const shapes = useStoreSubscribe(store, (s) => s.getShapes());

	// Only show for single connector selection
	const ids = [...selection];
	if (ids.length !== 1) return null;
	const shape = shapes.get(ids[0]);
	if (!shape || shape.type !== "connector") return null;

	const connectorId = ids[0];
	const arrowHead = (shape.arrowHead as ArrowHead) ?? "forward";
	const pathType = (shape.pathType as PathType) ?? "straight";

	return (
		<ShapeAnchorOverlay shapeIds={[connectorId]} position="bottom" fallback="top" gap={12}>
			<ConnectorControls connectorId={connectorId} arrowHead={arrowHead} pathType={pathType} />
		</ShapeAnchorOverlay>
	);
}

function ConnectorControls({
	connectorId,
	arrowHead,
	pathType,
}: {
	connectorId: string;
	arrowHead: ArrowHead;
	pathType: PathType;
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

	return (
		<div onPointerDown={(e) => e.stopPropagation()} style={barStyle}>
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
