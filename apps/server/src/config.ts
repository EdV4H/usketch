/** 本番環境で許可するオリジン */
const PRODUCTION_ORIGINS = ["https://usketch-web.pages.dev"];

/** 開発環境で追加で許可するオリジン */
const DEV_ORIGINS = ["http://localhost:4578", "http://localhost:5173", "http://localhost:4173"];

/**
 * 環境に応じた許可オリジンを返す。
 * 本番環境（ENVIRONMENT=production）では localhost を除外する。
 */
export function getAllowedOrigins(env?: { ENVIRONMENT?: string; DEV_MODE?: string }): string[] {
	if (env?.ENVIRONMENT === "production" && env?.DEV_MODE !== "true") {
		return PRODUCTION_ORIGINS;
	}
	return [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];
}

/** 後方互換: 静的エクスポート（全オリジン含む） */
export const ALLOWED_ORIGINS = [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];
