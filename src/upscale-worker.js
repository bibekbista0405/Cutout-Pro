// Runs the neural super-resolution model in a dedicated worker so stage 3
// ("Rebuild") never blocks the main thread / browser UI. Without this, the
// tiled Swin2SR inference calls run synchronously on the page's own thread,
// which is what makes the whole tab (and on modest hardware, the whole
// machine) feel frozen while "Rebuild" is active.
//
// WebGPU is intentionally NOT used here. On several real setups this model
// throws a hard onnxruntime-web/JSEP error mid-inference:
//   "[WebGPU] Kernel "[Slice] /Slice_1" failed. Error: Failed to generate
//    kernel's output..."
// and — because that error comes from a genuine bug in onnxruntime-web's
// WebGPU backend for this op, not from anything this app controls — even a
// same-session retry on the "wasm" device kept hitting the identical
// WebGPU-tagged failure. Rather than ship a retry loop that can't reliably
// recover from a bug in a lower layer, this worker always uses the WASM/CPU
// backend, which is slower per tile but has been solid in testing. If a
// future onnxruntime-web release fixes the WebGPU Slice kernel, flip
// USE_WEBGPU back to true.
import { pipeline, RawImage, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;
// This dev server doesn't send the COOP/COEP headers required for
// cross-origin isolation, so multi-threaded WASM can't actually run here —
// asking for it just prints a noisy fallback warning. Pin to 1 thread so it
// initializes cleanly instead.
env.backends.onnx.wasm.numThreads = 1;

const UPSCALE_MODEL = "Xenova/swin2SR-lightweight-x2-64";
const USE_WEBGPU = false; // see note above

// Watchdogs: nothing in this worker is allowed to hang forever. If a step
// blows through its budget we reject with a clear message instead of
// leaving the UI spinning indefinitely.
const MODEL_LOAD_TIMEOUT_MS = 60_000;
const TILE_TIMEOUT_MS = 45_000;

let upscalerPromise = null;
let runtimeLabel = "";

function withTimeout(promise, ms, message) {
  let timer;
  const guarded = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, guarded]).finally(() => clearTimeout(timer));
}

function progressReporter() {
  return data => {
    if (data && typeof data === "object") postMessage({ type: "progress", data });
  };
}

function getUpscaler() {
  if (!upscalerPromise) {
    const device = USE_WEBGPU && typeof navigator !== "undefined" && navigator.gpu ? "webgpu" : "wasm";
    const dtype = device === "webgpu" ? "fp16" : "q8";
    upscalerPromise = withTimeout(
      pipeline("image-to-image", UPSCALE_MODEL, { device, dtype, progress_callback: progressReporter() }),
      MODEL_LOAD_TIMEOUT_MS,
      "The neural model failed to load. Check your connection and try again."
    );
    upscalerPromise.catch(() => { upscalerPromise = null; });
    runtimeLabel = device === "webgpu" ? "WebGPU · tiled neural inference (worker)" : "CPU (WASM) · quantized tiled neural inference (worker)";
  }
  return upscalerPromise;
}

self.onmessage = async e => {
  const { id, type } = e.data || {};
  try {
    if (type === "warmup") {
      await getUpscaler();
      postMessage({ id, type: "ready", runtime: runtimeLabel });
      return;
    }
    if (type === "tile") {
      const { data, width, height, channels } = e.data;
      const upscaler = await getUpscaler();
      const raw = new RawImage(new Uint8ClampedArray(data), width, height, channels);
      const output = await withTimeout(upscaler(raw), TILE_TIMEOUT_MS, "A tile timed out during neural reconstruction.");
      const rgba = output.rgba();
      const bytes = rgba.data instanceof Uint8ClampedArray ? rgba.data : new Uint8ClampedArray(rgba.data);
      postMessage({ id, type: "result", data: bytes.buffer, width: rgba.width, height: rgba.height, runtime: runtimeLabel }, [bytes.buffer]);
      return;
    }
  } catch (err) {
    postMessage({ id, type: "error", message: err?.message || String(err) });
  }
};
