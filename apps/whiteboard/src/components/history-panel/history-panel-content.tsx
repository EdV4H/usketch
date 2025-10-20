import { whiteboardStore } from "@usketch/store";
import type React from "react";
import { useEffect, useState } from "react";

interface HistoryInfo {
	commands: Array<{ description: string; timestamp: number; id: string }>;
	currentIndex: number;
}

/**
 * Hook for managing history state
 */
function useHistoryInfo() {
	const [historyInfo, setHistoryInfo] = useState<HistoryInfo>({ commands: [], currentIndex: -1 });

	useEffect(() => {
		const updateHistory = () => {
			const info = whiteboardStore.getState().getHistoryDebugInfo();
			setHistoryInfo(info);
		};

		// Initial update
		updateHistory();

		// Update every 500ms
		const interval = setInterval(updateHistory, 500);

		// Also update on store changes
		const unsubscribe = whiteboardStore.subscribe(updateHistory);

		return () => {
			clearInterval(interval);
			unsubscribe();
		};
	}, []);

	return historyInfo;
}

/**
 * Utility functions for formatting
 */
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

/**
 * History Panel Content for Sidebar
 *
 * Displays command history without FloatingWindow wrapper.
 * Optimized for sidebar integration.
 */
export const HistoryPanelContent: React.FC = () => {
	const historyInfo = useHistoryInfo();
	const totalCommands = historyInfo.commands.length;
	const currentPosition = historyInfo.currentIndex + 1;

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				padding: "1rem",
			}}
		>
			<style>
				{`
					.history-panel-scrollbar::-webkit-scrollbar {
						width: 6px;
					}
					.history-panel-scrollbar::-webkit-scrollbar-track {
						background: transparent;
					}
					.history-panel-scrollbar::-webkit-scrollbar-thumb {
						background: rgba(0, 0, 0, 0.2);
						border-radius: 3px;
					}
					.history-panel-scrollbar::-webkit-scrollbar-thumb:hover {
						background: rgba(0, 0, 0, 0.3);
					}
				`}
			</style>

			{/* Header */}
			<div style={{ marginBottom: "1rem" }}>
				<h3 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 0.5rem 0", color: "#333" }}>
					履歴
				</h3>
				<div style={{ fontSize: "13px", color: "#666" }}>
					{currentPosition}/{totalCommands} コマンド
				</div>
			</div>

			{/* Statistics */}
			<div
				style={{
					padding: "0.75rem",
					background: "#f8f9fa",
					borderRadius: "6px",
					marginBottom: "1rem",
					display: "flex",
					gap: "1rem",
					fontSize: "12px",
				}}
			>
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
						{historyInfo.currentIndex >= 0 ? "可能" : "不可"}
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
						{historyInfo.currentIndex < totalCommands - 1 ? "可能" : "不可"}
					</span>
				</div>
			</div>

			{/* Command List */}
			<div
				className="history-panel-scrollbar"
				style={{
					flex: 1,
					overflowY: "auto",
					marginBottom: "1rem",
				}}
			>
				{historyInfo.commands.length === 0 ? (
					<div
						style={{
							textAlign: "center",
							padding: "2rem 1rem",
							color: "#adb5bd",
						}}
					>
						<p style={{ fontSize: "14px", margin: 0 }}>履歴がありません</p>
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
						{historyInfo.commands.map((cmd: any, index: number) => {
							const isCurrent = index === historyInfo.currentIndex;
							const isPast = index <= historyInfo.currentIndex;
							const isFuture = index > historyInfo.currentIndex;

							return (
								<div
									key={`${cmd.id}-${index}`}
									style={{
										padding: "0.5rem 0.75rem",
										borderRadius: "6px",
										fontSize: "12px",
										background: isCurrent ? "#667eea" : isPast ? "#f8f9fa" : "#e9ecef",
										color: isCurrent ? "white" : isPast ? "#495057" : "#adb5bd",
										opacity: isFuture ? 0.6 : 1,
										transition: "all 0.2s",
										border: isCurrent ? "none" : "1px solid rgba(0, 0, 0, 0.05)",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
										}}
									>
										<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
											<span
												style={{
													fontSize: "10px",
													fontWeight: "700",
													width: "24px",
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
														padding: "0.125rem 0.375rem",
														background: "rgba(255, 255, 255, 0.3)",
														borderRadius: "12px",
														fontSize: "9px",
														fontWeight: "700",
													}}
												>
													現在
												</span>
											)}
										</div>
										<span style={{ fontSize: "10px", opacity: 0.7 }}>
											{formatTimestamp(cmd.timestamp)}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Actions */}
			<div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
				<button
					type="button"
					onClick={() => whiteboardStore.getState().undo()}
					disabled={historyInfo.currentIndex < 0}
					style={{
						flex: 1,
						padding: "0.5rem",
						background: historyInfo.currentIndex >= 0 ? "#667eea" : "#e9ecef",
						color: historyInfo.currentIndex >= 0 ? "white" : "#adb5bd",
						border: "none",
						borderRadius: "6px",
						fontSize: "13px",
						fontWeight: "600",
						cursor: historyInfo.currentIndex >= 0 ? "pointer" : "not-allowed",
						transition: "all 0.2s",
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
						padding: "0.5rem",
						background: historyInfo.currentIndex < totalCommands - 1 ? "#667eea" : "#e9ecef",
						color: historyInfo.currentIndex < totalCommands - 1 ? "white" : "#adb5bd",
						border: "none",
						borderRadius: "6px",
						fontSize: "13px",
						fontWeight: "600",
						cursor: historyInfo.currentIndex < totalCommands - 1 ? "pointer" : "not-allowed",
						transition: "all 0.2s",
					}}
				>
					↷ Redo
				</button>
				<button
					type="button"
					onClick={() => {
						if (window.confirm("履歴をクリアしますか？")) {
							whiteboardStore.getState().clearHistory();
						}
					}}
					style={{
						padding: "0.5rem 0.75rem",
						background: "#f5576c",
						color: "white",
						border: "none",
						borderRadius: "6px",
						fontSize: "13px",
						fontWeight: "600",
						cursor: "pointer",
						transition: "all 0.2s",
					}}
				>
					🗑
				</button>
			</div>
		</div>
	);
};
