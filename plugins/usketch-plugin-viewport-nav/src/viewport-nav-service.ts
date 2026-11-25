// viewport-nav のホスト向け API。ホストが自前の設定画面から感度を読み書きするときに使う
// （HUD を使わない場合も同じ操作ができる）。docs/plugin-system-design.md の慣習に従い
// `ctx.services` に provide する。
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { ViewportNavSettings, ViewportNavSettingsPatch } from "./viewport-nav-settings.js";
import type { WheelDevice } from "./wheel-device.js";

export interface ViewportNavApi {
	/** いま使われている設定（ホストの options と利用者の上書きを合わせ、クランプ済み）。 */
	getSettings(): ViewportNavSettings;
	/** 利用者の上書きを変える（指定した項目だけ）。storage に保存される。 */
	setSettings(patch: ViewportNavSettingsPatch): void;
	/** 利用者の上書きを全部消して、ホストの options どおりに戻す。 */
	resetSettings(): void;
	/** 直近のホイール操作をどのデバイスと判定したか（まだ操作が無ければ `null`）。 */
	getLastDevice(): WheelDevice | null;
	/** 設定や判定デバイスが変わったら呼ばれる。返り値で解除。 */
	subscribe(listener: () => void): () => void;
}

/** viewport-nav の API のサービスハンドル。 */
export const viewportNavService = defineService<ViewportNavApi>("usketch-plugin-viewport-nav");

/** ホスト向けアクセサ: `getViewportNavApi(app.services)?.setSettings({ mouse: { pan: 2 } })`。 */
export function getViewportNavApi(services: ServiceRegistry): ViewportNavApi | undefined {
	return viewportNavService.get(services);
}
