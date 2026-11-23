/**
 * CASL を uSketch の権限の口（`PermissionProvider` / `ServerPermissionResolver`）につなぐ。
 *
 * 権限の名前は CASL の「操作 + 対象」に分けて聞く: `"page.edit"` は対象 `page` への `edit`、
 * プラグインの `"<plugin id>:<操作>"` は対象 `<plugin id>` への `<操作>`。聞くときの
 * `PermissionResource`（`{ pageId, … }`）は、その対象の中身として条件（`{ ownerId: userId }` など）に
 * 照らされる。
 *
 * ルールは JSON（CASL の生のルール）なので、サーバーで作ってそのままブラウザへ送れる
 * （`packRules` / `unpackRules` で詰めてもよい）。両方が同じルールで判定するので食い違わない。
 */
import {
	type AnyMongoAbility,
	subject as asSubject,
	createMongoAbility,
	type MongoAbility,
	type RawRuleOf,
} from "@casl/ability";
import type {
	Permission,
	PermissionProvider,
	PermissionResource,
	PermissionSnapshot,
	PermissionSubject,
	ServerPermissionResolver,
} from "@edv4h/usketch-shared";

/** uSketch の権限を聞くときの CASL の能力（操作も対象も文字列）。 */
export type UsketchAbility = MongoAbility<[string, string]>;

/** CASL の生のルール（JSON）。サーバーからブラウザへそのまま送れる。 */
export type UsketchRawRule = RawRuleOf<UsketchAbility>;

/** 権限の名前を CASL の操作と対象に分けたもの。 */
export interface CaslTarget {
	action: string;
	subject: string;
}

/**
 * 既定の分け方: `"page.edit"` → `edit` / `page`、`"usketch-plugin-ai:use"` → `use` /
 * `usketch-plugin-ai`。区切りの無い名前は対象 `all` への操作。
 */
export function toCaslTarget(permission: Permission): CaslTarget {
	const colon = permission.lastIndexOf(":");
	if (colon > 0) {
		return { subject: permission.slice(0, colon), action: permission.slice(colon + 1) };
	}
	const dot = permission.lastIndexOf(".");
	if (dot > 0) {
		return { subject: permission.slice(0, dot), action: permission.slice(dot + 1) };
	}
	return { subject: "all", action: permission };
}

export interface CaslCheckOptions {
	/** 権限の名前を CASL の操作と対象に分ける（既定 {@link toCaslTarget}）。 */
	toTarget?: (permission: Permission) => CaslTarget;
}

/** `ability` で `permission` を `resource` について聞く。 */
export function caslCan(
	ability: AnyMongoAbility,
	permission: Permission,
	resource: PermissionResource | undefined,
	toTarget: (permission: Permission) => CaslTarget = toCaslTarget,
): boolean {
	const { action, subject } = toTarget(permission);
	// 中身を渡して聞く（条件付きのルールが効く）。毎回新しいオブジェクトに型の印を付ける。
	return ability.can(action, asSubject(subject, { ...resource }));
}

/** CASL のルールで答える {@link PermissionProvider}。 */
export interface CaslPermissionProvider extends PermissionProvider {
	/** 今の CASL の能力。 */
	readonly ability: UsketchAbility;
	/** ルールを差し替え（役割が変わった・サーバーから届いた）、リスナーに知らせる。 */
	update(rules: readonly UsketchRawRule[]): void;
}

export interface CaslPermissionProviderOptions extends CaslCheckOptions {
	/** 最初のルール。省略すると何もできない。 */
	rules?: readonly UsketchRawRule[];
}

/**
 * CASL のルールで答える {@link PermissionProvider}。ブラウザで使う: サーバーから届いたルールを
 * `update` で入れると、HUD などがすぐ出し直す。
 *
 * ```ts
 * const permissions = createCaslPermissionProvider({ rules: [{ action: "view", subject: "page" }] });
 * createApp({ store, plugins, permissions });
 * permissions.update(rulesFromServer);
 * ```
 */
export function createCaslPermissionProvider(
	options: CaslPermissionProviderOptions = {},
): CaslPermissionProvider {
	const ability = createMongoAbility<[string, string]>([...(options.rules ?? [])]);
	const listeners = new Set<() => void>();
	return {
		ability,
		can: (permission, resource) => caslCan(ability, permission, resource, options.toTarget),
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		update(rules) {
			ability.update([...rules]);
			for (const listener of [...listeners]) listener();
		},
	};
}

/** ルールから、その時点の判定（{@link PermissionSnapshot}）を作る。サーバーの接続ごとに持つ。 */
export function createCaslSnapshot(
	rules: readonly UsketchRawRule[],
	options: CaslCheckOptions = {},
): PermissionSnapshot & { readonly ability: UsketchAbility } {
	const ability = createMongoAbility<[string, string]>([...rules]);
	return {
		ability,
		can: (permission, resource) => caslCan(ability, permission, resource, options.toTarget),
	};
}

export interface CaslServerResolverOptions extends CaslCheckOptions {
	/** この人・このボード（ページ）のルールを作る（D1 を引くなど）。 */
	loadRules(
		subject: PermissionSubject,
		resource: PermissionResource,
	): Promise<readonly UsketchRawRule[]> | readonly UsketchRawRule[];
}

/** サーバー側の口。ルールを引いて、判定とルール（ブラウザへ送る用）を返す。 */
export interface CaslServerResolver extends ServerPermissionResolver {
	resolve(
		subject: PermissionSubject,
		resource: PermissionResource,
	): Promise<PermissionSnapshot & { readonly rules: readonly UsketchRawRule[] }>;
}

/** CASL のルールで答える {@link ServerPermissionResolver}（Workers / Durable Object 用）。 */
export function createCaslServerResolver(options: CaslServerResolverOptions): CaslServerResolver {
	return {
		async resolve(subject, resource) {
			const rules = await options.loadRules(subject, resource);
			const snapshot = createCaslSnapshot(rules, options);
			return { can: snapshot.can, rules };
		},
	};
}
