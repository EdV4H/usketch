import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { SidebarPanel } from "../components/right-sidebar/types";
import { SidebarPanelRegistry } from "./panel-registry";

/**
 * Sidebar Context Value
 *
 * Provides access to the sidebar state and registry through React Context.
 */
interface SidebarContextValue {
	/**
	 * Panel registry instance
	 */
	registry: SidebarPanelRegistry;

	/**
	 * Currently active tab ID
	 */
	activeTab: string | null;

	/**
	 * Set the active tab
	 */
	setActiveTab: (tabId: string) => void;

	/**
	 * Whether the sidebar is currently open
	 */
	isOpen: boolean;

	/**
	 * Toggle the sidebar open/closed
	 */
	toggleSidebar: () => void;

	/**
	 * Set the sidebar open/closed state
	 */
	setSidebarOpen: (open: boolean) => void;

	/**
	 * List of currently registered panels (reactive)
	 */
	panels: SidebarPanel[];
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Sidebar Provider Props
 */
interface SidebarProviderProps {
	children: ReactNode;

	/**
	 * Default active tab ID
	 * @default First panel's ID
	 */
	defaultActiveTab?: string;

	/**
	 * Default sidebar open state
	 * @default true
	 */
	defaultOpen?: boolean;

	/**
	 * Custom registry instance (for testing)
	 */
	registry?: SidebarPanelRegistry;
}

/**
 * Sidebar Provider
 *
 * Provides sidebar state and registry to all child components.
 * Must be placed at the root of the application or above any components
 * that need access to the sidebar.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <SidebarProvider defaultActiveTab="properties" defaultOpen={true}>
 *       <YourApp />
 *     </SidebarProvider>
 *   );
 * }
 * ```
 */
export function SidebarProvider({
	children,
	defaultActiveTab,
	defaultOpen = true,
	registry: customRegistry,
}: SidebarProviderProps) {
	// Create or use custom registry
	const registry = useMemo(() => customRegistry || new SidebarPanelRegistry(), [customRegistry]);

	// Track registered panels (reactive)
	const [panels, setPanels] = useState<SidebarPanel[]>([]);

	// Sidebar state
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [activeTab, setActiveTab] = useState<string | null>(defaultActiveTab ?? null);

	// Subscribe to registry changes and initialize panels
	useEffect(() => {
		// Initial panel load
		const initialPanels = registry.getAll();
		setPanels(initialPanels);

		// Set initial active tab if not already set and panels exist
		if (!activeTab && initialPanels.length > 0) {
			setActiveTab(initialPanels[0]?.id ?? null);
		}

		// Subscribe to future changes
		const unsubscribe = registry.subscribe(() => {
			const updatedPanels = registry.getAll();
			setPanels(updatedPanels);

			// If active tab is no longer available, switch to first panel
			if (activeTab && !updatedPanels.some((p) => p.id === activeTab)) {
				setActiveTab(updatedPanels.length > 0 ? (updatedPanels[0]?.id ?? null) : null);
			}
		});

		return unsubscribe;
	}, [registry, activeTab]);

	const toggleSidebar = () => {
		setIsOpen((prev) => !prev);
	};

	const contextValue = useMemo<SidebarContextValue>(
		() => ({
			registry,
			activeTab,
			setActiveTab,
			isOpen,
			toggleSidebar,
			setSidebarOpen: setIsOpen,
			panels,
		}),
		[registry, activeTab, isOpen, panels],
	);

	return <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>;
}

/**
 * useSidebar Hook
 *
 * Access the sidebar state and registry from any component.
 * Must be used within a SidebarProvider.
 *
 * @throws Error if used outside of SidebarProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeTab, setActiveTab, isOpen, toggleSidebar } = useSidebar();
 *
 *   return (
 *     <button onClick={toggleSidebar}>
 *       {isOpen ? 'Close' : 'Open'} Sidebar
 *     </button>
 *   );
 * }
 * ```
 */
export function useSidebar(): SidebarContextValue {
	const context = useContext(SidebarContext);

	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}

	return context;
}

/**
 * useRegisterPanel Hook
 *
 * Register a panel when a component mounts and automatically unregister
 * when it unmounts. Useful for dynamically loaded panels.
 *
 * @param panel - The panel to register, or null to skip registration
 *
 * @example
 * ```tsx
 * function MyPanelContainer() {
 *   useRegisterPanel({
 *     id: 'my-panel',
 *     label: 'My Panel',
 *     content: <MyPanelContent />,
 *   });
 *
 *   return null; // Panel content is rendered by RightSidebar
 * }
 * ```
 */
export function useRegisterPanel(panel: SidebarPanel | null): void {
	const { registry } = useSidebar();

	useEffect(() => {
		if (panel) {
			registry.register(panel);

			return () => {
				registry.unregister(panel.id);
			};
		}
		// Empty return for when panel is null
		return undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [panel?.id, registry]);
}
