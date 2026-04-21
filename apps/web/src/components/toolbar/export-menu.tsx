import { useApp } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { I, IconBtn } from "../ui/index.js";

interface Props {
	isCloudBoard?: boolean;
	boardId?: string;
	/**
	 * true の場合、コンポーネントを fixed で画面右上に配置する（旧挙動）。
	 * false の場合は親要素のレイアウトに従う（新しい TopRightCluster 用）。既定は false。
	 */
	standalone?: boolean;
}

export function ExportMenu({ isCloudBoard, boardId, standalone = false }: Props) {
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

	const wrapperStyle: React.CSSProperties = standalone
		? {
				position: "fixed",
				top: 12,
				right: isCloudBoard && boardId ? 92 : 12,
				zIndex: 100,
			}
		: { position: "relative", display: "inline-flex" };

	return (
		<div style={wrapperStyle}>
			<div className="u-surface" style={{ display: "flex", padding: 3, borderRadius: 10 }}>
				<IconBtn
					icon={I.download}
					label="エクスポート"
					onClick={() => setShowMenu((v) => !v)}
					active={showMenu}
					disabled={exporting}
				/>
			</div>
			{showMenu && (
				<div
					className="u-surface"
					style={{
						position: "absolute",
						top: "calc(100% + 6px)",
						right: 0,
						minWidth: 200,
						padding: 6,
						borderRadius: 10,
						background: "var(--bg-surface-raised)",
						boxShadow: "var(--shadow-3)",
						zIndex: 100,
						display: "flex",
						flexDirection: "column",
						gap: 1,
					}}
				>
					{[
						{
							label: "PNG 形式",
							sub: "ラスタ画像",
							shortcut: "⌘⇧E",
							run: () => handleExport("png"),
						},
						{
							label: "SVG 形式",
							sub: "ベクタ画像",
							shortcut: "⌘⇧⌥E",
							run: () => handleExport("svg"),
						},
						{ label: "JSON 形式", sub: "ボード完全保存", shortcut: "⌘⇧J", run: handleExportJson },
					].map((item) => (
						<button
							key={item.label}
							type="button"
							onClick={item.run}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "7px 10px",
								background: "transparent",
								border: "none",
								borderRadius: 6,
								cursor: "pointer",
								textAlign: "left",
								color: "var(--fg-primary)",
								fontFamily: "inherit",
								fontSize: 12.5,
							}}
						>
							<div style={{ flex: 1 }}>
								<div style={{ fontWeight: 500 }}>{item.label}</div>
								<div style={{ fontSize: 10.5, color: "var(--fg-tertiary)", marginTop: 1 }}>
									{item.sub}
								</div>
							</div>
							<span className="u-kbd">{item.shortcut}</span>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
