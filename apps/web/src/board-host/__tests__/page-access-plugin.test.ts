import { describe, expect, it } from "vitest";
import { describeAccessError, visibilityLabel } from "../page-access-plugin.js";

describe("page access panel", () => {
	it("公開ボードの公開ページは、ログインしていない人も見られると書く", () => {
		expect(visibilityLabel("public", true)).toBe("誰でも（ログインしていない人も）");
		expect(visibilityLabel("public", false)).toBe("ボードを見られる人全員");
		expect(visibilityLabel("private", true)).toBe("作った人と招いた人だけ");
	});

	it("API のエラーを言葉にする", () => {
		expect(describeAccessError(new Error("API error: 404 Not Found"), "invite")).toBe(
			"そのメールアドレスの人が見つかりません",
		);
		expect(describeAccessError(new Error("API error: 403 Forbidden"), "set")).toBe(
			"このページの公開範囲を変える権限がありません",
		);
		expect(describeAccessError(new Error("network"), "remove")).toBe("外せませんでした");
	});
});
