export interface GpuContext {
	device: GPUDevice;
	format: GPUTextureFormat;
	canvas: HTMLCanvasElement;
	gpuCtx: GPUCanvasContext;
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

	return { device, format, canvas, gpuCtx };
}
