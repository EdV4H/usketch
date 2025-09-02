import { DotsRenderer } from "./renderers/dots";
import { GridRenderer } from "./renderers/grid";
import { IsometricRenderer } from "./renderers/isometric";
import { LinesRenderer } from "./renderers/lines";
import { NoneRenderer } from "./renderers/none";

/**
 * プリセット背景レンダラーのファクトリー関数
 * 簡単にレンダラーインスタンスを作成するためのヘルパー
 */
export const Backgrounds = {
	/** 白紙背景（何も描画しない） */
	none: () => new NoneRenderer(),

	/** グリッド背景 */
	grid: () => new GridRenderer(),

	/** ドットパターン背景 */
	dots: () => new DotsRenderer(),

	/** ライン背景（横線/縦線） */
	lines: () => new LinesRenderer(),

	/** アイソメトリックグリッド背景 */
	isometric: () => new IsometricRenderer(),
} as const;
