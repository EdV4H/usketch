const DEV_USER_KEY = "usketch-dev-user";

export interface DevUser {
	id: string;
	name: string;
}

export function devLogin(id: string, name: string): void {
	localStorage.setItem(DEV_USER_KEY, JSON.stringify({ id, name }));
}

export function devLogout(): void {
	localStorage.removeItem(DEV_USER_KEY);
}

export function getDevUser(): DevUser | null {
	const raw = localStorage.getItem(DEV_USER_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed.id === "string" && typeof parsed.name === "string") {
			return parsed as DevUser;
		}
	} catch {}
	return null;
}

export function isDevMode(): boolean {
	return import.meta.env.DEV;
}
