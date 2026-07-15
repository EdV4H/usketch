import { useNavigate } from "react-router";
import { Divider, I, IconBtn, ThemeToggle } from "../ui/index.js";
import { CopilotToggle } from "./copilot-toggle.js";
import { StatusBar } from "./status-bar.js";
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
 * 画面下中央に固定された薄いバー。
 *
 * ツール切替 / undo-redo / 背景 / スタイル編集などの **shape/tool 系操作は
 * Control HUD(バッククォートで開く)に一本化された**ため、ここには app 全体系
 * (テーマ) と Cloud 限定(Copilot / Voice / Present / Status)と コマンドパレット
 * 入口だけを残す。
 */
export function Toolbar({
	boardId,
	isCloudBoard,
	wsProvider,
	onOpenCommandPalette,
	compact,
}: Props) {
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
		</>
	);
}
