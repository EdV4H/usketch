import type { BoardStore, ToolRegistry } from "@edv4h/usketch-shared";
import type { KeymapInternal, KeymapOwner } from "./keymap.js";

/** Keymap binding id for a tool's {@link ToolDefinition.shortcut}. */
export const toolBindingId = (owner: KeymapOwner, toolId: string): string =>
	`${owner.pluginId ?? "app"}:tool:${toolId}`;

/**
 * A {@link ToolRegistry} view that also registers each tool's `shortcut` as a
 * `"press"` binding in the keymap (activating the tool), so tool keys take part in
 * overlap detection and rebinding like any other shortcut. Re-registering a tool
 * replaces its binding.
 */
export function createToolShortcutBridge(
	tools: ToolRegistry,
	keymap: KeymapInternal,
	store: BoardStore,
	owner: KeymapOwner,
	/** Tool id → unregister of its binding, shared by every view of one app. */
	bindings: Map<string, () => void>,
): ToolRegistry {
	return {
		register(id, definition) {
			tools.register(id, definition);
			bindings.get(id)?.();
			bindings.delete(id);
			if (!definition.shortcut) return;
			bindings.set(
				id,
				keymap.registerFor(owner, {
					id: toolBindingId(owner, id),
					keys: [definition.shortcut],
					kind: "press",
					label: definition.label ?? id,
					category: "tool",
					onPress: () => store.setActiveToolId(id),
				}),
			);
		},
		get: tools.get,
		getAll: tools.getAll,
		getOrdered: tools.getOrdered,
	};
}
