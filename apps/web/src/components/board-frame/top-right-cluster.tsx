import { useState } from "react";
import { ShareDialog } from "../share-dialog.js";
import { ExportMenu } from "../toolbar/export-menu.js";
import { I } from "../ui/index.js";

interface Props {
	boardId?: string;
	isCloudBoard: boolean;
}

/** 画面右上: Share CTA + エクスポート。Cloud ボード時のみ Share ボタンが出る。 */
export function TopRightCluster({ boardId, isCloudBoard }: Props) {
	const [showShare, setShowShare] = useState(false);

	return (
		<>
			<div
				style={{
					position: "fixed",
					top: 12,
					right: 12,
					display: "flex",
					gap: 8,
					zIndex: 30,
					alignItems: "center",
				}}
			>
				{isCloudBoard && boardId && (
					<button
						type="button"
						onClick={() => setShowShare(true)}
						style={{
							padding: "7px 14px",
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							background: "var(--brand-gradient)",
							border: "none",
							color: "white",
							fontSize: 12.5,
							fontWeight: 600,
							borderRadius: 10,
							cursor: "pointer",
							boxShadow: "0 4px 14px rgba(139, 92, 246, 0.25)",
							fontFamily: "inherit",
						}}
					>
						<I.share size={12} />
						共有
					</button>
				)}
				<ExportMenu isCloudBoard={isCloudBoard} boardId={boardId} />
			</div>
			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}
