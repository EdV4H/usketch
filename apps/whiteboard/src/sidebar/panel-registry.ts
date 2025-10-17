import type { SidebarPanel, SidebarRegistryListener } from "../components/right-sidebar/types";

/**
 * Sidebar Panel Registry
 *
 * Manages the registration and lifecycle of sidebar panels.
 * Provides an observable pattern for components to react to panel changes.
 *
 * Features:
 * - Dynamic panel registration/unregistration
 * - Event-driven updates (observer pattern)
 * - Support for multiple registrations
 * - Automatic deduplication by panel ID
 *
 * @example
 * ```tsx
 * const registry = new SidebarPanelRegistry();
 *
 * // Register a panel
 * registry.register({
 *   id: 'properties',
 *   label: 'プロパティ',
 *   content: <PropertyPanelContent />,
 * });
 *
 * // Listen to changes
 * const unsubscribe = registry.subscribe(() => {
 *   console.log('Panels changed:', registry.getAll());
 * });
 *
 * // Cleanup
 * registry.unregister('properties');
 * unsubscribe();
 * ```
 */
export class SidebarPanelRegistry {
	private panels = new Map<string, SidebarPanel>();
	private listeners: Set<SidebarRegistryListener> = new Set();

	/**
	 * Register a new panel
	 *
	 * If a panel with the same ID already exists, it will be replaced.
	 * All subscribed listeners will be notified of the change.
	 *
	 * @param panel - The panel to register
	 */
	register(panel: SidebarPanel): void {
		const existing = this.panels.get(panel.id);

		// Only notify if panel is new or content has changed
		const hasChanged = !existing || existing.content !== panel.content;

		this.panels.set(panel.id, panel);

		if (hasChanged) {
			this.notifyListeners();
		}
	}

	/**
	 * Register multiple panels at once
	 *
	 * Efficient way to register multiple panels with a single notification.
	 *
	 * @param panels - Array of panels to register
	 */
	registerMultiple(panels: SidebarPanel[]): void {
		for (const panel of panels) {
			this.panels.set(panel.id, panel);
		}
		this.notifyListeners();
	}

	/**
	 * Unregister a panel by ID
	 *
	 * Removes the panel from the registry and notifies listeners.
	 * If the panel doesn't exist, this is a no-op.
	 *
	 * @param panelId - The ID of the panel to unregister
	 */
	unregister(panelId: string): void {
		if (this.panels.delete(panelId)) {
			this.notifyListeners();
		}
	}

	/**
	 * Get a specific panel by ID
	 *
	 * @param panelId - The ID of the panel to retrieve
	 * @returns The panel if found, undefined otherwise
	 */
	get(panelId: string): SidebarPanel | undefined {
		return this.panels.get(panelId);
	}

	/**
	 * Check if a panel is registered
	 *
	 * @param panelId - The ID of the panel to check
	 * @returns true if the panel exists, false otherwise
	 */
	has(panelId: string): boolean {
		return this.panels.has(panelId);
	}

	/**
	 * Get all registered panels
	 *
	 * Returns panels filtered by visibility and sorted by order.
	 * Development-only panels are filtered out in production.
	 *
	 * @returns Array of visible panels, sorted by order
	 */
	getAll(): SidebarPanel[] {
		const isDevelopment = import.meta.env.DEV;

		return Array.from(this.panels.values())
			.filter((panel) => {
				// Filter out dev-only panels in production
				if (panel.devOnly && !isDevelopment) {
					return false;
				}

				// Filter by visibility
				if (panel.visible === false) {
					return false;
				}

				if (typeof panel.visible === "function") {
					return panel.visible();
				}

				return true;
			})
			.sort((a, b) => {
				const orderA = a.order ?? 0;
				const orderB = b.order ?? 0;
				return orderA - orderB;
			});
	}

	/**
	 * Get the count of registered panels (including hidden ones)
	 *
	 * @returns The total number of registered panels
	 */
	count(): number {
		return this.panels.size;
	}

	/**
	 * Clear all registered panels
	 *
	 * Removes all panels and notifies listeners.
	 */
	clear(): void {
		if (this.panels.size > 0) {
			this.panels.clear();
			this.notifyListeners();
		}
	}

	/**
	 * Subscribe to panel changes
	 *
	 * The listener will be called whenever panels are registered,
	 * unregistered, or cleared.
	 *
	 * @param listener - Callback function to be called on changes
	 * @returns Unsubscribe function to remove the listener
	 */
	subscribe(listener: SidebarRegistryListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Notify all subscribed listeners of a change
	 *
	 * @private
	 */
	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}
