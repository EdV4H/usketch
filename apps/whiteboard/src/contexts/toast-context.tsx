import type React from "react";
import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
	id: string;
	message: string;
	type?: "success" | "error" | "info";
}

interface ToastContextType {
	toasts: Toast[];
	showToast: (message: string, type?: "success" | "error" | "info") => void;
	removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const showToast = useCallback((message: string, type?: "success" | "error" | "info") => {
		// Use crypto.randomUUID() with fallback for compatibility
		const id =
			typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
		const newToast: Toast = type ? { id, message, type } : { id, message };

		setToasts((prev) => [...prev, newToast]);

		// Auto-remove after 3 seconds
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3000);
	}, []);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
	}, []);

	return (
		<ToastContext.Provider value={{ toasts, showToast, removeToast }}>
			{children}
		</ToastContext.Provider>
	);
};

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
};
