import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { useState } from "react";
import { actionBtnStyle, dividerStyle } from "../../lib/styles.js";
import { ShareDialog } from "../share-dialog.js";
import { StylePanel } from "../style-panel/index.js";
import { BgToggle } from "./bg-toggle.js";
import { CopilotToggle } from "./copilot-toggle.js";
import { ExportMenu } from "./export-menu.js";
import { StatusBar } from "./status-bar.js";
import { ToolButton } from "./tool-button.js";
import { VoiceButton } from "./voice-button.js";

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
	const [showShare, setShowShare] = useState(false);

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
					<ToolButton
						key={id}
						id={id}
						definition={definition}
						isActive={activeToolId === id}
						onSelect={() => app.store.setActiveToolId(id)}
					/>
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
				<BgToggle />

				{isCloudBoard && (
					<>
						<Divider />
						<CopilotToggle />
						<VoiceButton />
					</>
				)}
			</div>

			{/* ステータス + Follow（左下） */}
			{isCloudBoard && wsProvider && <StatusBar wsProvider={wsProvider} />}

			{/* エクスポート（右上、Shareの左） */}
			<ExportMenu isCloudBoard={isCloudBoard} boardId={boardId} />

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

			<StylePanel />
		</>
	);
}

function Divider() {
	return <div style={dividerStyle} />;
}
