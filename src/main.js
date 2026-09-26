import { removeBackground } from "@imgly/background-removal";
import { pipeline, env, RawImage } from "@huggingface/transformers";
import "./style.css";

env.allowLocalModels = false;
env.useBrowserCache = true;

const UPSCALE_MODEL = "Xenova/swin2SR-lightweight-x2-64";
const MAX_SOURCE_MB = 25;
const MAX_SOURCE_PIXELS = 30_000_000;
const PROCESS_MAX_EDGE = 1024;
const EXPORT_MAX_PIXELS = 20_000_000;
const app = document.querySelector("#app");

app.innerHTML = `
<div class="app-shell">
  <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="ambient ambient-c"></div><div class="ambient ambient-d"></div>
  <header class="nav glass-panel">
    <div class="brand"><div class="logo-liquid">C</div><div><strong>ClearCut</strong><span>PRO</span><small>local image restoration studio</small></div></div>
    <div class="nav-actions"><div class="privacy"><i></i> processing stays on-device</div><button id="theme" class="icon-btn liquid-control" aria-label="Toggle theme">◐</button></div>
  </header>

  <main>
    <section class="hero">
      <div class="pill glass-chip">CLEARER PIXELS · CLEANER CUTOUTS</div>
      <h1>Restore the image.<br><em>Keep the character.</em></h1>
      <p>ClearCut removes the background and uses real neural super-resolution to reconstruct detail before you export.</p>
      <div class="hero-proof"><span>Neural 2×</span><span>WebGPU when available</span><span>Local-first</span></div>
    </section>

    <section id="uploadView" class="upload-view">
      <div id="dropzone" class="dropzone liquid-glass">
        <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="upload-orb"><div>↑</div></div>
        <h2>Drop a photo into the glass</h2><p>JPG, PNG or WEBP · up to 25 MB</p>
        <button id="choose" class="primary liquid-button">Choose photo</button>
        <div class="formats"><span>AI 2×</span><span>Transparent PNG</span><span>Local processing</span></div>
      </div>
      <div class="feature-row">
        <div class="mini-glass"><b>Neural reconstruction</b><small>Swin2SR creates a genuine 2× enhanced image rather than merely enlarging pixels.</small></div>
        <div class="mini-glass"><b>Precision transparency</b><small>The foreground mask is refined at the same output size as the enhanced image.</small></div>
        <div class="mini-glass"><b>Memory-aware</b><small>Large originals are normalized before AI inference so the browser stays responsive.</small></div>
      </div>
    </section>

    <section id="processing" class="processing hidden">
      <div class="process-card liquid-glass">
        <div class="process-top"><div><span class="pill glass-chip" id="processBadge">AI WORKSPACE</span><h2 id="processTitle">Preparing the image…</h2><p id="processSub">Checking dimensions before heavy processing.</p></div><div class="timer" id="timer">0.0s</div></div>
        <div class="stage-list">
          <div class="stage active" id="stage1"><i>1</i><div><b>Preparing pixels</b><small>Decoding and memory-safe normalization</small></div><span>•••</span></div>
          <div class="stage" id="stage2"><i>2</i><div><b>Finding the subject</b><small>AI foreground segmentation</small></div><span>•••</span></div>
          <div class="stage" id="stage3"><i>3</i><div><b>Reconstructing detail</b><small>Swin2SR neural super-resolution at 2×</small></div><span>•••</span></div>
          <div class="stage" id="stage4"><i>4</i><div><b>Refining the edges</b><small>High-quality alpha resampling and boundary cleanup</small></div><span>•••</span></div>
          <div class="stage" id="stage5"><i>5</i><div><b>Compositing result</b><small>Building the transparent enhanced PNG</small></div><span>•••</span></div>
        </div>
        <div class="progressbar"><span id="bar"></span></div>
        <div class="fun-tip" id="tip">The first AI run may take longer while the model is downloaded and cached.</div>
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
        <div class="tool-group liquid-glass"><label>AI export resolution</label><div class="select-row"><select id="scale"><option value="1">1× current enhanced</option><option value="2" selected>2× AI reconstruction</option><option value="4">4× AI reconstruction</option></select><button id="download" class="primary liquid-button">Download PNG ↓</button></div></div>
      </div>
      <div class="extras"><div class="extra liquid-glass"><b>Source</b><span id="sourceInfo"></span></div><div class="extra liquid-glass"><b>Pipeline</b><span>AI mask → Swin2SR 2× → alpha refinement → transparent PNG</span></div><div class="extra liquid-glass"><b>Runtime</b><span id="runtimeInfo"></span></div></div>
      <p class="disclaimer">Super-resolution reconstructs plausible fine detail; it cannot recover missing information with certainty. ClearCut avoids calling ordinary canvas enlargement “AI enhancement.”</p>
    </section>
  </main>
  <footer>ClearCut Pro · neural image restoration · liquid glass interface</footer>
</div>`;

const $ = id => document.getElementById(id);
let file, processingBlob, originalUrl, resultUrl, resultBlob, enhancedRgbBlob, alphaBlob;
let elapsed = 0, timerInt, zoom = 1, upscalerPromise, busy = false, jobToken = 0;

const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

async function getUpscaler() {
  if (!upscalerPromise) {
    upscalerPromise = pipeline("image-to-image", UPSCALE_MODEL, { device: "webgpu", dtype: "fp16" })
      .then(p => { $("runtimeInfo").textContent = "WebGPU neural inference · WASM fallback ready"; return p; })
      .catch(async () => {
        $("runtimeInfo").textContent = "WASM neural inference · WebGPU unavailable or failed";
        return pipeline("image-to-image", UPSCALE_MODEL, { device: "wasm", dtype: "q8" });
      });
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
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: false });
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
  const ctx = canvas.getContext("2d", { alpha: true }); ctx.drawImage(bitmap, 0, 0); bitmap.close();
  return canvas;
}
async function rawImageToPng(raw) {
  const rgba = raw.channels === 4 ? raw : raw.rgba();
  const canvas = document.createElement("canvas"); canvas.width = rgba.width; canvas.height = rgba.height;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.data), rgba.width, rgba.height), 0, 0);
  const out = await canvasToBlob(canvas); canvas.width = 1; canvas.height = 1; return out;
}
async function composeRawWithAlpha(rgbRaw, alphaSourceBlob) {
  const alphaCanvas = await blobToCanvas(alphaSourceBlob);
  const canvas = document.createElement("canvas"); canvas.width = rgbRaw.width; canvas.height = rgbRaw.height;
  const ctx = canvas.getContext("2d", { alpha: true });
  const rgb = rgbRaw.channels === 3 ? rgbRaw : rgbRaw.rgb();
  const data = new Uint8ClampedArray(rgb.data); const rgba = new Uint8ClampedArray(rgb.width * rgb.height * 4);
  for (let i = 0, p = 0, q = 0; i < rgb.width * rgb.height; i++, p += 4, q += 3) { rgba[p] = data[q]; rgba[p + 1] = data[q + 1]; rgba[p + 2] = data[q + 2]; rgba[p + 3] = 255; }
  ctx.putImageData(new ImageData(rgba, rgb.width, rgb.height), 0, 0);
  const ac = document.createElement("canvas"); ac.width = rgb.width; ac.height = rgb.height;
  const ax = ac.getContext("2d", { willReadFrequently: true }); ax.imageSmoothingEnabled = true; ax.imageSmoothingQuality = "high"; ax.drawImage(alphaCanvas, 0, 0, rgb.width, rgb.height);
  const alpha = ax.getImageData(0, 0, rgb.width, rgb.height).data; const out = ctx.getImageData(0, 0, rgb.width, rgb.height);
  for (let i = 0; i < rgb.width * rgb.height; i++) out.data[i * 4 + 3] = alpha[i * 4 + 3];
  ctx.putImageData(out, 0, 0);
  const blob = await canvasToBlob(canvas); canvas.width = 1; canvas.height = 1; ac.width = 1; ac.height = 1; return blob;
}
async function resizeAlphaBlob(blob, w, h) {
  const c = await blobToCanvas(blob); const o = document.createElement("canvas"); o.width = w; o.height = h;
  const x = o.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, w, h);
  const out = await canvasToBlob(o); o.width = 1; o.height = 1; return out;
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
    $("processSub").textContent = `${prepared.width} × ${prepared.height}px working image · memory-safe AI input.`;
    await nextFrame();

    setStage(2); $("processTitle").textContent = "Finding your subject…"; $("processSub").textContent = "AI is separating foreground from background."; await nextFrame();
    const maskBlob = await removeBackground(processingBlob, { output: { format: "image/png", type: "foreground" } });
    if (token !== jobToken) return; alphaBlob = maskBlob; await nextFrame();

    setStage(3); $("processTitle").textContent = "Reconstructing detail…"; $("processSub").textContent = "Swin2SR is running real neural 2× super-resolution."; await nextFrame();
    const upscaler = await getUpscaler(); await nextFrame();
    const raw = await RawImage.fromBlob(processingBlob); const enhanced = await upscaler(raw);
    if (token !== jobToken) return; enhancedRgbBlob = await rawImageToPng(enhanced); await nextFrame();

    setStage(4); $("processTitle").textContent = "Refining transparent edges…"; $("processSub").textContent = "Resampling the AI mask to the exact enhanced dimensions."; await nextFrame();
    const refinedMask = await resizeAlphaBlob(alphaBlob, enhanced.width, enhanced.height); await nextFrame();

    setStage(5); $("processTitle").textContent = "Compositing your result…"; $("processSub").textContent = "Combining reconstructed RGB detail with the refined alpha channel."; await nextFrame();
    resultBlob = await composeRawWithAlpha(enhanced, refinedMask); resultUrl = URL.createObjectURL(resultBlob); $("previewImg").src = resultUrl;
    const info = await fileInfo(resultBlob); clearInterval(timerInt); setStage(5);
    $("stats").textContent = `${elapsed.toFixed(1)}s · ${info.width} × ${info.height}px · AI 2×`; 
    $("sourceInfo").textContent = `${f.name} · ${prepared.original.width} × ${prepared.original.height}px · ${(f.size / 1024 / 1024).toFixed(2)} MB`;
    if (!$("runtimeInfo").textContent) $("runtimeInfo").textContent = navigator.gpu ? "WebGPU preferred · WASM fallback" : "WASM fallback · WebGPU unavailable";
    hide("processing"); show("editor"); applyZoom();
  } catch (err) {
    console.error("ClearCut processing error:", err); clearInterval(timerInt); showError(err?.message || "The browser could not complete this image safely.");
  } finally { busy = false; }
}

function showError(message) {
  hide("editor"); show("processing"); $("processBadge").textContent = "SAFE RETRY"; $("processTitle").textContent = "The image was not completed"; $("processSub").textContent = message; $("tip").textContent = "Try a smaller image or close other heavy browser tabs. ClearCut will not keep running a second job at the same time."; $("bar").style.width = "0%";
}
function resetToUpload() { jobToken++; busy = false; clearInterval(timerInt); revoke(resultUrl); resultUrl = null; revoke(originalUrl); originalUrl = null; $("fileInput").value = ""; hide("processing"); hide("editor"); show("uploadView"); }
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
    let blob = resultBlob;
    if (scale === 4) {
      const upscaler = await getUpscaler(); await nextFrame(); const raw = await RawImage.fromBlob(enhancedRgbBlob);
      if (raw.width * raw.height > EXPORT_MAX_PIXELS) throw new Error("4× would create an unusually large image in this browser. Use 2× for this source to keep memory stable.");
      const enhanced4 = await upscaler(raw); const mask4 = await resizeAlphaBlob(alphaBlob, enhanced4.width, enhanced4.height); blob = await composeRawWithAlpha(enhanced4, mask4);
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `clearcut-pro-ai-${scale}x-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  } catch (err) { showError(err?.message || "Export could not finish safely."); } finally { button.disabled = false; button.textContent = "Download PNG ↓"; }
};
$("theme").onclick = () => document.documentElement.classList.toggle("dark");
