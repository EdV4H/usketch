import { ShapeAnchorOverlay } from "@edv4h/usketch-canvas-engine";

interface PortalActionsOverlayProps {
	shapeIds: ReadonlySet<string>;
	onOpen: () => void;
	onInfo: () => void;
}

export function PortalActionsOverlay({ shapeIds, onOpen, onInfo }: PortalActionsOverlayProps) {
	return (
		<ShapeAnchorOverlay
			shapeIds={shapeIds}
			position="bottom"
			fallback="top"
			gap={8}
			edgePadding={8}
		>
			<div style={styles.bar}>
				<button type="button" onClick={onOpen} style={styles.button}>
					Open
				</button>
				<button type="button" onClick={onInfo} style={styles.buttonSecondary}>
					Info
				</button>
			</div>
		</ShapeAnchorOverlay>
	);
}

const styles = {
	bar: {
		display: "flex",
		gap: 4,
		padding: 4,
		background: "#fff",
		borderRadius: 8,
		boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
	},
	button: {
		padding: "5px 12px",
		fontSize: 12,
		fontWeight: 600,
		cursor: "pointer",
		border: "none",
		borderRadius: 6,
		background: "#3b82f6",
		color: "#fff",
		fontFamily: "system-ui, sans-serif",
	},
	buttonSecondary: {
		padding: "5px 12px",
		fontSize: 12,
		fontWeight: 600,
		cursor: "pointer",
		border: "1px solid #e2e8f0",
		borderRadius: 6,
		background: "#fff",
		color: "#475569",
		fontFamily: "system-ui, sans-serif",
	},
} as const;
