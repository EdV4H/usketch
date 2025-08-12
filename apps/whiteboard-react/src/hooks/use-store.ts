import { whiteboardStore } from "@usketch/store";
import { useStore as useZustandStore } from "zustand";

// Type-safe hook for using the whiteboard store
export function useStore<T>(selector: (state: any) => T): T {
	return useZustandStore(whiteboardStore, selector);
}
