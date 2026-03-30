export interface GpuContext {
	device: GPUDevice;
	format: GPUTextureFormat;
	canvas: HTMLCanvasElement;
	gpuCtx: GPUCanvasContext;
	/** Register a callback invoked when the device is lost. */
	onDeviceLost(cb: (reason: string) => void): void;
}

export async function initGpuContext(canvas: HTMLCanvasElement): Promise<GpuContext | null> {
	if (!navigator.gpu) return null;

	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) return null;

	const device = await adapter.requestDevice();
	const gpuCtx = canvas.getContext("webgpu");
	if (!gpuCtx) return null;

	const format = navigator.gpu.getPreferredCanvasFormat();
	gpuCtx.configure({ device, format, alphaMode: "premultiplied" });

	const lostCallbacks: ((reason: string) => void)[] = [];
	device.lost.then((info) => {
		const reason = info.reason ?? "unknown";
		for (const cb of lostCallbacks) cb(reason);
	});

	return {
		device,
		format,
		canvas,
		gpuCtx,
		onDeviceLost(cb) {
			lostCallbacks.push(cb);
		},
	};
}
