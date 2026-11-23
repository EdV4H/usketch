/**
 * 権限のインターフェース（どの権限の仕組みにもつなげられる口）。
 *
 * コアは「この人はこれをしてよいか」を {@link PermissionProvider.can} で聞くだけで、
 * 判定の中身（役割表・CASL・利用先の API など）は知らない。つなぎ先はアダプターで選ぶ:
 * ここにある素朴なもの（全部可・全部不可・決めた一覧）のほか、CASL などのアダプターは
 * 別パッケージで足す。
 */

/** 権限の名前。`"page.edit"` のようなコアの権限か、`"<plugin id>:<操作>"` のようなプラグインの権限。 */
export type Permission = string;

/** コアが使う権限の名前。 */
export const PERMISSIONS = {
	/** ページを見る（ページ doc を読む）。 */
	pageView: "page.view",
	/** ページの中身を変える（ページ doc に書く）。 */
	pageEdit: "page.edit",
	/** ページそのものを管理する（名前・削除・プラグイン・公開範囲・招待）。 */
	pageManage: "page.manage",
	/** ページを新しく作る。 */
	pageCreate: "page.create",
	/** ボード全体を管理する。 */
	boardAdmin: "board.admin",
} as const;

/** 何に対する権限か。省略すると「今開いているもの」について聞く。 */
export interface PermissionResource {
	boardId?: string;
	pageId?: string;
	[key: string]: unknown;
}

/** 誰の権限か（サーバー側で使う）。`userId: null` はログインしていない人。 */
export interface PermissionSubject {
	userId: string | null;
	[key: string]: unknown;
}

/**
 * ある時点の「できること」。同期で答える。サーバーでは接続ごとに 1 つ持つ。
 */
export interface PermissionSnapshot {
	can(permission: Permission, resource?: PermissionResource): boolean;
}

/**
 * ブラウザ側の権限の口。HUD の表示やツールの出し分けで何度も呼ばれるので同期で答え、
 * 答えが変わったら（役割の変更・招待など）`subscribe` のリスナーを呼ぶ。
 */
export interface PermissionProvider extends PermissionSnapshot {
	subscribe(listener: () => void): () => void;
}

/**
 * サーバー側（Workers / Durable Object）の権限の口。D1 や外部の API を引くので非同期で、
 * 結果は {@link PermissionSnapshot} に固めて使う。
 */
export interface ServerPermissionResolver {
	resolve(subject: PermissionSubject, resource: PermissionResource): Promise<PermissionSnapshot>;
}

/** 権限を要るもの（HUD の操作・設定・パネル）が、今の権限で出せるか。`requires` が無ければ出せる。 */
export function isPermitted(
	permissions: PermissionSnapshot | undefined,
	requires: Permission | undefined,
	resource?: PermissionResource,
): boolean {
	if (!requires || !permissions) return true;
	return permissions.can(requires, resource);
}

const noop = () => {};

const ALLOW_ALL: PermissionProvider = Object.freeze({ can: () => true, subscribe: () => noop });

/** 全部できる（権限を使わないホスト・ローカルのボード・既定）。 */
export function allowAllPermissions(): PermissionProvider {
	return ALLOW_ALL;
}

/**
 * プラグインの文脈（`ctx`）から権限を読む。古いコアの文脈やホストが権限を渡していない
 * ときは「全部可」を返すので、プラグインはいつでも `permissionsOf(ctx).can(...)` と書ける。
 */
export function permissionsOf(ctx: { permissions?: PermissionProvider }): PermissionProvider {
	return ctx.permissions ?? ALLOW_ALL;
}

/** 何もできない。 */
export function denyAllPermissions(): PermissionProvider {
	return { can: () => false, subscribe: () => noop };
}

/** 判定を差し替えられる {@link PermissionProvider}。 */
export interface StaticPermissionProvider extends PermissionProvider {
	/** 判定を差し替え、リスナーに知らせる。 */
	set(rule: PermissionRule): void;
}

/** 許す権限の一覧、または判定する関数。 */
export type PermissionRule =
	| Iterable<Permission>
	| ((permission: Permission, resource?: PermissionResource) => boolean);

function toCheck(
	rule: PermissionRule,
): (permission: Permission, resource?: PermissionResource) => boolean {
	if (typeof rule === "function") return rule;
	const granted = new Set(rule);
	return (permission) => granted.has(permission);
}

/**
 * 決めた一覧（または関数）で答える {@link PermissionProvider}。テスト・お試しボード・
 * 簡単な役割表に使う。役割が変わったら `set` で差し替える。
 *
 * ```ts
 * const permissions = createStaticPermissionProvider([PERMISSIONS.pageView]);
 * permissions.set([PERMISSIONS.pageView, PERMISSIONS.pageEdit]); // 編集者になった
 * ```
 */
export function createStaticPermissionProvider(rule: PermissionRule): StaticPermissionProvider {
	let check = toCheck(rule);
	const listeners = new Set<() => void>();
	return {
		can: (permission, resource) => check(permission, resource),
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set(next) {
			check = toCheck(next);
			for (const listener of [...listeners]) listener();
		},
	};
}

/**
 * `base` と同じだが、`resource` を省いて聞かれたら（「今開いているもの」について）`scope` の
 * ものとして聞く。渡された `resource` は `scope` に重ねる。ホストがページごとの App に渡す:
 * `scopePermissions(boardPermissions, () => ({ boardId, pageId, ...pageAccess }))`。
 */
export function scopePermissions(
	base: PermissionProvider,
	scope: PermissionResource | (() => PermissionResource),
): PermissionProvider {
	const current = typeof scope === "function" ? scope : () => scope;
	return {
		can: (permission, resource) => base.can(permission, { ...current(), ...resource }),
		subscribe: (listener) => base.subscribe(listener),
	};
}
