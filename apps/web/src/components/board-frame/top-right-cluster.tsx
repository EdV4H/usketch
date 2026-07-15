import { useState } from "react";
import { ShareDialog } from "../share-dialog.js";
import { I } from "../ui/index.js";
import { PresencePill } from "./presence-pill.js";

type WsProvider = {
	awareness: {
		getStates: () => Map<number, Record<string, unknown>>;
		doc: { clientID: number };
	};
};

interface Props {
	boardId?: string;
	isCloudBoard: boolean;
	wsProvider?: WsProvider | null;
}

/**
 * 画面右上: Presence pill + Share CTA（いずれも Cloud ボード時のみ）。
 * エクスポートは Control HUD の "Export" Action に一本化。通知/その他の
 * 未実装ボタンは撤去した。
 */
export function TopRightCluster({ boardId, isCloudBoard, wsProvider }: Props) {
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
				{isCloudBoard && wsProvider && <PresencePill wsProvider={wsProvider} />}
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
			</div>
			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}
