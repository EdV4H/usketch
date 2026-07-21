import { useState } from "react";
import { useNavigate } from "react-router";
import { ShareDialog } from "../share-dialog.js";
import { CopilotToggle } from "../toolbar/copilot-toggle.js";
import { StatusBar } from "../toolbar/status-bar.js";
import { Divider, I, IconBtn, ThemeToggle } from "../ui/index.js";
import { CommunityLink } from "./community-link.js";
import { PresencePill } from "./presence-pill.js";
import { ZoomControls } from "./zoom-controls.js";

// PresencePill / StatusBar が必要とする awareness API を合わせた構造型。
type WsProvider = {
	awareness: {
		setLocalStateField: (field: string, value: unknown) => void;
		getLocalState: () => Record<string, unknown> | null;
		getStates: () => Map<number, Record<string, unknown>>;
		doc: { clientID: number };
		on?: (event: "change", cb: () => void) => void;
		off?: (event: "change", cb: () => void) => void;
	};
};

interface Props {
	boardId?: string;
	isCloudBoard: boolean;
	wsProvider?: WsProvider | null;
	onOpenCommandPalette: () => void;
	/** プレゼン編集モード中は Cloud 限定の操作群を隠す。 */
	compact?: boolean;
}

/**
 * 画面中央上部に固定された単一のコントロールバー。
 *
 * かつて四隅に散っていた chrome（ロゴ / テーマ / コマンドパレット / Cloud 限定の
 * プレゼン・Copilot・presence・共有 / ステータス・Follow / ズーム /
 * コミュニティ）を 1 本のバーに集約したもの。shape/tool 系の操作は Control HUD
 * (`` ` `` で開く) に一本化済み。
 */
export function TopBar({
	boardId,
	isCloudBoard,
	wsProvider,
	onOpenCommandPalette,
	compact,
}: Props) {
	const navigate = useNavigate();
	const [showShare, setShowShare] = useState(false);
	const showCloud = isCloudBoard && !compact;

	return (
		<>
			<div
				data-testid="top-bar"
				className="u-surface"
				style={{
					position: "fixed",
					top: 12,
					left: "50%",
					transform: "translateX(-50%)",
					display: "flex",
					gap: 4,
					padding: 4,
					borderRadius: 12,
					zIndex: 100,
					alignItems: "center",
					maxWidth: "calc(100vw - 24px)",
				}}
			>
				{/* ロゴ: ダッシュボードへ戻る */}
				<button
					type="button"
					onClick={() => navigate("/dashboard")}
					title="ダッシュボードへ戻る"
					aria-label="ダッシュボードへ戻る"
					style={{
						padding: 0,
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						border: "none",
						background: "transparent",
						cursor: "pointer",
					}}
				>
					<div
						style={{
							width: 24,
							height: 24,
							borderRadius: 6,
							background: "var(--brand-gradient)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "white",
							fontWeight: 700,
							fontSize: 13,
							letterSpacing: -0.5,
						}}
					>
						u
					</div>
				</button>

				<Divider vertical />

				<ThemeToggle />

				{showCloud && (
					<>
						<CopilotToggle />
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

				{showCloud && wsProvider && (
					<>
						<Divider vertical />
						<StatusBar wsProvider={wsProvider} inline />
						<PresencePill wsProvider={wsProvider} />
					</>
				)}

				{showCloud && boardId && (
					<button
						type="button"
						onClick={() => setShowShare(true)}
						style={{
							padding: "6px 12px",
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							background: "var(--brand-gradient)",
							border: "none",
							color: "white",
							fontSize: 12.5,
							fontWeight: 600,
							borderRadius: 8,
							cursor: "pointer",
							fontFamily: "inherit",
						}}
					>
						<I.share size={12} />
						共有
					</button>
				)}

				<Divider vertical />

				<ZoomControls inline />
				<CommunityLink inline />
			</div>

			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}
