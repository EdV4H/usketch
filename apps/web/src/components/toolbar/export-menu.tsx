import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { dropdownStyle, menuItemStyle } from "../../lib/styles.js";

export function ExportMenu({
	isCloudBoard,
	boardId,
}: {
	isCloudBoard?: boolean;
	boardId?: string;
}) {
	const app = useApp();
	const [exporting, setExporting] = useState(false);
	const [showMenu, setShowMenu] = useState(false);

	const handleExport = useCallback(
		async (format: "png" | "svg") => {
			setExporting(true);
			setShowMenu(false);
			try {
				const { exportCanvas, downloadBlob } = await import("@edv4h/usketch-plugin-export");
				const shapes = new Map(app.store.getShapes());
				const blob = await exportCanvas(shapes, app.shapes, { format });
				downloadBlob(blob, `usketch-export.${format}`);
			} catch (e) {
				console.error("Export failed:", e);
			} finally {
				setExporting(false);
			}
		},
		[app.store, app.shapes],
	);

	const handleExportJson = useCallback(() => {
		setShowMenu(false);
		import("@edv4h/usketch-plugin-export").then(({ exportJson, downloadBlob }) => {
			const shapes = new Map(app.store.getShapes());
			const blob = exportJson(shapes);
			downloadBlob(blob, "usketch-export.json");
		});
	}, [app.store]);

	return (
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
				onClick={() => setShowMenu((v) => !v)}
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
			{showMenu && (
				<div style={{ ...dropdownStyle, top: 50, right: 0, minWidth: 140 }}>
					<button type="button" onClick={() => handleExport("png")} style={menuItemStyle}>
						PNG
					</button>
					<button type="button" onClick={() => handleExport("svg")} style={menuItemStyle}>
						SVG
					</button>
					<button type="button" onClick={handleExportJson} style={menuItemStyle}>
						JSON
					</button>
				</div>
			)}
		</div>
	);
}
