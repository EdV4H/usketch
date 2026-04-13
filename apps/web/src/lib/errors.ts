/** Extract a human-readable error message from an unknown catch value. */
export function getErrorMessage(e: unknown, fallback: string): string {
	return e instanceof Error ? e.message : fallback;
}
