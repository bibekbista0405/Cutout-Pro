import { removeBackground } from "@imgly/background-removal";
import "./style.css";

const MAX_SOURCE_MB = 25;
const MAX_SOURCE_PIXELS = 30_000_000;
// Deliberately conservative: browser ML should never be allowed to consume the machine.
const PROCESS_MAX_EDGE = 768;
const EXPORT_MAX_PIXELS = 8_000_000;
const SAFE_TILE = 256;
const FAST_TILE = 288;
const app = document.querySelector("#app");

app.innerHTML = `
<div class="app-shell">
  <div class="ambient ambient-a"></div><div class="ambient ambient-b"></div><div class="ambient ambient-c"></div><div class="ambient ambient-d"></div>
  <header class="nav glass-panel">
    <div class="brand"><div class="logo-liquid" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><defs><path id="cpPetal" d="M12,12 C8,10 8,4 12,2 C16,4 16,10 12,12 Z"/></defs><use href="#cpPetal" fill="#fff"/><use href="#cpPetal" fill="#fff" opacity=".82" transform="rotate(120 12 12)"/><use href="#cpPetal" fill="#fff" opacity=".64" transform="rotate(240 12 12)"/></svg></div><div><strong>Cutout</strong><span>PRO</span><small>image restoration studio</small></div></div>
    <div class="nav-actions"><div class="privacy"><i></i> local-first processing</div><button id="theme" class="icon-btn liquid-control" aria-label="Toggle theme">◐</button></div>
  </header>

  <main>
    <section class="hero">
      <div class="glass-chip"><b>AI IMAGE LAB</b><span>background · detail · transparency</span></div>
      <h1>Turn ordinary pixels into<br><em>cleaner visual matter.</em></h1>
      <p>Remove the background and reconstruct detail through a calm, visible workflow built around the image itself.</p>
      <div class="hero-proof"><span><i></i> Neural 2×</span><span><i></i> Tile-safe</span><span><i></i> On-device</span></div>
      <div class="hero-showcase" aria-hidden="true">
        <div class="showcase-card showcase-segment"><em>Segment</em></div>
        <div class="showcase-card showcase-detail"><em>Reconstruct</em></div>
        <div class="showcase-card showcase-alpha"><em>Alpha</em></div>
      </div>
    </section>

    <section id="uploadView" class="upload-view">
      <div id="dropzone" class="dropzone liquid-glass">
        <input id="fileInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        <div class="drop-visual"><div class="drop-orbit orbit-one"></div><div class="drop-orbit orbit-two"></div><div class="upload-orb"><span>↑</span></div></div>
        <div class="drop-copy"><span class="eyebrow">START A RESTORATION</span><h2>Place an image in the chamber</h2><p>JPG, PNG or WEBP · up to 25 MB</p></div>
        <button id="choose" class="primary liquid-button">Choose photo <span>↗</span></button>
        <div class="formats"><span>01 · segment</span><span>02 · reconstruct</span><span>03 · preserve alpha</span></div>
      </div>
      <div class="feature-row">
        <div class="mini-glass"><span class="feature-num">01</span><div><b>Subject isolation</b><small>AI foreground segmentation creates the transparency mask.</small></div></div>
        <div class="mini-glass"><span class="feature-num">02</span><div><b>Neural reconstruction</b><small>Swin2SR rebuilds detail in small memory-safe tiles.</small></div></div>
        <div class="mini-glass"><span class="feature-num">03</span><div><b>Clean composite</b><small>Enhanced pixels meet the refined alpha mask at the end.</small></div></div>
      </div>
    </section>

    <section id="processing" class="processing hidden">
      <div class="process-shell">
        <div class="process-head">
          <div><span class="eyebrow">LIVE AI WORKSPACE</span><h2 id="processTitle">Preparing the image…</h2><p id="processSub">Checking dimensions before processing.</p></div>
          <div class="process-meta"><span id="processBadge">STAGE 01</span><strong id="timer">0.0s</strong></div>
        </div>

        <div class="chamber">
          <div class="chamber-grid"></div>
          <div class="scan-line"></div>
          <div class="ring ring-a"></div><div class="ring ring-b"></div><div class="ring ring-c"></div>
          <div class="image-pod glass-panel">
            <div class="pod-label"><span>INPUT MATTER</span><i></i></div>
            <div class="pod-image checker"><img id="processingPreview" alt="Image being processed"></div>
            <div class="pod-footer"><span id="previewState">awaiting analysis</span><span id="previewDimensions">—</span></div>
          </div>
          <div class="process-core"><div class="core-glow"></div><div class="core-mark">C</div></div>
          <div class="signal signal-a"><span>MASK</span><b id="signalMask">pending</b></div>
          <div class="signal signal-b"><span>DETAIL</span><b id="signalDetail">pending</b></div>
          <div class="signal signal-c"><span>ALPHA</span><b id="signalAlpha">pending</b></div>
        </div>

        <div class="stage-dock glass-panel">
          <div class="dock-progress"><span id="bar"></span></div>
          <div class="stage-track">
            <button class="stage active" id="stage1"><i>01</i><span><b>Prepare</b><small>normalize</small></span></button>
            <div class="track-line"></div>
            <button class="stage" id="stage2"><i>02</i><span><b>Isolate</b><small>AI mask</small></span></button>
            <div class="track-line"></div>
            <button class="stage" id="stage3"><i>03</i><span><b>Rebuild</b><small>neural detail</small></span></button>
            <div class="track-line"></div>
            <button class="stage" id="stage4"><i>04</i><span><b>Refine</b><small>edge alpha</small></span></button>
            <div class="track-line"></div>
            <button class="stage" id="stage5"><i>05</i><span><b>Compose</b><small>final PNG</small></span></button>
          </div>
          <div class="stage-caption"><span id="tip">The first AI run downloads and caches the models.</span><span class="safe-pill"><i></i> memory-safe mode</span></div>
        </div>
        <div class="process-actions"><span id="systemLoad">Browser workload: checking…</span><button id="processingNew" class="ghost liquid-control">Cancel & choose another photo</button></div>
      </div>
    </section>

    <section id="editor" class="editor hidden">
      <div class="editor-head"><div><span class="glass-chip"><b>RESTORED</b><span>result ready</span></span><h2>One image. Three ways to inspect it.</h2><p id="stats"></p></div><button id="new" class="ghost liquid-control">＋ New photo</button></div>
      <div class="canvas-card liquid-glass">
        <div class="canvas-head"><div class="tabs"><button class="tab active" data-mode="result">Enhanced</button><button class="tab" data-mode="original">Original</button><button class="tab" data-mode="split">Compare</button></div><div class="zoom"><button id="zoomOut">−</button><span id="zoomText">100%</span><button id="zoomIn">＋</button></div></div>
        <div id="preview" class="preview checker"><div id="splitPane"><img id="previewImg" alt="AI enhanced result"></div><img id="originalImg" class="original-img" alt="Original image"></div>
      </div>
      <div class="result-ribbon liquid-glass"><div class="ribbon-icon">✦</div><div><span class="eyebrow">RESTORATION REPORT</span><strong id="qualityTitle">Swin2SR neural reconstruction · 2×</strong><small id="qualityDetail">Neural reconstruction with transparent alpha compositing.</small></div><div class="quality-badge"><span>✓</span> neural result</div></div>
      <div class="tools">
        <div class="tool-group liquid-glass"><label>PREVIEW SURFACE</label><div class="choices"><button class="choice selected" data-bg="checker">Transparent</button><button class="choice" data-bg="#ffffff">White</button><button class="choice" data-bg="#111827">Dark</button><button class="choice" data-bg="#dbeafe">Blue</button></div></div>
        <div class="tool-group liquid-glass"><label>EXPORT</label><div class="select-row"><select id="scale" aria-label="Export scale"><option value="1">1× current enhanced</option><option value="2" selected>2× current AI result</option></select><select id="format" aria-label="Export format"><option value="png">PNG · transparent</option><option value="webp">WebP · smaller</option></select><button id="download" class="primary liquid-button">Download <span>↓</span></button></div></div>
      </div>
      <div class="extras"><div class="extra liquid-glass"><b>Source</b><span id="sourceInfo"></span></div><div class="extra liquid-glass"><b>Pipeline</b><span>AI mask → tiled Swin2SR → alpha compositing</span></div><div class="extra liquid-glass"><b>Runtime</b><span id="runtimeInfo"></span></div><div class="extra liquid-glass"><b>Safety</b><span id="safetyInfo">Adaptive tile budget · worker watchdogs · cleanup</span></div></div>
      <p class="disclaimer">Super-resolution reconstructs plausible fine detail; it cannot recover missing information with certainty. Cutout Pro uses neural reconstruction rather than ordinary browser enlargement.</p>
    </section>
  </main>
  <footer>Cutout Pro · image restoration studio · built around the pixels</footer>
</div>`

const $ = id => document.getElementById(id);
let file, processingBlob, originalUrl, resultUrl, resultBlob, alphaBlob;
let elapsed = 0, timerInt, zoom = 1, busy = false, jobToken = 0, processingPreviewUrl = null, cancelPending = false;

const yieldToBrowser = () => new Promise(resolve => {
  if (typeof scheduler !== "undefined" && scheduler.postTask) scheduler.postTask(resolve, { priority: "background" });
  else setTimeout(resolve, 0);
});
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

// The neural model runs in a dedicated worker (src/upscale-worker.js) so that
// stage 3 ("Rebuild") never blocks the main thread. Running that inference
// directly on the page's own thread is what previously made the whole tab —
// and on modest machines, the whole browser — feel frozen at stage 3.
let neuralWorker = null;
let workerReqId = 0;
const pendingWorkerReqs = new Map();

function terminateNeuralWorker(reason = "The neural worker was stopped.") {
  const worker = neuralWorker;
  neuralWorker = null;
  if (worker) {
    try { worker.terminate(); } catch {}
  }
  for (const pending of pendingWorkerReqs.values()) pending.reject(new DOMException(reason, "AbortError"));
  pendingWorkerReqs.clear();
}

function getNeuralWorker() {
  if (!neuralWorker) {
    neuralWorker = new Worker(new URL("./upscale-worker.js", import.meta.url), { type: "module" });
    neuralWorker.onmessage = e => {
      const msg = e.data || {};
      if (msg.type === "progress") {
        const d = msg.data;
        if (d?.status === "progress" && d.total) {
          const pct = Math.round((d.loaded / d.total) * 100);
          $("processSub").textContent = `Loading neural model · ${d.file || "weights"} · ${pct}%`;
        } else if (d?.status === "initiate") {
          $("processSub").textContent = `Loading neural model · fetching ${d.file || "files"}…`;
        } else if (d?.status === "download") {
          $("processSub").textContent = `Loading neural model · downloading ${d.file || "weights"}…`;
        }
        return;
      }
      if (msg.type === "log") { console.warn(msg.message); return; }
      const pending = pendingWorkerReqs.get(msg.id);
      if (!pending) return;
      pendingWorkerReqs.delete(msg.id);
      if (msg.type === "error") {
        if (msg.fatal) terminateNeuralWorker(msg.message);
        pending.reject(new Error(msg.message));
      } else pending.resolve(msg);
    };
    neuralWorker.onerror = err => {
      const message = err?.message || "The neural worker crashed.";
      terminateNeuralWorker(message);
    };
  }
  return neuralWorker;
}

function callNeuralWorker(message, transfer) {
  return new Promise((resolve, reject) => {
    const id = ++workerReqId;
    pendingWorkerReqs.set(id, { resolve, reject });
    try { getNeuralWorker().postMessage({ ...message, id }, transfer || []); }
    catch (err) { pendingWorkerReqs.delete(id); reject(err); }
  });
}

// Kick off model loading as soon as a photo is chosen, in parallel with
// stage 2 (subject isolation), so the model is often already warm by the
// time stage 3 starts.
function warmupNeuralWorker() {
  callNeuralWorker({ type: "warmup" }).then(msg => {
    if (msg?.runtime) $("runtimeInfo").textContent = msg.runtime;
  }).catch(() => {});
}

function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }
function setStage(n) {
  for (let i = 1; i <= 5; i++) {
    const el = $("stage" + i);
    el.classList.toggle("active", i === n);
    el.classList.toggle("done", i < n);
  }
  $("processBadge").textContent = `STAGE ${String(n).padStart(2,"0")}`;
  $("bar").style.width = `${Math.min(100, ((n - 1) / 4) * 100 + 6)}%`;
  $("signalMask").textContent = n >= 2 ? (n === 2 ? "analyzing" : "ready") : "pending";
  $("signalDetail").textContent = n >= 3 ? (n === 3 ? "rebuilding" : "ready") : "pending";
  $("signalAlpha").textContent = n >= 4 ? (n === 4 ? "refining" : "locked") : "pending";
  $("previewState").textContent = n === 1 ? "preparing" : n === 2 ? "isolating subject" : n === 3 ? "reconstructing detail" : n === 4 ? "refining edges" : "compositing";
}
function revoke(url) { if (url) URL.revokeObjectURL(url); }
function setProcessingPreview(blobOrUrl) {
  revoke(processingPreviewUrl);
  processingPreviewUrl = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  $("processingPreview").src = processingPreviewUrl;
}

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

function chooseTileSize() {
  const memory = Number(navigator.deviceMemory || 4);
  const cores = Number(navigator.hardwareConcurrency || 4);
  // Keep the conservative tile on unknown/low-memory devices. A modest bump
  // reduces tile count on capable machines without allowing giant tensors.
  return memory >= 8 && cores >= 8 ? FAST_TILE : SAFE_TILE;
}

async function upscaleTiled(sourceBlob, token) {
  const sourceCanvas = await blobToCanvas(sourceBlob);
  const srcCtx = sourceCanvas.getContext("2d", { alpha: true });
  const width = sourceCanvas.width, height = sourceCanvas.height;
  const tileSize = chooseTileSize();
  const output = document.createElement("canvas"); output.width = width * 2; output.height = height * 2;
  const out = output.getContext("2d", { alpha: false });

  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);
  const total = tilesX * tilesY;
  let done = 0;

  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      if (token !== jobToken) throw new DOMException("Cancelled", "AbortError");
      const w = Math.min(tileSize, width - x);
      const h = Math.min(tileSize, height - y);
      const tileData = srcCtx.getImageData(x, y, w, h);
      const buffer = tileData.data.buffer;
      // The actual neural inference happens in upscale-worker.js, off this
      // thread, so the page stays responsive while a tile is processing.
      const result = await callNeuralWorker({ type: "tile", width: w, height: h, channels: 4, data: buffer }, [buffer]);
      if (token !== jobToken) throw new DOMException("Cancelled", "AbortError");
      const resultBytes = new Uint8ClampedArray(result.data);
      out.putImageData(new ImageData(resultBytes, result.width, result.height), x * 2, y * 2);
      if (result.runtime) $("runtimeInfo").textContent = result.runtime;
      done++;
      $("processSub").textContent = `Neural tile ${done} of ${total} · ${Math.round(done / total * 100)}% · ${tileSize}px workload · worker isolated.`;
      $("bar").style.width = `${35 + Math.round((done / total) * 32)}%`;
      await yieldToBrowser();
    }
  }

  sourceCanvas.width = 1; sourceCanvas.height = 1;
  const blob = await canvasToBlob(output);
  output.width = 1; output.height = 1;
  return { blob, width: width * 2, height: height * 2, tileSize, totalTiles: total };
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
  busy = true; cancelPending = false; const token = ++jobToken; file = f; elapsed = 0; zoom = 1;
  revoke(originalUrl); revoke(resultUrl); originalUrl = URL.createObjectURL(f); $("originalImg").src = originalUrl;
  hide("uploadView"); hide("editor"); show("processing"); setStage(1); $("bar").style.width = "6%"; setProcessingPreview(originalUrl); $("previewDimensions").textContent = "loading…";
  $("processBadge").textContent = "AI WORKSPACE"; $("processTitle").textContent = "Preparing the image…"; $("processSub").textContent = "Checking dimensions before heavy processing.";
  $("processingNew").disabled = false;
  $("choose").disabled = false;
  const memory = navigator.deviceMemory ? `${navigator.deviceMemory} GB hint` : "memory hint unavailable";
  const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} CPU threads` : "CPU count unavailable";
  $("systemLoad").textContent = `Browser workload: ${memory} · ${cores}`;
  $("safetyInfo").textContent = `Adaptive ${chooseTileSize()}px tiles · worker watchdogs · cancellable cleanup`;
  timerInt = setInterval(() => { elapsed += .1; $("timer").textContent = elapsed.toFixed(1) + "s"; }, 100);
  warmupNeuralWorker(); // start loading the model now, in parallel with stages 1-2
  try {
    await nextFrame();
    const prepared = await normalizeForProcessing(f); processingBlob = prepared.blob;
    $("previewDimensions").textContent = `${prepared.width} × ${prepared.height}`;
    $("processSub").textContent = `${prepared.width} × ${prepared.height}px working image · adaptive ${chooseTileSize()}px AI tiles.`;
    await yieldToBrowser();

    setStage(2); $("processTitle").textContent = "Finding your subject…"; $("processSub").textContent = "Lightweight AI segmentation is running in its worker."; await nextFrame();
    alphaBlob = await removeBackground(processingBlob, {
      model: "isnet_quint8",
      device: navigator.gpu ? "gpu" : "cpu",
      proxyToWorker: true,
      output: { format: "image/png", type: "mask" }
    });
    if (token !== jobToken) return;
    $("previewState").textContent = "subject isolated · mask ready";
    setProcessingPreview(alphaBlob);
    $("processingPreview").classList.add("mask-preview");
    await yieldToBrowser();

    setStage(3); $("processTitle").textContent = "Reconstructing detail…"; $("processSub").textContent = `Preparing adaptive neural tiles. No full-frame inference.`; await nextFrame();
    const enhanced = await upscaleTiled(processingBlob, token);
    if (token !== jobToken) return;
    $("processingPreview").classList.remove("mask-preview");
    setProcessingPreview(enhanced.blob);
    $("previewDimensions").textContent = `${enhanced.width} × ${enhanced.height}`;
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
  } finally {
    if (token === jobToken) {
      busy = false;
      cancelPending = false;
      $("choose").disabled = false;
      $("choose").innerHTML = 'Choose photo <span>↗</span>';
    } else {
      busy = false;
      $("choose").disabled = false;
      $("choose").innerHTML = 'Choose photo <span>↗</span>';
    }
  }
}

async function resizeAlphaBlob(blob, w, h) {
  const c = await blobToCanvas(blob); const o = document.createElement("canvas"); o.width = w; o.height = h;
  const x = o.getContext("2d", { alpha: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, w, h);
  c.width = 1; c.height = 1; const out = await canvasToBlob(o); o.width = 1; o.height = 1; return out;
}

function showError(message) {
  hide("editor"); show("processing"); $("processBadge").textContent = "SAFE RETRY"; $("processTitle").textContent = "The image was not completed"; $("processSub").textContent = message; $("tip").textContent = "Cutout Pro stopped the job instead of continuing to consume memory. Try a smaller image if the browser reports a resource limit."; $("bar").style.width = "0%";
}
function resetToUpload() {
  jobToken++;
  cancelPending = true;
  busy = true;
  clearInterval(timerInt);
  terminateNeuralWorker("Processing was cancelled.");
  revoke(resultUrl); resultUrl = null;
  revoke(originalUrl); originalUrl = null;
  revoke(processingPreviewUrl); processingPreviewUrl = null;
  $("choose").disabled = true;
  $("choose").textContent = "Finishing cancellation…";
  processingBlob = null; alphaBlob = null; resultBlob = null;
  $("fileInput").value = "";
  $("processingPreview").removeAttribute("src");
  hide("processing"); hide("editor"); show("uploadView");
}
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
  const scale = Number($("scale").value);
  const format = $("format").value;
  const button = $("download");
  button.disabled = true;
  button.textContent = "Preparing…";
  try {
    const source = await createImageBitmap(resultBlob);
    const pixels = source.width * source.height;
    if (pixels > EXPORT_MAX_PIXELS) throw new Error("This export would exceed the browser safety pixel budget.");
    const mime = format === "webp" ? "image/webp" : "image/png";
    const ext = format === "webp" ? "webp" : "png";
    const c = document.createElement("canvas"); c.width = source.width; c.height = source.height;
    const ctx = c.getContext("2d", { alpha: true });
    ctx.drawImage(source, 0, 0); source.close();
    const blob = await canvasToBlob(c, mime, format === "webp" ? .94 : undefined);
    c.width = 1; c.height = 1;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cutout-pro-ai-${scale}x-${Date.now()}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (err) { showError(err?.message || "Export could not finish safely."); }
  finally { button.disabled = false; button.textContent = "Download ↓"; }
};
$("theme").onclick = () => {
  const dark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("cutout-pro-theme", dark ? "dark" : "light");
};
if (localStorage.getItem("cutout-pro-theme") === "dark") document.documentElement.classList.add("dark");
window.addEventListener("pagehide", () => {
  clearInterval(timerInt);
  terminateNeuralWorker("Page closed.");
  revoke(originalUrl); revoke(resultUrl); revoke(processingPreviewUrl);
});
