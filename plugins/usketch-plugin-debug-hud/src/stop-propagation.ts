import type {
	MouseEvent as ReactMouseEvent,
	PointerEvent as ReactPointerEvent,
	WheelEvent as ReactWheelEvent,
} from "react";

/**
 * HUD パネルは Canvas コンテナと同じ React ツリー内（fixed レイヤーとして
 * `<Canvas>` の子）に描画される。そのためパネル上のポインタ操作がそのまま
 * 祖先の Canvas コンテナ（`onPointerDown` でアクティブツールを駆動する）へ
 * バブリングし、意図しない描画・選択・選択解除を引き起こす。
 *
 * 各パネルの最外要素にこのハンドラ群を spread し、パネル内で発生した
 * 操作起点のイベントが Canvas まで伝播しないようにする。パネル内のボタンや
 * 入力の自前ハンドラは（ターゲットで先に実行されるため）影響を受けない。
 *
 * 意図的に **pointerdown / click / wheel / contextmenu だけ** を止め、
 * pointermove / pointerup は通す:
 *  - ツールの操作は pointerdown が起点（select ツールの選択解除も pointerdown、
 *    onPointerUp は drag 中でなければ no-op）なので、pointerdown を止めれば
 *    意図しない操作は防げる。
 *  - 一方 pointerup を止めると、Canvas 上で開始したドラッグを HUD パネル上で
 *    離した場合にドラッグが確定できず宙ぶらりんになる。move/up を通しておけば
 *    その取りこぼしが起きない（drag 未開始時の move/up はツール側で no-op）。
 */
export const STOP_CANVAS_PROPAGATION = {
	onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
	onClick: (e: ReactMouseEvent) => e.stopPropagation(),
	onWheel: (e: ReactWheelEvent) => e.stopPropagation(),
	onContextMenu: (e: ReactMouseEvent) => e.stopPropagation(),
} as const;
