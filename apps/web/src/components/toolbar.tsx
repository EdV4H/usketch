import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { useCallback, useState } from "react";
import { ShareDialog } from "./share-dialog.js";

export function Toolbar({
	boardId,
	isCloudBoard,
	wsProvider,
}: {
	boardId?: string;
	isCloudBoard?: boolean;
	wsProvider?: {
		awareness: {
			setLocalStateField: (field: string, value: unknown) => void;
			getLocalState: () => Record<string, unknown> | null;
			getStates: () => Map<number, Record<string, unknown>>;
			doc: { clientID: number };
		};
	} | null;
}) {
	const app = useApp();
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());
	const tools = app.tools.getOrdered();
	const [exporting, setExporting] = useState(false);
	const [showExportMenu, setShowExportMenu] = useState(false);
	const [showShare, setShowShare] = useState(false);
	const [showStatus, setShowStatus] = useState(false);
	const [currentStatus, setCurrentStatus] = useState("active");
	const [followingName, setFollowingName] = useState<string | null>(null);
	const [showFollowMenu, setShowFollowMenu] = useState(false);

	const handleExport = useCallback(
		async (format: "png" | "svg") => {
			setExporting(true);
			setShowExportMenu(false);
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
		setShowExportMenu(false);
		import("@edv4h/usketch-plugin-export").then(({ exportJson, downloadBlob }) => {
			const shapes = new Map(app.store.getShapes());
			const blob = exportJson(shapes);
			downloadBlob(blob, "usketch-export.json");
		});
	}, [app.store]);

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

			{/* ステータス + Follow（左下） */}
			{isCloudBoard && wsProvider && (
				<div
					style={{
						position: "fixed",
						bottom: 12,
						left: 12,
						zIndex: 100,
						display: "flex",
						gap: 6,
						alignItems: "center",
					}}
				>
					<button
						type="button"
						onClick={() => setShowStatus((v) => !v)}
						style={{
							height: 36,
							padding: "0 12px",
							background: "white",
							border: "none",
							borderRadius: 8,
							boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
							fontSize: 12,
							cursor: "pointer",
							color: "#333",
						}}
					>
						{currentStatus === "active" ? "🟢" : currentStatus === "away" ? "💤" : "🔴"}{" "}
						{currentStatus}
					</button>
					{showStatus && (
						<div
							style={{
								position: "absolute",
								bottom: 42,
								left: 0,
								background: "white",
								borderRadius: 8,
								boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
								overflow: "hidden",
								minWidth: 120,
							}}
						>
							{(["active", "away", "busy"] as const).map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => {
										setCurrentStatus(s);
										setShowStatus(false);
										const existing =
											(wsProvider.awareness.getLocalState()?.user as Record<string, unknown>) ?? {};
										wsProvider.awareness.setLocalStateField("user", {
											...existing,
											status: s,
										});
									}}
									style={{
										...menuItemStyle,
										fontWeight: currentStatus === s ? 600 : 400,
									}}
								>
									{s === "active" ? "🟢" : s === "away" ? "💤" : "🔴"} {s}
								</button>
							))}
						</div>
					)}
					<div style={{ position: "relative" }}>
						<button
							type="button"
							onClick={() => {
								if (followingName) {
									app.events.emit("follow:stop", {});
									setFollowingName(null);
								} else {
									setShowFollowMenu((v) => !v);
								}
							}}
							style={{
								height: 36,
								padding: "0 14px",
								background: followingName ? "#e3f2fd" : "white",
								color: followingName ? "#1976d2" : "#333",
								border: "none",
								borderRadius: 8,
								boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
								fontSize: 12,
								fontWeight: 600,
								cursor: "pointer",
							}}
							title="Follow a member (f)"
						>
							{followingName ? `Unfollow ${followingName}` : "Follow"}
						</button>
						{showFollowMenu &&
							(() => {
								const states = wsProvider.awareness.getStates();
								const members: { clientId: number; name: string; presenting: boolean }[] = [];
								for (const [clientId, state] of states) {
									if (clientId === wsProvider.awareness.doc.clientID) continue;
									const user = state.user as { name?: string } | undefined;
									members.push({
										clientId,
										name: user?.name ?? "Unknown",
										presenting: state.presenting === true,
									});
								}
								return (
									<div
										style={{
											position: "absolute",
											bottom: 42,
											left: 0,
											background: "white",
											borderRadius: 8,
											boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
											overflow: "hidden",
											minWidth: 160,
										}}
									>
										{members.length === 0 ? (
											<div style={{ ...menuItemStyle, color: "#999" }}>No other members online</div>
										) : (
											members.map((m) => (
												<button
													key={m.clientId}
													type="button"
													onClick={() => {
														setFollowingName(m.name);
														setShowFollowMenu(false);
														app.events.emit("follow:start", {
															clientId: m.clientId,
															name: m.name,
														});
													}}
													style={{
														...menuItemStyle,
														fontWeight: m.presenting ? 600 : 400,
													}}
												>
													{m.presenting ? "📺 " : ""}
													{m.name}
												</button>
											))
										)}
									</div>
								);
							})()}
					</div>
				</div>
			)}

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
						<button type="button" onClick={handleExportJson} style={menuItemStyle}>
							JSON
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
