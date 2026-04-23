const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function href(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	if (path.startsWith("#")) return path;
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return `${base}${normalized}`;
}
