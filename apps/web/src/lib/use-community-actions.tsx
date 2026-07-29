import type { AppInstance } from "@edv4h/usketch-core";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { I } from "../components/ui/index.js";
import { setTheme } from "./theme.js";

/**
 * コミュニティページ横断の操作（編集 / テーマ / 遷移 / サイドパネル開閉）を
 * 共有の {@link AppInstance.actions} レジストリに登録する。DebugHUD の Controls
 * ドックがこれを単一ソースとして表示し、ヘッダーの独自ボタン群を置き換える。
 * `authed` が false のときはサイドパネル開閉（コンテンツ系プラグイン未ロード）を出さない。
 * メインアプリの {@link useAppActions} に相当。
 */
export function useCommunityActions(app: AppInstance | null, authed: boolean): void {
	const navigate = useNavigate();

	useEffect(() => {
		if (!app) return;
		const offs: Array<() => void> = [];
		const reg = (a: Parameters<AppInstance["actions"]["register"]>[0]) => {
			offs.push(app.actions.register(a));
		};

		reg({
			id: "edit:undo",
			group: "アクション",
			label: "元に戻す",
			icon: () => <I.undo size={14} />,
			run: () => app.commands.undo(),
		});
		reg({
			id: "edit:redo",
			group: "アクション",
			label: "やり直す",
			icon: () => <I.redo size={14} />,
			run: () => app.commands.redo(),
		});

		reg({
			id: "theme:light",
			group: "テーマ",
			label: "テーマ切替: ライト",
			icon: () => <I.sun size={14} />,
			run: () => setTheme("light"),
		});
		reg({
			id: "theme:dark",
			group: "テーマ",
			label: "テーマ切替: ダーク",
			icon: () => <I.moon size={14} />,
			run: () => setTheme("dark"),
		});
		reg({
			id: "theme:system",
			group: "テーマ",
			label: "テーマ切替: システム",
			icon: () => <I.monitor size={14} />,
			run: () => setTheme("system"),
		});

		reg({
			id: "nav:community",
			group: "移動",
			label: "ワールドマップ",
			icon: () => <I.map size={14} />,
			run: () => navigate("/community"),
		});

		if (authed) {
			reg({
				id: "panel:board-info",
				group: "パネル",
				label: "ボード情報",
				icon: () => <I.folder size={14} />,
				run: () => app.events.emit("side-panel:toggle", { tabId: "board-info" }),
			});
			reg({
				id: "panel:comments",
				group: "パネル",
				label: "コメント",
				icon: () => <I.comment size={14} />,
				run: () => app.events.emit("side-panel:toggle", { tabId: "comments" }),
			});
			reg({
				id: "panel:community-chat",
				group: "パネル",
				label: "チャット",
				icon: () => <I.chat size={14} />,
				run: () => app.events.emit("side-panel:toggle", { tabId: "community-chat" }),
			});
		}

		return () => {
			for (const off of offs) off();
		};
	}, [app, navigate, authed]);
}
