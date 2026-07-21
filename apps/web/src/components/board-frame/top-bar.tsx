import { useState } from "react";
import { useNavigate } from "react-router";
import { ShareDialog } from "../share-dialog.js";
import { Divider, I, IconBtn, ThemeToggle } from "../ui/index.js";
import { CommunityLink } from "./community-link.js";

interface Props {
	boardId?: string;
	isCloudBoard: boolean;
	/** プレゼン編集モード中は Cloud 限定の操作群を隠す。 */
	compact?: boolean;
}

/**
 * 画面中央上部に固定された単一のコントロールバー。
 *
 * ロゴ / テーマ / プレゼン / 共有 / コミュニティ の最小構成。shape/tool 系の操作、
 * プレゼンス状態・Follow・オンラインメンバー表示・Copilot・ズーム、および
 * アクション検索は Control HUD (`` ` `` で開く) に一本化済み。
 */
export function TopBar({ boardId, isCloudBoard, compact }: Props) {
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

				{showCloud && boardId && (
					<IconBtn
						icon={I.present}
						label="プレゼンテーション"
						onClick={() => navigate(`/boards/${boardId}?present=1`)}
					/>
				)}

				{showCloud && boardId && (
					<IconBtn icon={I.share} label="共有" onClick={() => setShowShare(true)} />
				)}

				<Divider vertical />

				<CommunityLink />
			</div>

			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}
