import type { Camera } from "@usketch/shared-types";

/**
 * 背景レンダラーのインターフェース
 * @template TConfig - レンダラー固有の設定型
 */
export interface BackgroundRenderer<TConfig = unknown> {
	/**
	 * 背景をレンダリング
	 * @param container - 背景を描画するHTMLElement
	 * @param camera - 現在のカメラ状態（ズーム、位置）
	 * @param config - レンダラー固有の設定
	 */
	render(container: HTMLElement, camera: Camera, config?: TConfig): void;

	/**
	 * リソースのクリーンアップ
	 * @param container - クリーンアップ対象のHTMLElement
	 */
	cleanup?(container: HTMLElement): void;
}

/**
 * 背景オプション
 * @template TConfig - レンダラー固有の設定型
 */
export interface BackgroundOptions<TConfig = unknown> {
	/** 使用するレンダラー */
	renderer: BackgroundRenderer<TConfig>;
	/** レンダラー固有の設定 */
	config?: TConfig;
}

// プリセットレンダラーの設定型

/** グリッドレンダラーの設定 */
export interface GridConfig {
	/** グリッドサイズ（デフォルト: 20px） */
	size?: number;
	/** 線の色（デフォルト: #e0e0e0） */
	color?: string;
	/** 線の太さ（デフォルト: 1px） */
	thickness?: number;
}

/** ドットレンダラーの設定 */
export interface DotsConfig {
	/** ドット間隔（デフォルト: 20px） */
	spacing?: number;
	/** ドットサイズ（デフォルト: 2px） */
	size?: number;
	/** ドットの色（デフォルト: #d0d0d0） */
	color?: string;
}

/** ラインレンダラーの設定 */
export interface LinesConfig {
	/** 線の方向 */
	direction?: "horizontal" | "vertical" | "both";
	/** 線の間隔（デフォルト: 25px） */
	spacing?: number;
	/** 線の色（デフォルト: #e0e0e0） */
	color?: string;
	/** 線の太さ（デフォルト: 1px） */
	thickness?: number;
}

/** アイソメトリックレンダラーの設定 */
export interface IsometricConfig {
	/** グリッドサイズ（デフォルト: 30px） */
	size?: number;
	/** 線の色（デフォルト: #e0e0e0） */
	color?: string;
}
