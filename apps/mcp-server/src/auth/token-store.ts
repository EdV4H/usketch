import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredToken {
	token: string;
	expiresAt: string; // ISO 8601
}

interface TokenFile {
	[serverUrl: string]: StoredToken;
}

const CONFIG_DIR = join(homedir(), ".config", "usketch");
const TOKEN_FILE = join(CONFIG_DIR, "tokens.json");

function ensureDir(): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

function readTokenFile(): TokenFile {
	try {
		const raw = readFileSync(TOKEN_FILE, "utf-8");
		return JSON.parse(raw) as TokenFile;
	} catch {
		return {};
	}
}

function writeTokenFile(data: TokenFile): void {
	ensureDir();
	writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function loadToken(serverUrl: string): StoredToken | null {
	const data = readTokenFile();
	const entry = data[serverUrl];
	if (!entry) return null;

	// Check expiry (with 1 hour buffer)
	const expiresAt = new Date(entry.expiresAt).getTime();
	const now = Date.now();
	const oneHour = 60 * 60 * 1000;
	if (expiresAt - oneHour < now) {
		return null; // Expired or about to expire
	}

	return entry;
}

export function saveToken(serverUrl: string, token: string, expiresInSeconds: number): void {
	const data = readTokenFile();
	data[serverUrl] = {
		token,
		expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
	};
	writeTokenFile(data);
}

export function clearToken(serverUrl: string): void {
	const data = readTokenFile();
	delete data[serverUrl];
	writeTokenFile(data);
}
