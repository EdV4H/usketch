import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { downloadBlob, exportCanvas } from "@edv4h/usketch-plugin-export";
import { useCallback, useState } from "react";
import { ShareDialog } from "./share-dialog.js";

export function Toolbar({ boardId, isCloudBoard }: { boardId?: string; isCloudBoard?: boolean }) {
	const app = useApp();
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());
	const tools = app.tools.getOrdered();
	const [exporting, setExporting] = useState(false);
	const [showExportMenu, setShowExportMenu] = useState(false);
	const [showShare, setShowShare] = useState(false);

	const handleExport = useCallback(
		async (format: "png" | "svg") => {
			setExporting(true);
			setShowExportMenu(false);
			try {
				const shapes = new Map(app.store.getShapes());
				const blob = await exportCanvas(shapes, app.shapes, { format });
				downloadBlob(blob, `usketch-export.${format}`);
			} finally {
				setExporting(false);
			}
		},
		[app.store, app.shapes],
	);

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
			</div>

			{/* エクスポート（右上、Shareの左） */}
			<div
				style={{
					position: "fixed",
					top: 12,
					right: isCloudBoard && boardId ? 92 : 12,
					zIndex: 100,
				}}
			>
				<button
					type="button"
					onClick={() => setShowExportMenu((v) => !v)}
					disabled={exporting}
					style={{
						height: 44,
						padding: "0 16px",
						background: "white",
						border: "none",
						borderRadius: 8,
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						fontSize: 13,
						fontWeight: 600,
						color: "#333",
						cursor: "pointer",
					}}
				>
					{exporting ? "Exporting..." : "Export"}
				</button>
				{showExportMenu && (
					<div
						style={{
							position: "absolute",
							top: 50,
							right: 0,
							background: "white",
							borderRadius: 8,
							boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
							overflow: "hidden",
							minWidth: 140,
						}}
					>
						<button type="button" onClick={() => handleExport("png")} style={menuItemStyle}>
							PNG
						</button>
						<button type="button" onClick={() => handleExport("svg")} style={menuItemStyle}>
							SVG
						</button>
					</div>
				)}
			</div>

			{/* 共有ボタン（右上、Cloud Boardのみ） */}
			{isCloudBoard && boardId && (
				<button
					type="button"
					onClick={() => setShowShare(true)}
					style={{
						position: "fixed",
						top: 12,
						right: 12,
						height: 44,
						padding: "0 16px",
						background: "#0066ff",
						color: "#fff",
						border: "none",
						borderRadius: 8,
						fontSize: 13,
						fontWeight: 600,
						cursor: "pointer",
						boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
						zIndex: 100,
					}}
				>
					Share
				</button>
			)}

			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}

function Divider() {
	return <div style={{ width: 1, height: 24, background: "#e0e0e0", margin: "0 2px" }} />;
}

const menuItemStyle: React.CSSProperties = {
	display: "block",
	width: "100%",
	padding: "10px 16px",
	border: "none",
	background: "none",
	textAlign: "left",
	fontSize: 13,
	cursor: "pointer",
	color: "#333",
};

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
