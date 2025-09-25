import type { GestureType } from "@usketch/input-presets";
import type { EventEmitter, GestureEvent, GestureState } from "../types";

/**
 * ジェスチャー認識管理クラス
 */
export class GestureManager implements EventEmitter {
	private listeners: Map<string, Set<Function>> = new Map();
	private touches: Map<number, GestureState> = new Map();
	private enabled = true;
	private lastGestureTime = 0;
	private gestureTimeout: number | null = null;

	// ジェスチャー認識の設定
	private config = {
		pinchThreshold: 0.01, // ピンチ認識の閾値
		rotationThreshold: 0.01, // 回転認識の閾値（ラジアン）
		swipeThreshold: 50, // スワイプ認識の最小距離
		swipeTimeout: 300, // スワイプのタイムアウト（ms）
		doubleTapTimeout: 300, // ダブルタップのタイムアウト（ms）
		longPressTimeout: 500, // 長押しのタイムアウト（ms）
		debug: false,
	};

	constructor(config: Partial<typeof GestureManager.prototype.config> = {}) {
		this.config = {
			...this.config,
			...config,
		};
	}

	/**
	 * タッチ開始イベントを処理
	 */
	handleTouchStart(event: TouchEvent): void {
		if (!this.enabled) return;

		// タッチポイントを記録
		for (let i = 0; i < event.changedTouches.length; i++) {
			const touch = event.changedTouches.item(i);
			if (!touch) continue;
			this.touches.set(touch.identifier, {
				id: touch.identifier,
				startX: touch.clientX,
				startY: touch.clientY,
				currentX: touch.clientX,
				currentY: touch.clientY,
				timestamp: Date.now(),
			});
		}

		// ダブルタップ検出
		if (event.touches.length === 1) {
			const now = Date.now();
			if (now - this.lastGestureTime < this.config.doubleTapTimeout) {
				this.emitGesture("doubleTap", event);
				this.lastGestureTime = 0;
			} else {
				this.lastGestureTime = now;

				// 長押し検出の開始
				this.gestureTimeout = window.setTimeout(() => {
					if (this.touches.size === 1) {
						this.emitGesture("longPress", event);
					}
				}, this.config.longPressTimeout);
			}
		}

		// マルチタッチジェスチャーの開始
		if (event.touches.length === 2) {
			this.emitGesture("pinchStart", event);
		}

		if (this.config.debug) {
			console.log(`[GestureManager] Touch start: ${event.touches.length} touches`);
		}
	}

	/**
	 * タッチ移動イベントを処理
	 */
	handleTouchMove(event: TouchEvent): void {
		if (!this.enabled) return;

		// 長押しタイマーをキャンセル
		if (this.gestureTimeout) {
			clearTimeout(this.gestureTimeout);
			this.gestureTimeout = null;
		}

		// タッチポイントの位置を更新
		for (let i = 0; i < event.changedTouches.length; i++) {
			const touch = event.changedTouches.item(i);
			if (!touch) continue;
			const state = this.touches.get(touch.identifier);
			if (state) {
				state.currentX = touch.clientX;
				state.currentY = touch.clientY;
			}
		}

		// ピンチ/回転ジェスチャーの処理
		if (event.touches.length === 2) {
			this.handlePinchRotate(event);
		}

		// パンジェスチャーの処理
		if (event.touches.length === 1) {
			const touch = event.touches.item(0);
			if (touch) {
				const state = this.touches.get(touch.identifier);
				if (state) {
					const gestureEvent: GestureEvent = {
						type: "pan",
						deltaX: touch.clientX - state.currentX,
						deltaY: touch.clientY - state.currentY,
					};
					this.emit("gesture:pan", gestureEvent);
				}
			}
		}

		// 3本指スワイプの処理
		if (event.touches.length === 3) {
			this.handleThreeFingerSwipe(event);
		}
	}

	/**
	 * タッチ終了イベントを処理
	 */
	handleTouchEnd(event: TouchEvent): void {
		if (!this.enabled) return;

		// 長押しタイマーをキャンセル
		if (this.gestureTimeout) {
			clearTimeout(this.gestureTimeout);
			this.gestureTimeout = null;
		}

		// スワイプ検出
		if (event.changedTouches.length === 1 && event.touches.length === 0) {
			const touch = event.changedTouches.item(0);
			if (touch) {
				const state = this.touches.get(touch.identifier);
				if (state) {
					const deltaX = touch.clientX - state.startX;
					const deltaY = touch.clientY - state.startY;
					const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
					const duration = Date.now() - state.timestamp;

					if (distance > this.config.swipeThreshold && duration < this.config.swipeTimeout) {
						const direction = this.getSwipeDirection(deltaX, deltaY);
						const velocity = distance / duration;

						const gestureEvent: GestureEvent = {
							type: "swipe",
							direction,
							velocity,
							deltaX,
							deltaY,
						};
						this.emit("gesture:swipe", gestureEvent);
					}
				}
			}
		}

		// ピンチ終了
		if (event.touches.length < 2 && this.touches.size >= 2) {
			this.emitGesture("pinchEnd", event);
		}

		// タッチポイントを削除
		for (let i = 0; i < event.changedTouches.length; i++) {
			const touch = event.changedTouches.item(i);
			if (touch) {
				this.touches.delete(touch.identifier);
			}
		}

		if (this.config.debug) {
			console.log(`[GestureManager] Touch end: ${event.touches.length} remaining`);
		}
	}

	/**
	 * タッチキャンセルイベントを処理
	 */
	handleTouchCancel(_event: TouchEvent): void {
		// 長押しタイマーをキャンセル
		if (this.gestureTimeout) {
			clearTimeout(this.gestureTimeout);
			this.gestureTimeout = null;
		}

		// すべてのタッチポイントをクリア
		this.touches.clear();
	}

	/**
	 * ピンチ/回転ジェスチャーを処理
	 */
	private handlePinchRotate(event: TouchEvent): void {
		if (event.touches.length !== 2) return;

		const touch1 = event.touches.item(0);
		const touch2 = event.touches.item(1);

		if (!touch1 || !touch2) return;

		const state1 = this.touches.get(touch1.identifier);
		const state2 = this.touches.get(touch2.identifier);

		if (!state1 || !state2) return;

		// 現在の距離と角度
		const currentDistance = this.getDistance(
			touch1.clientX,
			touch1.clientY,
			touch2.clientX,
			touch2.clientY,
		);
		const currentAngle = this.getAngle(
			touch1.clientX,
			touch1.clientY,
			touch2.clientX,
			touch2.clientY,
		);

		// 開始時の距離と角度
		const startDistance = this.getDistance(
			state1.startX,
			state1.startY,
			state2.startX,
			state2.startY,
		);
		const startAngle = this.getAngle(state1.startX, state1.startY, state2.startX, state2.startY);

		// スケールと回転の計算
		const scale = currentDistance / startDistance;
		const rotation = currentAngle - startAngle;

		// ピンチジェスチャー
		if (Math.abs(scale - 1) > this.config.pinchThreshold) {
			const gestureEvent: GestureEvent = {
				type: "pinch",
				scale,
			};
			this.emit("gesture:pinch", gestureEvent);
		}

		// 回転ジェスチャー
		if (Math.abs(rotation) > this.config.rotationThreshold) {
			const gestureEvent: GestureEvent = {
				type: "rotate",
				rotation,
			};
			this.emit("gesture:rotate", gestureEvent);
		}
	}

	/**
	 * 3本指スワイプを処理
	 */
	private handleThreeFingerSwipe(event: TouchEvent): void {
		if (event.touches.length !== 3) return;

		// 平均移動量を計算
		let totalDeltaX = 0;
		let totalDeltaY = 0;
		let validTouches = 0;

		for (let i = 0; i < event.touches.length; i++) {
			const touch = event.touches.item(i);
			if (!touch) continue;
			const state = this.touches.get(touch.identifier);
			if (state) {
				totalDeltaX += touch.clientX - state.startX;
				totalDeltaY += touch.clientY - state.startY;
				validTouches++;
			}
		}

		if (validTouches === 3) {
			const avgDeltaX = totalDeltaX / 3;
			const avgDeltaY = totalDeltaY / 3;
			const distance = Math.sqrt(avgDeltaX * avgDeltaX + avgDeltaY * avgDeltaY);

			if (distance > this.config.swipeThreshold) {
				const direction = this.getSwipeDirection(avgDeltaX, avgDeltaY);
				const gestureEvent: GestureEvent = {
					type: "threeFingerSwipe",
					direction,
					deltaX: avgDeltaX,
					deltaY: avgDeltaY,
				};
				this.emit("gesture:threeFingerSwipe", gestureEvent);
			}
		}
	}

	/**
	 * ジェスチャーイベントを発火
	 */
	private emitGesture(type: GestureType | string, _event: TouchEvent): void {
		const gestureEvent: GestureEvent = {
			type: type as GestureType,
		};
		this.emit(`gesture:${type}`, gestureEvent);
	}

	/**
	 * 2点間の距離を計算
	 */
	private getDistance(x1: number, y1: number, x2: number, y2: number): number {
		const dx = x2 - x1;
		const dy = y2 - y1;
		return Math.sqrt(dx * dx + dy * dy);
	}

	/**
	 * 2点間の角度を計算
	 */
	private getAngle(x1: number, y1: number, x2: number, y2: number): number {
		return Math.atan2(y2 - y1, x2 - x1);
	}

	/**
	 * スワイプの方向を取得
	 */
	private getSwipeDirection(deltaX: number, deltaY: number): "up" | "down" | "left" | "right" {
		const absX = Math.abs(deltaX);
		const absY = Math.abs(deltaY);

		if (absX > absY) {
			return deltaX > 0 ? "right" : "left";
		} else {
			return deltaY > 0 ? "down" : "up";
		}
	}

	/**
	 * イベントエミッター: イベントリスナーを登録
	 */
	on(event: string, handler: Function): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler);
	}

	/**
	 * イベントエミッター: イベントリスナーを削除
	 */
	off(event: string, handler: Function): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * イベントエミッター: イベントを発火
	 */
	emit(event: string, data: any): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.forEach((handler) => {
				handler(data);
			});
		}
	}

	/**
	 * マネージャーを有効化
	 */
	enable(): void {
		this.enabled = true;
	}

	/**
	 * マネージャーを無効化
	 */
	disable(): void {
		this.enabled = false;
	}

	/**
	 * 設定を更新
	 */
	updateConfig(config: Partial<typeof GestureManager.prototype.config>): void {
		this.config = {
			...this.config,
			...config,
		};
	}
}
