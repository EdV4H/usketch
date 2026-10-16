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
/**
 * Editor content while an IME composition is in progress (unconfirmed text
 * included). Lets the shape resize to fit before the text is committed; the
 * text itself is committed by the `TEXT_INPUT_EVENT` on composition end.
 */
export const TEXT_PREVIEW_EVENT = "usketch:text-preview";

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
	const dispatch = (type: string, el: HTMLElement) => {
		window.dispatchEvent(
			new CustomEvent(type, {
				detail: { id, text: el.innerText, scrollHeight: el.scrollHeight },
			}),
		);
	};
	const dispatchInput = (el: HTMLElement) => dispatch(TEXT_INPUT_EVENT, el);
	return {
		contentEditable: "plaintext-only" as const,
		suppressContentEditableWarning: true,
		role: "textbox",
		"aria-multiline": true,
		tabIndex: 0,
		ref: (el: HTMLElement | null) => {
			if (!el) return;
			// Seed the existing text into the contentEditable. React re-runs this
			// callback ref on every commit (the closure identity changes each
			// render), so guard the re-seed by focus: while the user is actively
			// editing this node (`document.activeElement === el`) we must NOT
			// clobber their caret/content. On a fresh edit the node isn't focused
			// yet, so we seed — including when the same DOM node is reused for a
			// later edit session (previously a leaked `data-focused` flag caused
			// the re-opened editor to render empty).
			if (document.activeElement === el) return;
			el.textContent = text;
			requestAnimationFrame(() => focusAtEnd(el));
		},
		onInput: (e: FormEvent<HTMLElement>) => {
			// Mid-composition the DOM already holds the unconfirmed text (input
			// fires after each compositionupdate), so preview it for sizing only.
			if ((e.nativeEvent as InputEvent).isComposing) {
				dispatch(TEXT_PREVIEW_EVENT, e.currentTarget);
				return;
			}
			dispatchInput(e.currentTarget);
		},
		onCompositionStart: (e: ReactCompositionEvent<HTMLElement>) =>
			dispatch(TEXT_PREVIEW_EVENT, e.currentTarget),
		onCompositionEnd: (e: ReactCompositionEvent<HTMLElement>) => dispatchInput(e.currentTarget),
		onKeyDown: (e: ReactKeyboardEvent) => {
			e.stopPropagation();
			if (e.key === "Escape" && !e.nativeEvent.isComposing) {
				window.dispatchEvent(new CustomEvent(TEXT_ESCAPE_EVENT, { detail: { id } }));
			}
		},
		onBlur: (_e: ReactFocusEvent<HTMLElement>) => {
			window.dispatchEvent(new CustomEvent(TEXT_BLUR_EVENT, { detail: { id } }));
		},
		onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
	};
}
