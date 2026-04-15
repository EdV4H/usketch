import { clearToken, loadToken, saveToken } from "./token-store.js";

interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	verification_uri_complete: string;
	expires_in: number;
	interval: number;
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

interface ErrorResponse {
	error: string;
	error_description: string;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Authenticate via Device Authorization Grant (RFC 8628).
 * Opens a browser for the user to approve, then polls for the token.
 */
async function performDeviceAuth(serverUrl: string): Promise<{ token: string; expiresIn: number }> {
	// Step 1: Request device code
	const codeRes = await fetch(`${serverUrl}/api/auth/device/code`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ client_id: "usketch-mcp-cli" }),
	});

	if (!codeRes.ok) {
		const err = (await codeRes.json().catch(() => null)) as ErrorResponse | null;
		throw new Error(
			`Failed to request device code: ${err?.error_description ?? codeRes.statusText}`,
		);
	}

	const codeData = (await codeRes.json()) as DeviceCodeResponse;

	// Step 2: Display instructions and open browser
	console.error("");
	console.error("=== uSketch CLI Authentication ===");
	console.error(`Open this URL in your browser: ${codeData.verification_uri_complete}`);
	console.error(`Your code: ${codeData.user_code}`);
	console.error("");

	// Dynamic import for ESM-only `open` package
	try {
		const { default: open } = await import("open");
		await open(codeData.verification_uri_complete);
		console.error("Browser opened automatically. Waiting for approval...");
	} catch {
		console.error("Could not open browser automatically. Please open the URL manually.");
	}

	// Step 3: Poll for token
	let interval = codeData.interval * 1000; // Convert to ms
	const deadline = Date.now() + codeData.expires_in * 1000;

	while (Date.now() < deadline) {
		await sleep(interval);

		const tokenRes = await fetch(`${serverUrl}/api/auth/device/token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
				device_code: codeData.device_code,
				client_id: "usketch-mcp-cli",
			}),
		});

		if (tokenRes.ok) {
			const tokenData = (await tokenRes.json()) as TokenResponse;
			console.error("Authentication successful!");
			return { token: tokenData.access_token, expiresIn: tokenData.expires_in };
		}

		const errData = (await tokenRes.json().catch(() => null)) as ErrorResponse | null;
		const errorCode = errData?.error;

		if (errorCode === "authorization_pending") {
			continue;
		}
		if (errorCode === "slow_down") {
			interval += 5000;
			continue;
		}
		if (errorCode === "expired_token") {
			throw new Error("Authentication timed out. Please try again.");
		}
		if (errorCode === "access_denied") {
			throw new Error("Authentication was denied by the user.");
		}

		throw new Error(
			`Unexpected error during authentication: ${errData?.error_description ?? errorCode}`,
		);
	}

	throw new Error("Authentication timed out. Please try again.");
}

/**
 * Validate an existing token by calling the session endpoint.
 */
async function validateToken(serverUrl: string, token: string): Promise<boolean> {
	try {
		const res = await fetch(`${serverUrl}/api/auth/get-session`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		return res.ok;
	} catch {
		return false;
	}
}

/**
 * Get a valid API token for the given server URL.
 * Tries cached token first, falls back to CLI auth flow.
 */
export async function getApiToken(serverUrl: string): Promise<string> {
	// Try cached token
	const cached = loadToken(serverUrl);
	if (cached) {
		const valid = await validateToken(serverUrl, cached.token);
		if (valid) {
			return cached.token;
		}
		console.error("Cached token is invalid. Re-authenticating...");
		clearToken(serverUrl);
	}

	// Run device auth flow
	const { token, expiresIn } = await performDeviceAuth(serverUrl);
	saveToken(serverUrl, token, expiresIn);
	return token;
}
