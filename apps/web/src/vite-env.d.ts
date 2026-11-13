/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** "true" でローカルボードのマルチページ移行を行う（クラウドボードはサーバーの PAGES_MIGRATION）。 */
	readonly VITE_PAGES_MIGRATION?: string;
}
