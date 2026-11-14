/**
 * Serialize a JSON-compatible value with object keys sorted at every depth, so
 * two values with the same content always produce the same string no matter in
 * which order their keys were inserted (two clients writing the same shape, a
 * shape that went through `{ ...a, ...b }`, a Y.Map `toJSON()`).
 *
 * Everything else follows `JSON.stringify`: `undefined` / function / symbol
 * properties are dropped (and become `null` inside arrays), non-finite numbers
 * become `null`, and `toJSON()` is honored. Keys are compared by UTF-16 code
 * units (`Array.prototype.sort` default), which is what another implementation
 * must match to produce the same hashes.
 *
 * @throws TypeError for a `BigInt`, which JSON cannot represent.
 */
export function canonicalJson(value: unknown): string {
	return serialize(value) ?? "null";
}

function serialize(input: unknown): string | undefined {
	let value = input;
	if (
		value !== null &&
		typeof value === "object" &&
		typeof (value as { toJSON?: unknown }).toJSON === "function"
	) {
		value = (value as { toJSON: () => unknown }).toJSON();
	}
	if (value === null) return "null";
	switch (typeof value) {
		case "string":
			return JSON.stringify(value);
		case "number":
			return Number.isFinite(value) ? JSON.stringify(value) : "null";
		case "boolean":
			return value ? "true" : "false";
		case "bigint":
			throw new TypeError("canonicalJson: a BigInt value cannot be serialized to JSON");
		case "undefined":
		case "function":
		case "symbol":
			return undefined;
	}
	if (Array.isArray(value)) {
		return `[${value.map((item) => serialize(item) ?? "null").join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const parts: string[] = [];
	for (const key of Object.keys(record).sort()) {
		const serialized = serialize(record[key]);
		if (serialized !== undefined) parts.push(`${JSON.stringify(key)}:${serialized}`);
	}
	return `{${parts.join(",")}}`;
}
