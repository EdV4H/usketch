/**
 * Accessibility-related utilities
 */

/**
 * Screen reader announcements
 */
export class ScreenReaderAnnouncer {
	private liveRegion: HTMLElement | null = null;

	constructor() {
		this.createLiveRegion();
	}

	private createLiveRegion(): void {
		if (typeof document === "undefined") return;

		this.liveRegion = document.createElement("div");
		this.liveRegion.setAttribute("role", "status");
		this.liveRegion.setAttribute("aria-live", "polite");
		this.liveRegion.setAttribute("aria-atomic", "true");
		this.liveRegion.style.cssText = `
			position: absolute;
			left: -10000px;
			width: 1px;
			height: 1px;
			overflow: hidden;
		`;
		document.body.appendChild(this.liveRegion);
	}

	announce(message: string, priority: "polite" | "assertive" = "polite"): void {
		if (!this.liveRegion) return;

		this.liveRegion.setAttribute("aria-live", priority);
		this.liveRegion.textContent = message;

		// Clear the message to enable the next announcement
		setTimeout(() => {
			if (this.liveRegion) {
				this.liveRegion.textContent = "";
			}
		}, 1000);
	}

	destroy(): void {
		if (this.liveRegion?.parentNode) {
			this.liveRegion.parentNode.removeChild(this.liveRegion);
		}
		this.liveRegion = null;
	}
}

/**
 * Keyboard navigation helper
 */
export class KeyboardNavigationHelper {
	private focusTrap: HTMLElement | null = null;
	private previousFocus: HTMLElement | null = null;

	/**
	 * Set up focus trap
	 */
	trapFocus(container: HTMLElement): void {
		this.focusTrap = container;
		this.previousFocus = document.activeElement as HTMLElement;

		// Get focusable elements
		const focusableElements = this.getFocusableElements(container);
		if (focusableElements.length === 0) return;

		// Focus first element
		if (focusableElements[0]) {
			focusableElements[0].focus();
		}

		// Handle tab key
		container.addEventListener("keydown", this.handleTrapKeydown);
	}

	/**
	 * Release focus trap
	 */
	releaseFocus(): void {
		if (this.focusTrap) {
			this.focusTrap.removeEventListener("keydown", this.handleTrapKeydown);
			this.focusTrap = null;
		}

		if (this.previousFocus) {
			this.previousFocus.focus();
			this.previousFocus = null;
		}
	}

	private handleTrapKeydown = (event: KeyboardEvent): void => {
		if (event.key !== "Tab" || !this.focusTrap) return;

		const focusableElements = this.getFocusableElements(this.focusTrap);
		if (focusableElements.length === 0) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (event.shiftKey) {
			// Shift + Tab
			if (document.activeElement === firstElement && lastElement) {
				event.preventDefault();
				lastElement.focus();
			}
		} else {
			// Tab
			if (document.activeElement === lastElement && firstElement) {
				event.preventDefault();
				firstElement.focus();
			}
		}
	};

	/**
	 * Get focusable elements
	 */
	private getFocusableElements(container: HTMLElement): HTMLElement[] {
		const selector = `
			a[href]:not([disabled]),
			button:not([disabled]),
			textarea:not([disabled]),
			input:not([disabled]):not([type="hidden"]),
			select:not([disabled]),
			[tabindex]:not([tabindex="-1"])
		`;

		return Array.from(container.querySelectorAll<HTMLElement>(selector));
	}
}

/**
 * Generate keyboard shortcut labels
 */
export function formatShortcutLabel(keys: string[]): string {
	const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

	return keys
		.map((key) => {
			// Convert platform-specific modifier keys to appropriate symbols
			switch (key.toLowerCase()) {
				case "mod":
					return isMac ? "⌘" : "Ctrl";
				case "alt":
					return isMac ? "⌥" : "Alt";
				case "shift":
					return isMac ? "⇧" : "Shift";
				case "enter":
					return "↵";
				case "escape":
					return "Esc";
				case "arrowup":
					return "↑";
				case "arrowdown":
					return "↓";
				case "arrowleft":
					return "←";
				case "arrowright":
					return "→";
				case "space":
					return "Space";
				case "backspace":
					return "⌫";
				case "delete":
					return "Del";
				case "tab":
					return "⇥";
				default:
					return key.toUpperCase();
			}
		})
		.join(isMac ? " " : "+");
}

/**
 * ARIA attribute update helper
 */
export function updateAriaAttributes(
	element: HTMLElement,
	attributes: Record<string, string | boolean | number>,
): void {
	Object.entries(attributes).forEach(([key, value]) => {
		if (key.startsWith("aria-")) {
			element.setAttribute(key, String(value));
		}
	});
}

/**
 * Detect whether the user is using keyboard only
 */
export class KeyboardOnlyUserDetector {
	private isKeyboardUser = false;
	private listeners: Set<(isKeyboardUser: boolean) => void> = new Set();

	constructor() {
		if (typeof window === "undefined") return;

		// Clear keyboard user flag on mouse click
		window.addEventListener("mousedown", () => {
			this.setKeyboardUser(false);
		});

		// Set keyboard user flag on Tab key
		window.addEventListener("keydown", (event) => {
			if (event.key === "Tab") {
				this.setKeyboardUser(true);
			}
		});
	}

	private setKeyboardUser(value: boolean): void {
		if (this.isKeyboardUser !== value) {
			this.isKeyboardUser = value;
			this.listeners.forEach((listener) => {
				listener(value);
			});
		}
	}

	onKeyboardUserChange(listener: (isKeyboardUser: boolean) => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getIsKeyboardUser(): boolean {
		return this.isKeyboardUser;
	}
}
