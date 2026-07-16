import type {
	FormEvent,
	CompositionEvent as ReactCompositionEvent,
	FocusEvent as ReactFocusEvent,
	KeyboardEvent as ReactKeyboardEvent,
	PointerEvent as ReactPointerEvent,
} from "react";

/** Custom event names the controller listens for (shared across text/sticky/geo). */
export const TEXT_INPUT_EVENT = "usketch:text-input";
export const TEXT_BLUR_EVENT = "usketch:text-blur";
export const TEXT_ESCAPE_EVENT = "usketch:text-escape";

function focusAtEnd(el: HTMLElement): void {
	el.focus();
	const sel = window.getSelection();
	if (!sel) return;
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	sel.removeAllRanges();
	sel.addRange(range);
}

/**
 * Props for a `contentEditable` element that drives the shared editable-text
 * controller via `usketch:text-*` window events. Spread onto the editor div
 * (a plain div for HTML shapes, or a div inside `<foreignObject>` for SVG
 * shapes). Handles IME composition, Escape, blur, and one-time focus.
 */
export function editableTextProps(id: string, text: string) {
	const dispatchInput = (el: HTMLElement) => {
		window.dispatchEvent(
			new CustomEvent(TEXT_INPUT_EVENT, {
				detail: { id, text: el.innerText, scrollHeight: el.scrollHeight },
			}),
		);
	};
	return {
		contentEditable: "plaintext-only" as const,
		suppressContentEditableWarning: true,
		role: "textbox",
		"aria-multiline": true,
		tabIndex: 0,
		ref: (el: HTMLElement | null) => {
			if (!el || el.dataset.focused) return;
			el.dataset.focused = "1";
			el.textContent = text;
			requestAnimationFrame(() => focusAtEnd(el));
		},
		onInput: (e: FormEvent<HTMLElement>) => {
			if ((e.nativeEvent as InputEvent).isComposing) return;
			dispatchInput(e.currentTarget);
		},
		onCompositionEnd: (e: ReactCompositionEvent<HTMLElement>) => dispatchInput(e.currentTarget),
		onKeyDown: (e: ReactKeyboardEvent) => {
			e.stopPropagation();
			if (e.key === "Escape" && !e.nativeEvent.isComposing) {
				window.dispatchEvent(new CustomEvent(TEXT_ESCAPE_EVENT, { detail: { id } }));
			}
		},
		onBlur: (e: ReactFocusEvent<HTMLElement>) => {
			delete e.currentTarget.dataset.focused;
			window.dispatchEvent(new CustomEvent(TEXT_BLUR_EVENT, { detail: { id } }));
		},
		onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
	};
}
