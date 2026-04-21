import type { WsConnectionStatus } from "@edv4h/usketch-sync";
import { useState } from "react";
import { ShareDialog } from "../share-dialog.js";
import { ExportMenu } from "../toolbar/export-menu.js";
import { I, IconBtn } from "../ui/index.js";
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
	connectionStatus?: WsConnectionStatus;
}

/**
 * 画面右上: Presence pill + Share CTA + エクスポート/通知/オーバーフロー。
 * Cloud ボード時のみ Presence pill と Share ボタンが出る。
 */
export function TopRightCluster({ boardId, isCloudBoard, wsProvider, connectionStatus }: Props) {
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
				{isCloudBoard && wsProvider && (
					<PresencePill wsProvider={wsProvider} connectionStatus={connectionStatus} />
				)}
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
				<div
					className="u-surface"
					style={{
						display: "inline-flex",
						padding: 3,
						borderRadius: 10,
						gap: 1,
					}}
				>
					<ExportMenu isCloudBoard={isCloudBoard} boardId={boardId} />
					{isCloudBoard && (
						<>
							<IconBtn icon={I.bell} label="通知" onClick={() => {}} />
							<IconBtn icon={I.more} label="その他" onClick={() => {}} />
						</>
					)}
				</div>
			</div>
			{showShare && boardId && (
				<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} />
			)}
		</>
	);
}
