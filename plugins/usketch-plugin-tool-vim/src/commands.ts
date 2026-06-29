import type { VimConfig } from "./config/schema.js";
import type { VimDeps } from "./machine/types.js";
import { screenCenterWorld } from "./viewport-utils.js";

export interface ExCommandResult {
	/** ステータスラインに出すメッセージ。 */
	message: string;
	/** Vim を抜ける（normal へ戻さずツール切替が走る）場合 true。 */
	exited?: boolean;
	/** `:help` 全画面ヘルプの表示をトグルする場合 true。 */
	toggleHelp?: boolean;
	/** カーソルを画面中央へ移動する場合 true（cursor は machine context にあるため flag で返す）。 */
	cursorCenter?: boolean;
}

/**
 * ex コマンド（先頭 `:` を除いた文字列）を実行する。副作用は `deps`/`events` 経由。
 * デモ/他プラグインは `vim:command` 系イベントを購読して bg 切替や export を実装できる。
 */
export function runExCommand(line: string, deps: VimDeps, config: VimConfig): ExCommandResult {
	const trimmed = line.trim();
	if (trimmed === "") return { message: "" };
	const [cmd, ...args] = trimmed.split(/\s+/);
	const arg = args.join(" ");

	switch (cmd) {
		case "q":
		case "quit":
			deps.store.setActiveToolId(config.exitToolId);
			return { message: "", exited: true };

		case "w":
		case "write":
			return { message: "auto-synced (no-op)" };

		case "wq":
			deps.store.setActiveToolId(config.exitToolId);
			return { message: "", exited: true };

		case "tool":
			if (!arg) return { message: "E: :tool <id>" };
			deps.store.setActiveToolId(arg);
			return { message: `tool → ${arg}`, exited: arg !== "vim" };

		case "zoom": {
			const z = Number(arg);
			if (!Number.isFinite(z) || z <= 0) return { message: "E: :zoom <number>" };
			deps.store.zoomTo(z, screenCenterWorld(deps.store));
			return { message: `zoom ${z}` };
		}

		case "set": {
			// 例: :set bg=dots / :set bg=grid / :set bg=none
			const m = /^bg=(dots|grid|none)$/.exec(arg);
			if (m) {
				deps.events.emit("vim:set-background", { value: m[1] });
				return { message: `bg=${m[1]}` };
			}
			return { message: `E: unknown option ${arg}` };
		}

		case "export": {
			const fmt = (arg || "png").toLowerCase();
			deps.events.emit("vim:export", { format: fmt });
			return { message: `export ${fmt}` };
		}

		case "help":
		case "h":
			return { message: "", toggleHelp: true };

		case "center":
			return { message: "", cursorCenter: true };

		default:
			return { message: `E: not a command: ${cmd}` };
	}
}
