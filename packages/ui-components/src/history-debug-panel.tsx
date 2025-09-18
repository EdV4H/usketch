import { whiteboardStore } from "@usketch/store";
import { useEffect, useState } from "react";

interface HistoryDebugPanelProps {
	onClose?: () => void;
}

export function HistoryDebugPanel({ onClose }: HistoryDebugPanelProps) {
	const [isOpen, setIsOpen] = useState(true);
	const [isExpanded, setIsExpanded] = useState(true);
	const [historyInfo, setHistoryInfo] = useState<{
		commands: Array<{ description: string; timestamp: number; id: string }>;
		currentIndex: number;
	}>({ commands: [], currentIndex: -1 });

	// Update history info periodically
	useEffect(() => {
		const updateHistory = () => {
			const info = whiteboardStore.getState().getHistoryDebugInfo();
			setHistoryInfo(info);
		};

		// Initial update
		updateHistory();

		// Update every 500ms when panel is open
		const interval = setInterval(updateHistory, 500);

		// Also update on store changes
		const unsubscribe = whiteboardStore.subscribe(updateHistory);

		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	}, []);

	const handleClose = () => {
		if (onClose) {
			onClose();
		} else {
			setIsOpen(false);
		}
	};

	const formatTimestamp = (timestamp: number) => {
		const date = new Date(timestamp);
		const time = date.toLocaleTimeString("ja-JP", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		const ms = date.getMilliseconds().toString().padStart(3, "0");
		return `${time}.${ms}`;
	};

	const formatDescription = (description: string) => {
		// Shorten common descriptions
		return description
			.replace("Create rectangle", "📦 Rectangle")
			.replace("Create ellipse", "⭕ Ellipse")
			.replace("Create freedraw", "✏️ Freedraw")
			.replace("Batch update shapes", "🔄 Batch Move")
			.replace("Set selection to", "👆 Select")
			.replace("Update shape", "✏️ Update")
			.replace("Delete shape", "🗑️ Delete")
			.replace("Clear selection", "❌ Clear Sel");
	};

	const totalCommands = historyInfo.commands.length;
	const currentPosition = historyInfo.currentIndex + 1;

	if (!isOpen) return null;

	return (
		<div
			style={{
				position: "fixed",
				bottom: "1rem",
				right: "1rem",
				width: "400px",
				maxHeight: "600px",
				background: "linear-gradient(to bottom, #ffffff, #fafafa)",
				border: "1px solid rgba(0, 0, 0, 0.12)",
				borderRadius: "12px",
				boxShadow: "0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.1)",
				display: "flex",
				flexDirection: "column",
				zIndex: 1001,
				animation: "slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
			}}
		>
			<style>
				{`
					@keyframes slideUp {
						from {
							opacity: 0;
							transform: translateY(20px) scale(0.95);
						}
						to {
							opacity: 1;
							transform: translateY(0) scale(1);
						}
					}
					.history-panel-scrollbar::-webkit-scrollbar {
						width: 8px;
					}
					.history-panel-scrollbar::-webkit-scrollbar-track {
						background: transparent;
					}
					.history-panel-scrollbar::-webkit-scrollbar-thumb {
						background: rgba(0, 0, 0, 0.2);
						border-radius: 4px;
					}
					.history-panel-scrollbar::-webkit-scrollbar-thumb:hover {
						background: rgba(0, 0, 0, 0.3);
					}
				`}
			</style>

			{/* Header */}
			<div
				style={{
					padding: "1rem 1.25rem",
					background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
					borderRadius: "12px 12px 0 0",
					color: "white",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
						<div
							style={{
								width: "32px",
								height: "32px",
								background: "rgba(255, 255, 255, 0.2)",
								borderRadius: "8px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								aria-label="History icon"
							>
								<circle cx="12" cy="12" r="10" />
								<polyline points="12 6 12 12 16 14" />
							</svg>
						</div>
						<div>
							<h3 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>History Debug</h3>
							<div style={{ fontSize: "13px", opacity: 0.9, marginTop: "2px" }}>
								{currentPosition}/{totalCommands} commands
							</div>
						</div>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
						<button
							type="button"
							onClick={() => setIsExpanded(!isExpanded)}
							style={{
								padding: "0.375rem",
								background: "rgba(255, 255, 255, 0.2)",
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								transition: "all 0.2s",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
							title={isExpanded ? "Collapse" : "Expand"}
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="white"
								strokeWidth="2"
								aria-label={isExpanded ? "Collapse" : "Expand"}
							>
								{isExpanded ? (
									<polyline points="18 15 12 9 6 15" />
								) : (
									<polyline points="6 9 12 15 18 9" />
								)}
							</svg>
						</button>
						<button
							type="button"
							onClick={handleClose}
							style={{
								padding: "0.375rem",
								background: "rgba(255, 255, 255, 0.2)",
								border: "none",
								borderRadius: "6px",
								cursor: "pointer",
								transition: "all 0.2s",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
							title="Close"
							onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)")}
							onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)")}
						>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="white"
								strokeWidth="2"
								aria-label="Close"
							>
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>
				</div>
			</div>

			{/* Statistics Bar */}
			<div
				style={{
					padding: "0.75rem 1.25rem",
					background: "#f8f9fa",
					borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
					display: "flex",
					gap: "1.5rem",
					alignItems: "center",
				}}
			>
				<div style={{ display: "flex", gap: "1.5rem", fontSize: "13px", color: "#495057" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
						<span style={{ fontWeight: "600" }}>Undo:</span>
						<span
							style={{
								padding: "0.125rem 0.5rem",
								borderRadius: "12px",
								background: historyInfo.currentIndex >= 0 ? "#d4edda" : "#f8d7da",
								color: historyInfo.currentIndex >= 0 ? "#155724" : "#721c24",
								fontWeight: "500",
							}}
						>
							{historyInfo.currentIndex >= 0 ? "Available" : "Disabled"}
						</span>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
						<span style={{ fontWeight: "600" }}>Redo:</span>
						<span
							style={{
								padding: "0.125rem 0.5rem",
								borderRadius: "12px",
								background: historyInfo.currentIndex < totalCommands - 1 ? "#d4edda" : "#f8d7da",
								color: historyInfo.currentIndex < totalCommands - 1 ? "#155724" : "#721c24",
								fontWeight: "500",
							}}
						>
							{historyInfo.currentIndex < totalCommands - 1 ? "Available" : "Disabled"}
						</span>
					</div>
				</div>
			</div>

			{/* Command List */}
			{isExpanded && (
				<div
					className="history-panel-scrollbar"
					style={{
						flex: 1,
						overflowY: "auto",
						padding: "1rem",
						background: "#ffffff",
					}}
				>
					{historyInfo.commands.length === 0 ? (
						<div
							style={{
								textAlign: "center",
								padding: "3rem 1rem",
								color: "#adb5bd",
							}}
						>
							<svg
								width="48"
								height="48"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								style={{ margin: "0 auto 1rem", opacity: 0.5 }}
								aria-label="Empty history"
							>
								<polygon points="12 2 2 7 2 17 12 22 22 17 22 7 12 2" />
								<polyline points="2 7 12 12 22 7" />
								<polyline points="12 22 12 12" />
							</svg>
							<p style={{ fontSize: "14px", margin: 0 }}>No commands in history</p>
						</div>
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
							{historyInfo.commands.map((cmd, index) => {
								const isCurrent = index === historyInfo.currentIndex;
								const isPast = index <= historyInfo.currentIndex;
								const isFuture = index > historyInfo.currentIndex;

								return (
									<div
										key={`${cmd.id}-${index}`}
										style={{
											padding: "0.75rem 1rem",
											borderRadius: "8px",
											fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', monospace",
											fontSize: "13px",
											background: isCurrent
												? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
												: isPast
													? "#f8f9fa"
													: "#e9ecef",
											color: isCurrent ? "white" : isPast ? "#495057" : "#adb5bd",
											opacity: isFuture ? 0.6 : 1,
											transition: "all 0.2s",
											boxShadow: isCurrent ? "0 4px 12px rgba(102, 126, 234, 0.25)" : "none",
											transform: isCurrent ? "scale(1.02)" : "scale(1)",
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
												<span
													style={{
														fontSize: "11px",
														fontWeight: "700",
														width: "32px",
														textAlign: "center",
														background: isCurrent ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.05)",
														padding: "0.125rem 0.25rem",
														borderRadius: "4px",
													}}
												>
													{index + 1}
												</span>
												<span style={{ fontWeight: isCurrent ? "600" : "400" }}>
													{formatDescription(cmd.description)}
												</span>
												{isCurrent && (
													<span
														style={{
															padding: "0.125rem 0.5rem",
															background: "rgba(255, 255, 255, 0.3)",
															borderRadius: "12px",
															fontSize: "10px",
															fontWeight: "700",
															letterSpacing: "0.5px",
														}}
													>
														CURRENT
													</span>
												)}
											</div>
											<span style={{ fontSize: "11px", opacity: 0.7 }}>
												{formatTimestamp(cmd.timestamp)}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Actions */}
			<div
				style={{
					padding: "1rem 1.25rem",
					borderTop: "1px solid rgba(0, 0, 0, 0.08)",
					background: "linear-gradient(to bottom, #f8f9fa, #ffffff)",
					borderRadius: "0 0 12px 12px",
				}}
			>
				<div style={{ display: "flex", gap: "0.5rem" }}>
					<button
						type="button"
						onClick={() => whiteboardStore.getState().undo()}
						disabled={historyInfo.currentIndex < 0}
						style={{
							flex: 1,
							padding: "0.5rem 1rem",
							background:
								historyInfo.currentIndex >= 0
									? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
									: "#e9ecef",
							color: historyInfo.currentIndex >= 0 ? "white" : "#adb5bd",
							border: "none",
							borderRadius: "8px",
							fontSize: "14px",
							fontWeight: "600",
							cursor: historyInfo.currentIndex >= 0 ? "pointer" : "not-allowed",
							transition: "all 0.2s",
							boxShadow:
								historyInfo.currentIndex >= 0 ? "0 2px 8px rgba(102, 126, 234, 0.2)" : "none",
						}}
						onMouseEnter={(e) => {
							if (historyInfo.currentIndex >= 0) {
								e.currentTarget.style.transform = "translateY(-1px)";
								e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
							}
						}}
						onMouseLeave={(e) => {
							if (historyInfo.currentIndex >= 0) {
								e.currentTarget.style.transform = "translateY(0)";
								e.currentTarget.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.2)";
							}
						}}
					>
						↶ Undo
					</button>
					<button
						type="button"
						onClick={() => whiteboardStore.getState().redo()}
						disabled={historyInfo.currentIndex >= totalCommands - 1}
						style={{
							flex: 1,
							padding: "0.5rem 1rem",
							background:
								historyInfo.currentIndex < totalCommands - 1
									? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
									: "#e9ecef",
							color: historyInfo.currentIndex < totalCommands - 1 ? "white" : "#adb5bd",
							border: "none",
							borderRadius: "8px",
							fontSize: "14px",
							fontWeight: "600",
							cursor: historyInfo.currentIndex < totalCommands - 1 ? "pointer" : "not-allowed",
							transition: "all 0.2s",
							boxShadow:
								historyInfo.currentIndex < totalCommands - 1
									? "0 2px 8px rgba(102, 126, 234, 0.2)"
									: "none",
						}}
						onMouseEnter={(e) => {
							if (historyInfo.currentIndex < totalCommands - 1) {
								e.currentTarget.style.transform = "translateY(-1px)";
								e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.3)";
							}
						}}
						onMouseLeave={(e) => {
							if (historyInfo.currentIndex < totalCommands - 1) {
								e.currentTarget.style.transform = "translateY(0)";
								e.currentTarget.style.boxShadow = "0 2px 8px rgba(102, 126, 234, 0.2)";
							}
						}}
					>
						↷ Redo
					</button>
					<button
						type="button"
						onClick={() => {
							if (window.confirm("Clear all history?")) {
								whiteboardStore.getState().clearHistory();
							}
						}}
						style={{
							padding: "0.5rem 1rem",
							background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
							color: "white",
							border: "none",
							borderRadius: "8px",
							fontSize: "14px",
							fontWeight: "600",
							cursor: "pointer",
							transition: "all 0.2s",
							boxShadow: "0 2px 8px rgba(245, 87, 108, 0.2)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateY(-1px)";
							e.currentTarget.style.boxShadow = "0 4px 12px rgba(245, 87, 108, 0.3)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateY(0)";
							e.currentTarget.style.boxShadow = "0 2px 8px rgba(245, 87, 108, 0.2)";
						}}
					>
						🗑 Clear
					</button>
				</div>
			</div>
		</div>
	);
}
