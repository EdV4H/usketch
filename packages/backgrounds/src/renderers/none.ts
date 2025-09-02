import type { Camera } from "@usketch/shared-types";
import type { BackgroundRenderer } from "../types";

/**
 * 白紙背景レンダラー
 * 何も描画しない（透明な背景）
 */
export class NoneRenderer implements BackgroundRenderer<void> {
	render(_container: HTMLElement, _camera: Camera): void {
		// 何も描画しない
	}

	cleanup(container: HTMLElement): void {
		// 念のためスタイルをクリア
		container.style.backgroundColor = "";
		container.style.backgroundImage = "";
		container.style.backgroundSize = "";
		container.style.backgroundPosition = "";
		container.style.backgroundRepeat = "";
	}
}
