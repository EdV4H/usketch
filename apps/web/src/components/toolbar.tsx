import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { downloadBlob, exportCanvas } from "@edv4h/usketch-plugin-export";
import { useCallback, useState } from "react";
import { ShareDialog } from "./share-dialog.js";

export function Toolbar({ boardId, isCloudBoard }: { boardId?: string; isCloudBoard?: boolean }) {
	const app = useApp();
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());
	const tools = app.tools.getOrdered();
	const [exporting, setExporting] = useState(false);
	const [showShare, setShowShare] = useState(false);

	const handleExportPng = useCallback(async () => {
		setExporting(true);
		try {
			const shapes = new Map(app.store.getShapes());
			const blob = await exportCanvas(shapes, app.shapes, { format: "png" });
			downloadBlob(blob, "usketch-export.png");
		} finally {
			setExporting(false);
		}
	}, [app.store, app.shapes]);

	const handleExportSvg = useCallback(async () => {
		setExporting(true);
		try {
			const shapes = new Map(app.store.getShapes());
			const blob = await exportCanvas(shapes, app.shapes, { format: "svg" });
			downloadBlob(blob, "usketch-export.svg");
		} finally {
			setExporting(false);
		}
	}, [app.store, app.shapes]);

	return (
		<>
			<div
				style={{
					position: "fixed",
					top: 12,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 4,
					padding: 4,
					background: "white",
					borderRadius: 8,
					boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
					zIndex: 100,
					alignItems: "center",
				}}
			>
				{/* ホームリンク */}
				<a
					href="/"
					title="Dashboard"
					style={{ ...actionBtnStyle, textDecoration: "none", fontSize: 14 }}
				>
					⌂
				</a>

				<Divider />

				{/* ツール */}
				{tools.map(({ id, definition }) => (
					<button
						key={id}
						type="button"
						onClick={() => app.store.setActiveToolId(id)}
						title={`${id}${definition.shortcut ? ` (${definition.shortcut})` : ""}`}
						style={{
							width: 36,
							height: 36,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							border: "none",
							borderRadius: 6,
							background: activeToolId === id ? "#e3f2fd" : "transparent",
							color: activeToolId === id ? "#1976d2" : "#333",
							cursor: "pointer",
						}}
					>
						{definition.icon()}
					</button>
				))}

				<Divider />

				{/* Undo/Redo */}
				<button
					type="button"
					onClick={() => app.commands.undo()}
					title="Undo (Ctrl+Z)"
					style={actionBtnStyle}
				>
					↩
				</button>
				<button
					type="button"
					onClick={() => app.commands.redo()}
					title="Redo (Ctrl+Shift+Z)"
					style={actionBtnStyle}
				>
					↪
				</button>

				<Divider />

				{/* エクスポート */}
				<button
					type="button"
					onClick={handleExportPng}
					disabled={exporting}
					title="Export PNG (Ctrl+Shift+E)"
					style={actionBtnStyle}
				>
					PNG
				</button>
				<button
					type="button"
					onClick={handleExportSvg}
					disabled={exporting}
					title="Export SVG (Ctrl+Shift+Alt+E)"
					style={actionBtnStyle}
				>
					SVG
				</button>

				{/* 共有（Cloud Boardのみ） */}
				{isCloudBoard && boardId && (
					<>
						<Divider />
						<button
							type="button"
							onClick={() => setShowShare(true)}
							title="Share"
							style={{ ...actionBtnStyle, fontSize: 13 }}
						>
							Share
						</button>
					</>
				)}
			</div>

			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}

function Divider() {
	return <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 2px" }} />;
}

const actionBtnStyle: React.CSSProperties = {
	width: 36,
	height: 36,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	border: "none",
	borderRadius: 6,
	background: "transparent",
	color: "#666",
	cursor: "pointer",
	fontSize: 11,
	fontWeight: 600,
};
