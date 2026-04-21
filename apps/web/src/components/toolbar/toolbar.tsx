import { useApp, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { useNavigate } from "react-router";
import { StylePanel } from "../style-panel/index.js";
import { Divider, I, IconBtn, ThemeToggle } from "../ui/index.js";
import { BgToggle } from "./bg-toggle.js";
import { CopilotToggle } from "./copilot-toggle.js";
import { StatusBar } from "./status-bar.js";
import { ToolButton } from "./tool-button.js";
import { VoiceButton } from "./voice-button.js";

interface Props {
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
	onOpenCommandPalette: () => void;
	/** プレゼン編集モード中は Cloud 限定ボタン群 (Copilot / Voice / Present / StatusBar) を隠す */
	compact?: boolean;
}

/**
 * 画面下中央に固定された主ツールバー。
 * - 左: ツール（select / pan / 各 shape 描画）
 * - 中央: Undo/Redo + 背景切替 + テーマ切替
 * - 右: Cloud 専用（Copilot / Voice / Present）
 * - 上付き pill: Cmd+K ハンドル
 */
export function Toolbar({
	boardId,
	isCloudBoard,
	wsProvider,
	onOpenCommandPalette,
	compact,
}: Props) {
	const app = useApp();
	const activeToolId = useStoreSubscribe(app.store, (s) => s.getActiveToolId());
	const tools = app.tools.getOrdered();
	const navigate = useNavigate();

	return (
		<>
			<div
				data-testid="toolbar"
				className="u-surface"
				style={{
					position: "fixed",
					bottom: 12,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 2,
					padding: 4,
					borderRadius: 12,
					zIndex: 100,
					alignItems: "center",
				}}
			>
				{tools.map(({ id, definition }) => (
					<ToolButton
						key={id}
						id={id}
						definition={definition}
						isActive={activeToolId === id}
						onSelect={() => app.store.setActiveToolId(id)}
					/>
				))}

				<Divider vertical />

				<IconBtn icon={I.undo} label="元に戻す" shortcut="⌘Z" onClick={() => app.commands.undo()} />
				<IconBtn
					icon={I.redo}
					label="やり直す"
					shortcut="⌘⇧Z"
					onClick={() => app.commands.redo()}
				/>

				<Divider vertical />

				<BgToggle />

				<div style={{ padding: "0 2px", display: "inline-flex", alignItems: "center" }}>
					<ThemeToggle />
				</div>

				{isCloudBoard && !compact && (
					<>
						<Divider vertical />
						<CopilotToggle />
						<VoiceButton />
						{boardId && (
							<IconBtn
								icon={I.present}
								label="プレゼンテーション"
								onClick={() => navigate(`/boards/${boardId}?present=1`)}
							/>
						)}
					</>
				)}

				<Divider vertical />

				<IconBtn
					icon={I.search}
					label="コマンドパレット"
					shortcut="⌘K"
					onClick={onOpenCommandPalette}
				/>
			</div>

			{isCloudBoard && wsProvider && !compact && <StatusBar wsProvider={wsProvider} />}

			<StylePanel />
		</>
	);
}
