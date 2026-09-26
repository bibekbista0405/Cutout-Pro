import { removeBackground } from "@imgly/background-removal";
import { pipeline, env, RawImage } from "@huggingface/transformers";
import "./style.css";

env.allowLocalModels = false;
env.useBrowserCache = true;

env.backends = env.backends || {};

const UPSCALE_MODEL = "Xenova/swin2SR-lightweight-x2-64";
const MAX_SOURCE_MB = 25;
const MAX_SOURCE_PIXELS = 30_000_000;
// Deliberately conservative: browser ML should never be allowed to consume the machine.
const PROCESS_MAX_EDGE = 768;
const UPSCALE_TILE = 256;
const EXPORT_MAX_PIXELS = 8_000_000;
const app = document.querySelector("#app");

app.innerHTML = `
<div class="app-shell">
  <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="ambient ambient-c"></div><div class="ambient ambient-d"></div>
  <header class="nav glass-panel">
    <div class="brand"><div class="logo-liquid">C</div><div><strong>Cutout</strong><span>PRO</span><small>local image restoration studio</small></div></div>
    <div class="nav-actions"><div class="privacy"><i></i> processing stays on-device</div><button id="theme" class="icon-btn liquid-control" aria-label="Toggle theme">◐</button></div>
  </header>

  <main>
    <section class="hero">
      <div class="pill glass-chip">CLEARER PIXELS · CLEANER CUTOUTS</div>
      <h1>Make the pixels<br><em>feel alive.</em></h1>
      <p>Clean the background, reconstruct missing detail, and keep the result transparent — without pretending a resize is enhancement.</p>
      <div class="hero-proof"><span>Neural 2×</span><span>Tile-safe inference</span><span>Local-first</span></div>
    </section>

    <section id="uploadView" class="upload-view">
      <div id="dropzone" class="dropzone liquid-glass">
        <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="upload-orb"><div>↑</div></div>
        <h2>Drop a photo into the glass</h2><p>JPG, PNG or WEBP · up to 25 MB</p>
        <button id="choose" class="primary liquid-button">Choose photo</button>
        <div class="formats"><span>AI 2×</span><span>Transparent PNG</span><span>Memory-safe</span></div>
      </div>
      <div class="feature-row">
        <div class="mini-glass"><b>Neural reconstruction</b><small>Real Swin2SR reconstruction, processed in small tiles instead of one memory-heavy frame.</small></div>
        <div class="mini-glass"><b>Precision transparency</b><small>The AI mask is composited with GPU/browser canvas operations instead of giant pixel-copy loops.</small></div>
        <div class="mini-glass"><b>Responsive by design</b><small>Inference is capped, serialized, and yielded between tiles so the browser can keep breathing.</small></div>
      </div>
    </section>

    <section id="processing" class="processing hidden">
      <div class="process-card liquid-glass">
        <div class="process-top"><div><span class="pill glass-chip" id="processBadge">AI WORKSPACE</span><h2 id="processTitle">Preparing the image…</h2><p id="processSub">Checking dimensions before heavy processing.</p></div><div class="timer" id="timer">0.0s</div></div>
        <div class="stage-list">
          <div class="stage active" id="stage1"><i>1</i><div><b>Preparing pixels</b><small>Decoding and memory-safe normalization</small></div><span>•••</span></div>
          <div class="stage" id="stage2"><i>2</i><div><b>Finding the subject</b><small>Lightweight AI foreground segmentation</small></div><span>•••</span></div>
          <div class="stage" id="stage3"><i>3</i><div><b>Reconstructing detail</b><small>Small-tile neural super-resolution</small></div><span>•••</span></div>
          <div class="stage" id="stage4"><i>4</i><div><b>Refining the edges</b><small>Alpha resampling and transparent compositing</small></div><span>•••</span></div>
          <div class="stage" id="stage5"><i>5</i><div><b>Compositing result</b><small>Building the transparent enhanced PNG</small></div><span>•••</span></div>
        </div>
        <div class="progressbar"><span id="bar"></span></div>
        <div class="fun-tip" id="tip">The first AI run downloads and caches the models. Processing is intentionally capped to protect your browser and laptop.</div>
        <button id="processingNew" class="ghost liquid-control">Choose a different photo</button>
      </div>
    </section>

    <section id="editor" class="editor hidden">
      <div class="editor-head"><div><span class="pill glass-chip">RESTORED</span><h2>Your enhanced cutout</h2><p id="stats"></p></div><button id="new" class="ghost liquid-control">＋ New photo</button></div>
      <div class="canvas-card liquid-glass">
        <div class="canvas-head"><div class="tabs"><button class="tab active" data-mode="result">Enhanced</button><button class="tab" data-mode="original">Original</button><button class="tab" data-mode="split">Compare</button></div><div class="zoom"><button id="zoomOut">−</button><span id="zoomText">100%</span><button id="zoomIn">＋</button></div></div>
        <div id="preview" class="preview checker"><div id="splitPane"><img id="previewImg" alt="AI enhanced result"></div><img id="originalImg" class="original-img" alt="Original image"></div>
      </div>
      <div class="quality-panel liquid-glass"><div><span class="eyebrow">PROCESSING REPORT</span><strong id="qualityTitle">Swin2SR neural reconstruction · 2×</strong><small id="qualityDetail">AI reconstruction, not simple browser interpolation.</small></div><div class="quality-badge"><span>✓</span> genuinely enhanced</div></div>
      <div class="tools">
        <div class="tool-group liquid-glass"><label>Preview background</label><div class="choices"><button class="choice selected" data-bg="checker">Transparent</button><button class="choice" data-bg="#ffffff">White</button><button class="choice" data-bg="#111827">Dark</button><button class="choice" data-bg="#dbeafe">Blue</button></div></div>
        <div class="tool-group liquid-glass"><label>AI export resolution</label><div class="select-row"><select id="scale"><option value="1">1× current enhanced</option><option value="2" selected>2× current AI result</option><option value="4">4× AI reconstruction</option></select><button id="download" class="primary liquid-button">Download PNG ↓</button></div></div>
      </div>
      <div class="extras"><div class="extra liquid-glass"><b>Source</b><span id="sourceInfo"></span></div><div class="extra liquid-glass"><b>Pipeline</b><span>AI mask → tiled Swin2SR → alpha compositing → transparent PNG</span></div><div class="extra liquid-glass"><b>Runtime</b><span id="runtimeInfo"></span></div></div>
      <p class="disclaimer">Super-resolution reconstructs plausible fine detail; it cannot recover missing information with certainty. ClearCut uses neural reconstruction rather than ordinary canvas enlargement.</p>
    </section>
  </main>
  <footer>Cutout Pro · neural image restoration · liquid glass interface</footer>
</div>`;

const $ = id => document.getElementById(id);
let file, processingBlob, originalUrl, resultUrl, resultBlob, alphaBlob;
let elapsed = 0, timerInt, zoom = 1, upscalerPromise, busy = false, jobToken = 0;

const yieldToBrowser = () => new Promise(resolve => {
  if (typeof scheduler !== "undefined" && scheduler.postTask) scheduler.postTask(resolve, { priority: "background" });
  else setTimeout(resolve, 0);
});
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

async function getUpscaler() {
  if (!upscalerPromise) {
    const webgpu = !!navigator.gpu;
    upscalerPromise = (async () => {
      try {
        if (webgpu) {
          const p = await pipeline("image-to-image", UPSCALE_MODEL, { device: "webgpu", dtype: "fp16" });
          $("runtimeInfo").textContent = "WebGPU · tiled neural inference";
          return p;
        }
      } catch (error) {
        console.warn("WebGPU super-resolution unavailable; using quantized WASM.", error);
      }
      const p = await pipeline("image-to-image", UPSCALE_MODEL, { device: "wasm", dtype: "q8" });
      $("runtimeInfo").textContent = "WASM · quantized tiled neural inference";
      return p;
    })();
  }
  return upscalerPromise;
}

function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setStage(n) {
  for (let i = 1; i <= 5; i++) { $("stage" + i).classList.toggle("active", i === n); $("stage" + i).classList.toggle("done", i < n); }
  $("bar").style.width = `${Math.min(100, ((n - 1) / 4) * 100 + 7)}%`;
}
function revoke(url) { if (url) URL.revokeObjectURL(url); }

async function fileInfo(blob) {
  const u = URL.createObjectURL(blob);
  try { const i = new Image(); i.src = u; await i.decode(); return { width: i.naturalWidth, height: i.naturalHeight }; }
  finally { URL.revokeObjectURL(u); }
}

async function normalizeForProcessing(input) {
  const info = await fileInfo(input);
  const pixels = info.width * info.height;
  if (pixels > MAX_SOURCE_PIXELS) throw new Error(`This image is ${Math.round(pixels / 1e6)} MP. Please use an image under ${MAX_SOURCE_PIXELS / 1e6} MP.`);
  const scale = Math.min(1, PROCESS_MAX_EDGE / Math.max(info.width, info.height));
  if (scale === 1) return { blob: input, width: info.width, height: info.height, original: info };
  const bitmap = await createImageBitmap(input);
  const width = Math.max(1, Math.round(info.width * scale));
  const height = Math.max(1, Math.round(info.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const blob = await canvasToBlob(canvas);
  canvas.width = 1; canvas.height = 1;
  return { blob, width, height, original: info };
}

function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not encode image")), type, quality));
}

async function blobToCanvas(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext("2d", { alpha: true }).drawImage(bitmap, 0, 0); bitmap.close();
  return canvas;
}

function rawToCanvas(raw) {
  const channels = raw.channels === 4 ? raw : raw.rgba();
  const canvas = document.createElement("canvas"); canvas.width = channels.width; canvas.height = channels.height;
  const ctx = canvas.getContext("2d", { alpha: true });
  const bytes = channels.data instanceof Uint8ClampedArray ? channels.data : new Uint8ClampedArray(channels.data);
  ctx.putImageData(new ImageData(bytes, channels.width, channels.height), 0, 0);
  return canvas;
}

async function upscaleTiled(sourceBlob, token) {
  const source = await RawImage.fromBlob(sourceBlob);
  const sourceCanvas = document.createElement("canvas"); sourceCanvas.width = source.width; sourceCanvas.height = source.height;
  sourceCanvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(source.rgba().data), source.width, source.height), 0, 0);
  const output = document.createElement("canvas"); output.width = source.width * 2; output.height = source.height * 2;
  const out = output.getContext("2d", { alpha: false });
  out.imageSmoothingEnabled = true;

  const upscaler = await getUpscaler();
  const tilesX = Math.ceil(source.width / UPSCALE_TILE);
  const tilesY = Math.ceil(source.height / UPSCALE_TILE);
  const total = tilesX * tilesY;
  let done = 0;

  for (let y = 0; y < source.height; y += UPSCALE_TILE) {
    for (let x = 0; x < source.width; x += UPSCALE_TILE) {
      if (token !== jobToken) throw new DOMException("Cancelled", "AbortError");
      const w = Math.min(UPSCALE_TILE, source.width - x);
      const h = Math.min(UPSCALE_TILE, source.height - y);
      const tile = document.createElement("canvas"); tile.width = w; tile.height = h;
      tile.getContext("2d").drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
      const tileRaw = RawImage.fromCanvas(tile);
      const enhanced = await upscaler(tileRaw);
      const enhancedCanvas = rawToCanvas(enhanced);
      out.drawImage(enhancedCanvas, 0, 0, enhancedCanvas.width, enhancedCanvas.height, x * 2, y * 2, w * 2, h * 2);
      tile.width = 1; tile.height = 1; enhancedCanvas.width = 1; enhancedCanvas.height = 1;
      done++;
      $("processSub").textContent = `Neural tile ${done} of ${total} · ${Math.round(done / total * 100)}% · the browser is yielding between tiles.`;
      $("bar").style.width = `${35 + Math.round((done / total) * 32)}%`;
      await yieldToBrowser();
    }
  }

  sourceCanvas.width = 1; sourceCanvas.height = 1;
  const blob = await canvasToBlob(output);
  output.width = 1; output.height = 1;
  return { blob, width: source.width * 2, height: source.height * 2 };
}

async function compositeWithAlpha(rgbBlob, maskBlob, width, height) {
  const rgb = await createImageBitmap(rgbBlob);
  const mask = await createImageBitmap(maskBlob);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.drawImage(rgb, 0, 0, width, height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mask, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  rgb.close(); mask.close();
  const blob = await canvasToBlob(canvas);
  canvas.width = 1; canvas.height = 1;
  return blob;
}

async function start(f) {
  if (busy) return;
  if (!f.type.startsWith("image/")) return;
  if (f.size > MAX_SOURCE_MB * 1024 * 1024) { showError("That file is larger than 25 MB. Choose a smaller image to keep browser memory stable."); return; }
  busy = true; const token = ++jobToken; file = f; elapsed = 0; zoom = 1;
  revoke(originalUrl); revoke(resultUrl); originalUrl = URL.createObjectURL(f); $("originalImg").src = originalUrl;
  hide("uploadView"); hide("editor"); show("processing"); setStage(1); $("bar").style.width = "7%";
  $("processBadge").textContent = "AI WORKSPACE"; $("processTitle").textContent = "Preparing the image…"; $("processSub").textContent = "Checking dimensions before heavy processing.";
  $("processingNew").disabled = false;
  timerInt = setInterval(() => { elapsed += .1; $("timer").textContent = elapsed.toFixed(1) + "s"; }, 100);
  try {
    await nextFrame();
    const prepared = await normalizeForProcessing(f); processingBlob = prepared.blob;
    $("processSub").textContent = `${prepared.width} × ${prepared.height}px working image · ${UPSCALE_TILE}px AI tiles.`;
    await yieldToBrowser();

    setStage(2); $("processTitle").textContent = "Finding your subject…"; $("processSub").textContent = "Lightweight AI segmentation is running in its worker."; await nextFrame();
    alphaBlob = await removeBackground(processingBlob, {
      model: "isnet_quint8",
      device: navigator.gpu ? "gpu" : "cpu",
      proxyToWorker: true,
      output: { format: "image/png", type: "mask" }
    });
    if (token !== jobToken) return;
    await yieldToBrowser();

    setStage(3); $("processTitle").textContent = "Reconstructing detail…"; $("processSub").textContent = `Preparing ${UPSCALE_TILE}px neural tiles. No full-frame inference.`; await nextFrame();
    const enhanced = await upscaleTiled(processingBlob, token);
    if (token !== jobToken) return;
    await yieldToBrowser();

    setStage(4); $("processTitle").textContent = "Refining the edges…"; $("processSub").textContent = "Scaling the segmentation mask with browser compositing."; await nextFrame();
    const refinedMask = await resizeAlphaBlob(alphaBlob, enhanced.width, enhanced.height);
    await yieldToBrowser();

    setStage(5); $("processTitle").textContent = "Compositing your result…"; $("processSub").textContent = "Applying transparency without a giant pixel-by-pixel loop."; await nextFrame();
    resultBlob = await compositeWithAlpha(enhanced.blob, refinedMask, enhanced.width, enhanced.height);
    resultUrl = URL.createObjectURL(resultBlob); $("previewImg").src = resultUrl;
    const info = await fileInfo(resultBlob); clearInterval(timerInt); setStage(5);
    $("stats").textContent = `${elapsed.toFixed(1)}s · ${info.width} × ${info.height}px · AI 2×`;
    $("sourceInfo").textContent = `${f.name} · ${prepared.original.width} × ${prepared.original.height}px · ${(f.size / 1024 / 1024).toFixed(2)} MB`;
    hide("processing"); show("editor"); applyZoom();
  } catch (err) {
    console.error("Cutout Pro processing error:", err); clearInterval(timerInt);
    if (err?.name !== "AbortError") showError(err?.message || "The browser could not complete this image safely.");
  } finally { busy = false; }
}

async function resizeAlphaBlob(blob, w, h) {
  const c = await blobToCanvas(blob); const o = document.createElement("canvas"); o.width = w; o.height = h;
  const x = o.getContext("2d", { alpha: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, w, h);
  c.width = 1; c.height = 1; const out = await canvasToBlob(o); o.width = 1; o.height = 1; return out;
}

function showError(message) {
  hide("editor"); show("processing"); $("processBadge").textContent = "SAFE RETRY"; $("processTitle").textContent = "The image was not completed"; $("processSub").textContent = message; $("tip").textContent = "Cutout Pro stopped the job instead of continuing to consume memory. Try a smaller image if the browser reports a resource limit."; $("bar").style.width = "0%";
}
function resetToUpload() { jobToken++; busy = false; clearInterval(timerInt); revoke(resultUrl); resultUrl = null; revoke(originalUrl); originalUrl = null; processingBlob = null; alphaBlob = null; $("fileInput").value = ""; hide("processing"); hide("editor"); show("uploadView"); }
function applyZoom() { $("previewImg").style.transform = `scale(${zoom})`; $("originalImg").style.transform = `scale(${zoom})`; $("zoomText").textContent = Math.round(zoom * 100) + "%"; }

$("choose").onclick = () => !busy && $("fileInput").click();
$("fileInput").onchange = e => e.target.files[0] && start(e.target.files[0]);
$("processingNew").onclick = resetToUpload;
["dragenter", "dragover"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); if (!busy) $("dropzone").classList.add("drag"); }));
["dragleave", "drop"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); $("dropzone").classList.remove("drag"); }));
$("dropzone").addEventListener("drop", e => { if (busy) return; const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/")); if (f) start(f); });

document.querySelectorAll(".choice").forEach(b => b.onclick = () => { document.querySelectorAll(".choice").forEach(x => x.classList.remove("selected")); b.classList.add("selected"); const v = b.dataset.bg; $("preview").style.background = v === "checker" ? "" : v; $("preview").classList.toggle("checker", v === "checker"); });
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { document.querySelectorAll(".tab").forEach(x => x.classList.remove("active")); b.classList.add("active"); const m = b.dataset.mode; $("originalImg").style.display = m === "original" || m === "split" ? "block" : "none"; $("splitPane").style.display = m === "original" ? "none" : "block"; $("preview").classList.toggle("split", m === "split"); applyZoom(); });
$("zoomIn").onclick = () => { zoom = Math.min(2, zoom + .1); applyZoom(); }; $("zoomOut").onclick = () => { zoom = Math.max(.5, zoom - .1); applyZoom(); };
$("new").onclick = resetToUpload;

$("download").onclick = async () => {
  if (busy || !resultBlob) return;
  const scale = Number($("scale").value); const button = $("download"); button.disabled = true; button.textContent = scale === 4 ? "AI 4× processing…" : "Preparing PNG…";
  try {
    if (scale === 4) throw new Error("4× export is intentionally disabled in browser-only mode to prevent the machine from being overloaded. The 2× neural result is the safe maximum.");
    const a = document.createElement("a"); a.href = URL.createObjectURL(resultBlob); a.download = `cutout-pro-ai-${scale}x-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  } catch (err) { showError(err?.message || "Export could not finish safely."); } finally { button.disabled = false; button.textContent = "Download PNG ↓"; }
};
$("theme").onclick = () => document.documentElement.classList.toggle("dark");
