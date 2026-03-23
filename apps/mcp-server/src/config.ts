/**
 * MCP サーバー設定
 * 環境変数から接続情報を読み取る
 */
export interface McpConfig {
	/** uSketch サーバーURL (例: http://localhost:8787) */
	serverUrl: string;
	/** WebSocket URL (serverUrl から自動導出) */
	wsUrl: string;
	/** 開発モード (認証スキップ) */
	devMode: boolean;
	/** 開発モード用ユーザーID */
	devUserId: string;
	/** 本番用APIトークン (Better Authセッショントークン) */
	apiToken: string | undefined;
}

export function loadConfig(): McpConfig {
	const serverUrl = (process.env.USKETCH_SERVER_URL ?? "http://localhost:8787").replace(/\/$/, "");
	const devMode = process.env.USKETCH_DEV_MODE === "true";
	const devUserId = process.env.USKETCH_DEV_USER_ID ?? "dev-user-1";
	const apiToken = process.env.USKETCH_API_TOKEN;

	// HTTP → WS URL 変換
	const wsUrl = serverUrl.replace(/^http/, "ws");

	return { serverUrl, wsUrl, devMode, devUserId, apiToken };
}
