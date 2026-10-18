import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editableTextProps, TEXT_INPUT_EVENT, TEXT_PREVIEW_EVENT } from "./render-props.js";

/** Minimal stand-in for the contentEditable element the handlers read. */
function editor(text: string, scrollHeight = 28) {
	return { innerText: text, scrollHeight } as unknown as HTMLElement;
}

function inputEvent(el: HTMLElement, isComposing: boolean) {
	return { currentTarget: el, nativeEvent: { isComposing } } as never;
}

describe("editableTextProps の IME 中の通知", () => {
	const received: { type: string; detail: unknown }[] = [];
	const record = (e: Event) => received.push({ type: e.type, detail: (e as CustomEvent).detail });

	beforeEach(() => {
		received.length = 0;
		// Node には window が無いので、イベントの送り先だけ用意する。
		(globalThis as { window?: EventTarget }).window = new EventTarget();
		window.addEventListener(TEXT_INPUT_EVENT, record);
		window.addEventListener(TEXT_PREVIEW_EVENT, record);
	});

	afterEach(() => {
		delete (globalThis as { window?: EventTarget }).window;
	});

	it("変換中の入力は確定テキストにせず、未確定を含む内容をプレビューとして通知する", () => {
		const props = editableTextProps("t1", "");
		props.onInput(inputEvent(editor("あいうにほんご", 30), true));
		expect(received).toEqual([
			{ type: TEXT_PREVIEW_EVENT, detail: { id: "t1", text: "あいうにほんご", scrollHeight: 30 } },
		]);
	});

	it("変換の開始時点の内容もプレビューとして通知する", () => {
		const props = editableTextProps("t1", "");
		props.onCompositionStart({ currentTarget: editor("あいう") } as never);
		expect(received.map((r) => r.type)).toEqual([TEXT_PREVIEW_EVENT]);
	});

	it("確定（compositionend）と通常の入力は今までどおりテキスト入力として通知する", () => {
		const props = editableTextProps("t1", "");
		props.onCompositionEnd({ currentTarget: editor("あいう日本語") } as never);
		props.onInput(inputEvent(editor("あいう日本語a"), false));
		expect(received.map((r) => r.type)).toEqual([TEXT_INPUT_EVENT, TEXT_INPUT_EVENT]);
	});
});
