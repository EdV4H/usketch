// ホイッスルの host 向け API。`ctx.services` に載せるので、host (ツールリングや
// 独自 UI) は HUD を経由せず、パッケージ内部を import せずに吹ける。
import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { WhistleController, WhistleFollow } from "./controller.js";
import type { WhistleKind } from "./kinds.js";

export interface WhistleApi {
	/** 吹く。クールダウン中は false。省略時は選択中の種類。 */
	blow(kind?: WhistleKind): boolean;
	getSelectedKind(): WhistleKind;
	/** Shift+W で吹く種類を変える。 */
	setSelectedKind(kind: WhistleKind): void;
	/** 次に吹けるまでの残り時間 (ms)。0 なら吹ける。 */
	getCooldownRemaining(): number;
	/** ついてきての状態 (案内中 / 追従中)。 */
	getFollow(): WhistleFollow | null;
	/** 案内を終える / 追従から外れる。 */
	endFollow(): void;
	/** 状態が変わったら呼ばれる。返り値で購読解除。 */
	subscribe(listener: () => void): () => void;
}

export const whistleService = defineService<WhistleApi>("usketch-plugin-whistle");

export function getWhistleApi(services: ServiceRegistry): WhistleApi | undefined {
	return whistleService.get(services);
}

export function createWhistleApi(
	controller: WhistleController,
	now: () => number = Date.now,
): WhistleApi {
	return {
		blow: (kind) => controller.blow(kind),
		getSelectedKind: () => controller.state.get().selectedKind,
		setSelectedKind: (kind) => controller.setSelectedKind(kind),
		getCooldownRemaining: () => Math.max(controller.state.get().cooldownUntil - now(), 0),
		getFollow: () => controller.state.get().follow,
		endFollow: () => controller.endFollow(),
		subscribe: (listener) => controller.state.subscribe(listener),
	};
}
