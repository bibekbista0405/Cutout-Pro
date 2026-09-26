import { removeBackground } from "@imgly/background-removal";
import "./style.css";

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
        <div class="drop-copy"><span class="eyebrow">START A RESTORATION</span><h2>Place an image in the chamber</h2><p>JPG, PNG or WEBP · up to 25 MB</p><div class="tool-picker" role="tablist" aria-label="Choose processing tool"><button class="tool-choice active" data-tool="remove" type="button"><span>✦</span><b>Remove background</b><small>clean transparent cutout</small></button><button class="tool-choice" data-tool="enhance" type="button"><span>↗</span><b>Enhance image</b><small>reconstruct fine detail</small></button><button class="tool-choice" data-tool="both" type="button"><span>◈</span><b>Remove + enhance</b><small>full restoration</small></button></div></div>
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
          <div><span class="eyebrow" id="processEyebrow">LIVE AI WORKSPACE</span><h2 id="processTitle">Preparing the image…</h2><p id="processSub">Checking dimensions before processing.</p></div>
          <div class="process-meta"><span id="processBadge">STAGE 01</span><strong id="timer">0.0s</strong></div>
        </div>

        <div class="chamber">
          <div class="chamber-grid"></div>
          <div class="scan-line"></div>
          <div class="ring ring-a"></div><div class="ring ring-b"></div><div class="ring ring-c"></div>
          <div class="image-pod glass-panel">
            <div class="pod-label"><span>INPUT MATTER</span><i></i></div>
            <div class="pod-image checker" id="processingPod"><img id="processingPreview" alt="Image being processed"><div id="cutoutReveal" class="cutout-reveal" aria-hidden="true"></div><span id="cutoutLabel" class="cutout-label">AI CUTOUT · LIVE</span></div>
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
        <button id="processingNew" class="ghost liquid-control">← Choose a different photo</button>
      </div>
    </section>

    <section id="editor" class="editor hidden">
      <div class="editor-head"><div><span class="glass-chip"><b>RESTORED</b><span>result ready</span></span><h2>One image. Three ways to inspect it.</h2><p id="stats"></p></div><button id="new" class="ghost liquid-control">＋ New photo</button></div>
      <div class="canvas-card liquid-glass">
        <div class="canvas-head"><div class="tabs"><button class="tab active" data-mode="result">Enhanced</button><button class="tab" data-mode="original">Original</button><button class="tab" data-mode="split">Compare</button></div><div class="zoom"><button id="zoomOut">−</button><span id="zoomText">100%</span><button id="zoomIn">＋</button></div></div>
        <div id="preview" class="preview checker"><div id="splitPane"><img id="previewImg" alt="AI enhanced result"></div><img id="originalImg" class="original-img" alt="Original image"></div>
      </div>
      <div class="result-ribbon liquid-glass"><div class="ribbon-icon">✦</div><div><span class="eyebrow">RESTORATION REPORT</span><strong id="qualityTitle">Swin2SR neural reconstruction · 2×</strong><small id="qualityDetail">Neural reconstruction with transparent alpha compositing.</small></div><div id="qualityBadge" class="quality-badge"><span>✓</span> neural result</div></div>
      <div class="tools">
        <div class="tool-group liquid-glass"><label>PREVIEW SURFACE</label><div class="choices"><button class="choice selected" data-bg="checker">Transparent</button><button class="choice" data-bg="#ffffff">White</button><button class="choice" data-bg="#111827">Dark</button><button class="choice" data-bg="#dbeafe">Blue</button></div></div>
        <div class="tool-group liquid-glass"><label>EXPORT</label><div class="select-row"><select id="scale"><option value="1">1× current enhanced</option><option value="2" selected>2× current AI result</option></select><button id="download" class="primary liquid-button">Preview export <span>↗</span></button></div></div>
      </div>
      <div class="mask-editor liquid-glass">
        <div class="mask-head"><div><span class="eyebrow">CUTOUT EDITOR</span><h3>Refine the AI mask</h3><p>Paint corrections directly on the transparency mask. Your original AI result stays untouched until you apply.</p></div><div class="mask-status"><span class="mask-dot"></span><b id="maskStatus">AI mask ready</b></div></div>
        <div class="mask-layout"><div class="mask-canvas-wrap checker" id="maskCanvasWrap"><canvas id="maskCanvas" aria-label="Editable cutout mask"></canvas><div id="maskCursor" class="mask-cursor" hidden></div></div><div class="mask-controls"><div class="mask-tools"><button class="mask-tool active" data-mask-tool="remove"><b>−</b><span>Remove</span><small>erase subject</small></button><button class="mask-tool" data-mask-tool="keep"><b>+</b><span>Keep</span><small>restore subject</small></button><button class="mask-tool" data-mask-tool="mask"><b>◐</b><span>Mask</span><small>inspect AI mask</small></button></div><label class="range-label"><span>Brush size</span><output id="brushSizeValue">36 px</output></label><input id="brushSize" type="range" min="8" max="120" value="36"><label class="range-label"><span>Edge softness</span><output id="edgeSoftnessValue">20%</output></label><input id="edgeSoftness" type="range" min="0" max="100" value="20"><div class="mask-actions"><button id="maskReset" class="ghost liquid-control">Reset mask</button><button id="maskApply" class="primary liquid-button">Apply correction <span>✓</span></button></div><div class="mask-hint"><span>Tip</span> Paint over hair, product edges, or small background fragments.</div></div></div>
      </div>
      <div class="extras"><div class="extra liquid-glass"><b>Source</b><span id="sourceInfo"></span></div><div class="extra liquid-glass"><b>Pipeline</b><span>AI mask → tiled Swin2SR → alpha compositing</span></div><div class="extra liquid-glass"><b>Runtime</b><span id="runtimeInfo"></span></div></div>
      <p class="disclaimer">Super-resolution reconstructs plausible fine detail; it cannot recover missing information with certainty. Cutout Pro uses neural reconstruction rather than ordinary browser enlargement.</p>
    </section>
  </main>
  <div id="exportPreview" class="export-preview hidden" role="dialog" aria-modal="true" aria-label="Export preview"><div class="export-backdrop"></div><div class="export-dialog liquid-glass"><div class="export-head"><div><span class="eyebrow">EXPORT PREVIEW</span><h2>See it before it leaves.</h2><p>Inspect transparency, scale and output quality before downloading.</p></div><button id="exportClose" class="icon-btn liquid-control" aria-label="Close export preview">×</button></div><div class="export-stage checker"><img id="exportImage" alt="Final export preview"></div><div class="export-meta"><div><b id="exportDimensions">—</b><span>output size</span></div><div><b id="exportFormat">PNG</b><span>format</span></div><div><b id="exportTransparency">Alpha</b><span>transparency</span></div></div><div class="export-actions"><button id="exportCancel" class="ghost liquid-control">Keep editing</button><button id="exportConfirm" class="primary liquid-button">Download <span>↓</span></button></div></div></div>
  <footer>Cutout Pro · image restoration studio · built around the pixels</footer>
</div>`

const $ = id => document.getElementById(id);
let file, processingBlob, originalUrl, resultUrl, resultBlob, alphaBlob;
let elapsed = 0, timerInt, zoom = 1, busy = false, jobToken = 0, activeTool = "remove", exportFormat = "png";
let maskCanvas, maskCtx, maskLayerCanvas, maskLayerCtx, enhancedSourceBlob, maskOriginalBlob, maskPainting = false, maskTool = "remove";

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
      if (msg.type === "error") pending.reject(new Error(msg.message));
      else pending.resolve(msg);
    };
    neuralWorker.onerror = err => {
      for (const pending of pendingWorkerReqs.values()) pending.reject(new Error(err?.message || "The neural worker crashed."));
      pendingWorkerReqs.clear();
      neuralWorker = null;
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
  callNeuralWorker({ type: "warmup" }).catch(() => {});
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

async function upscaleTiled(sourceBlob, token) {
  const sourceCanvas = await blobToCanvas(sourceBlob);
  const srcCtx = sourceCanvas.getContext("2d", { alpha: true });
  const width = sourceCanvas.width, height = sourceCanvas.height;
  const output = document.createElement("canvas"); output.width = width * 2; output.height = height * 2;
  const out = output.getContext("2d", { alpha: false });

  const tilesX = Math.ceil(width / UPSCALE_TILE);
  const tilesY = Math.ceil(height / UPSCALE_TILE);
  const total = tilesX * tilesY;
  let done = 0;

  for (let y = 0; y < height; y += UPSCALE_TILE) {
    for (let x = 0; x < width; x += UPSCALE_TILE) {
      if (token !== jobToken) throw new DOMException("Cancelled", "AbortError");
      const w = Math.min(UPSCALE_TILE, width - x);
      const h = Math.min(UPSCALE_TILE, height - y);
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
      $("processSub").textContent = `Neural tile ${done} of ${total} · ${Math.round(done / total * 100)}% · running off the main thread.`;
      $("bar").style.width = `${35 + Math.round((done / total) * 32)}%`;
      await yieldToBrowser();
    }
  }

  sourceCanvas.width = 1; sourceCanvas.height = 1;
  const blob = await canvasToBlob(output);
  output.width = 1; output.height = 1;
  return { blob, width: width * 2, height: height * 2 };
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

async function setupMaskEditor(enhancedBlob, refinedMask) {
  enhancedSourceBlob = enhancedBlob; maskOriginalBlob = refinedMask;
  const img = await createImageBitmap(enhancedBlob); const mask = await createImageBitmap(refinedMask);
  maskCanvas = $("maskCanvas"); maskCanvas.width = img.width; maskCanvas.height = img.height;
  maskCtx = maskCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
  maskLayerCanvas = document.createElement("canvas"); maskLayerCanvas.width = img.width; maskLayerCanvas.height = img.height;
  maskLayerCtx = maskLayerCanvas.getContext("2d", { alpha: true, willReadFrequently: true });
  maskLayerCtx.clearRect(0,0,img.width,img.height); maskLayerCtx.drawImage(mask,0,0,img.width,img.height);
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height); maskCtx.drawImage(img,0,0); maskCtx.globalCompositeOperation="destination-in"; maskCtx.drawImage(maskLayerCanvas,0,0); maskCtx.globalCompositeOperation="source-over";
  img.close(); mask.close(); $("maskStatus").textContent="AI mask ready · edit mode";
}
async function renderMaskPreview() {
  if (!maskCanvas || !maskLayerCanvas || !enhancedSourceBlob) return;
  const img = await createImageBitmap(enhancedSourceBlob);
  maskCtx.clearRect(0,0,maskCanvas.width,maskCanvas.height);
  if (maskTool === "mask") { maskCtx.fillStyle="#fff"; maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height); maskCtx.globalCompositeOperation="destination-in"; maskCtx.drawImage(maskLayerCanvas,0,0); }
  else { maskCtx.drawImage(img,0,0,maskCanvas.width,maskCanvas.height); maskCtx.globalCompositeOperation="destination-in"; maskCtx.drawImage(maskLayerCanvas,0,0); }
  maskCtx.globalCompositeOperation="source-over"; img.close();
}
function maskPoint(e) { const r=maskCanvas.getBoundingClientRect(); return {x:Math.max(0,Math.min(maskCanvas.width,(e.clientX-r.left)*maskCanvas.width/r.width)), y:Math.max(0,Math.min(maskCanvas.height,(e.clientY-r.top)*maskCanvas.height/r.height))}; }
function paintMask(e) {
  if (!maskCanvas || !maskLayerCtx || !maskPainting || maskTool === "mask") return; const p=maskPoint(e); const scale=maskCanvas.width/maskCanvas.getBoundingClientRect().width; const radius=Number($("brushSize").value)*scale/2; const softness=Number($("edgeSoftness").value)/100;
  const g=maskLayerCtx.createRadialGradient(p.x,p.y,radius*Math.max(.05,softness),p.x,p.y,radius); const keep=maskTool==="keep"; g.addColorStop(0,keep?"rgba(255,255,255,1)":"rgba(0,0,0,1)"); g.addColorStop(1,keep?"rgba(255,255,255,0)":"rgba(0,0,0,0)");
  maskLayerCtx.save(); maskLayerCtx.globalCompositeOperation=keep?"source-over":"destination-out"; maskLayerCtx.fillStyle=g; maskLayerCtx.beginPath(); maskLayerCtx.arc(p.x,p.y,radius,0,Math.PI*2); maskLayerCtx.fill(); maskLayerCtx.restore();
  renderMaskPreview(); $("maskStatus").textContent=keep?"Manual keep stroke":"Manual remove stroke";
}
async function applyMaskCorrection() {
  if (!maskCanvas || !enhancedSourceBlob || maskTool === "mask") return; const source=await createImageBitmap(enhancedSourceBlob); const c=document.createElement("canvas"); c.width=maskCanvas.width; c.height=maskCanvas.height; const ctx=c.getContext("2d",{alpha:true}); ctx.drawImage(source,0,0);
  const edited=maskLayerCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height), src=ctx.getImageData(0,0,c.width,c.height); for(let i=0;i<edited.data.length;i+=4) src.data[i+3]=edited.data[i+3]; ctx.putImageData(src,0,0); resultBlob=await canvasToBlob(c); revoke(resultUrl); resultUrl=URL.createObjectURL(resultBlob); $("previewImg").src=resultUrl; source.close(); c.width=1;c.height=1; $("maskStatus").textContent="Correction applied · result updated"; $("qualityDetail").textContent="AI segmentation with manual mask correction and transparent compositing."; $("qualityBadge").innerHTML="<span>✓</span> edited mask";
}
async function resetMaskEditor() { if(!enhancedSourceBlob||!maskOriginalBlob)return; await setupMaskEditor(enhancedSourceBlob,maskOriginalBlob); await renderMaskPreview(); $("maskStatus").textContent="AI mask restored"; }

function setTool(tool){ activeTool=tool; document.querySelectorAll(".tool-choice").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool)); const labels={remove:["REMOVE BACKGROUND","Pure subject isolation","The AI is building a clean alpha matte — no enhancement pass."],enhance:["ENHANCE IMAGE","Detail reconstruction","The AI is rebuilding fine detail while preserving the original scene."],both:["FULL RESTORATION","Remove + enhance","Subject isolation followed by memory-safe neural reconstruction."]}; const x=labels[tool]; $("processEyebrow").textContent=x[0]; $("processTitle").textContent=x[1]; $("processSub").textContent=x[2]; document.body.dataset.tool=tool; $("processing").dataset.tool=tool; if(tool==="remove"){ $("stage3").querySelector("b").textContent="Reveal"; $("stage3").querySelector("small").textContent="live cutout"; $("stage4").querySelector("b").textContent="Polish"; $("stage4").querySelector("small").textContent="edge alpha"; } else { $("stage3").querySelector("b").textContent="Rebuild"; $("stage3").querySelector("small").textContent="neural detail"; $("stage4").querySelector("b").textContent="Refine"; $("stage4").querySelector("small").textContent="edge alpha"; } }

function chooseRemovalModel(){ if(navigator.gpu) return "isnet_fp16"; return "isnet_quint8"; }

async function start(f) {
  if (busy) return;
  if (!f.type.startsWith("image/")) return;
  if (f.size > MAX_SOURCE_MB * 1024 * 1024) { showError("That file is larger than 25 MB. Choose a smaller image to keep browser memory stable."); return; }
  busy = true; const token = ++jobToken; file = f; elapsed = 0; zoom = 1;
  revoke(originalUrl); revoke(resultUrl); originalUrl = URL.createObjectURL(f); $("originalImg").src = originalUrl;
  hide("uploadView"); hide("editor"); show("processing"); setTool(activeTool); setStage(1); $("cutoutReveal").style.width="0%"; $("cutoutReveal").classList.remove("active"); $("cutoutLabel").textContent=activeTool==="remove" ? "AI CUTOUT · LIVE" : "AI PROCESS · LIVE"; $("bar").style.width = "6%"; $("processingPreview").src = originalUrl; $("previewDimensions").textContent = "loading…";
  $("processBadge").textContent = "AI WORKSPACE"; $("processTitle").textContent = "Preparing the image…"; $("processSub").textContent = "Checking dimensions before heavy processing.";
  $("processingNew").disabled = false;
  timerInt = setInterval(() => { elapsed += .1; $("timer").textContent = elapsed.toFixed(1) + "s"; }, 100);
  if (activeTool !== "remove") warmupNeuralWorker(); // only load reconstruction when the selected tool needs it
  try {
    await nextFrame();
    const prepared = await normalizeForProcessing(f); processingBlob = prepared.blob;
    $("previewDimensions").textContent = `${prepared.width} × ${prepared.height}`;
    $("processSub").textContent = `${prepared.width} × ${prepared.height}px working image · ${UPSCALE_TILE}px AI tiles.`;
    await yieldToBrowser();

    setStage(2); $("processTitle").textContent = activeTool === "enhance" ? "Preparing detail reconstruction…" : "Mapping your subject…"; $("processSub").textContent = activeTool === "remove" ? "High-quality foreground segmentation is building the transparency matte." : "Building a clean subject matte before the next stage."; await nextFrame();
    if (activeTool !== "enhance") {
      const removalModel = chooseRemovalModel();
      $("signalMask").textContent = navigator.gpu ? "precision GPU" : "safe CPU";
      alphaBlob = await removeBackground(processingBlob, {
        model: removalModel,
        device: navigator.gpu ? "gpu" : "cpu",
        proxyToWorker: true,
        output: { format: "image/png", type: "mask" },
        progress: (key,current,total) => { if(key.includes("inference")) { const pct=Math.round((current/Math.max(total,1))*100); $("signalMask").textContent = `AI ${pct}%`; } }
      });
      if (token !== jobToken) return;
      $("previewState").textContent = "AI matte generated · revealing cutout";
      if (activeTool === "remove") {
        const liveCutout = await compositeWithAlpha(processingBlob, alphaBlob, prepared.width, prepared.height);
        const liveUrl = URL.createObjectURL(liveCutout);
        $("processingPreview").src = liveUrl;
        $("processingPreview").classList.remove("mask-preview");
        await nextFrame();
        $("cutoutReveal").classList.add("active");
        $("cutoutReveal").style.width = "100%";
        await new Promise(r=>setTimeout(r,720));
        URL.revokeObjectURL(liveUrl);
      } else {
        const maskUrl = URL.createObjectURL(alphaBlob);
        $("processingPreview").src = maskUrl;
        $("processingPreview").classList.add("mask-preview");
        await nextFrame();
        $("cutoutReveal").classList.add("active");
        $("cutoutReveal").style.width = "100%";
        await new Promise(r=>setTimeout(r,720));
        URL.revokeObjectURL(maskUrl);
        $("processingPreview").classList.remove("mask-preview");
        $("processingPreview").src = originalUrl;
      }
    }
    await yieldToBrowser();

    let enhanced;
    if (activeTool === "remove") {
      enhanced = { blob: processingBlob, width: prepared.width, height: prepared.height };
      $("signalDetail").textContent = "skipped";
    } else {
      setStage(3); $("processTitle").textContent = "Reconstructing detail…"; $("processSub").textContent = `Preparing ${UPSCALE_TILE}px neural tiles. No full-frame inference.`; await nextFrame();
      enhanced = await upscaleTiled(processingBlob, token);
    }
    if (activeTool === "enhance") alphaBlob = await createOpaqueMask(enhanced.width, enhanced.height);
    if (token !== jobToken) return;
    $("processingPreview").classList.remove("mask-preview");
    const enhancedUrl = URL.createObjectURL(enhanced.blob);
    $("processingPreview").src = enhancedUrl;
    $("previewDimensions").textContent = `${enhanced.width} × ${enhanced.height}`;
    await yieldToBrowser();

    setStage(activeTool === "remove" ? 4 : 4); $("processTitle").textContent = "Refining the cutout edge…"; $("processSub").textContent = "Cleaning the matte and preserving soft subject boundaries."; await nextFrame();
    const refinedMask = await refineAlphaMask(await resizeAlphaBlob(alphaBlob, enhanced.width, enhanced.height));
    await setupMaskEditor(enhanced.blob, refinedMask);
    await yieldToBrowser();

    setStage(5); $("processTitle").textContent = activeTool === "remove" ? "The background is gone." : "Compositing your result…"; $("processSub").textContent = activeTool === "remove" ? "Your original pixels are preserved; only the background alpha has changed." : "Applying transparency without a giant pixel-by-pixel loop."; await nextFrame();
    resultBlob = await compositeWithAlpha(enhanced.blob, refinedMask, enhanced.width, enhanced.height);
    resultUrl = URL.createObjectURL(resultBlob); $("previewImg").src = resultUrl;
    const info = await fileInfo(resultBlob); clearInterval(timerInt); setStage(5);
    $("stats").textContent = `${elapsed.toFixed(1)}s · ${info.width} × ${info.height}px · ${activeTool === "remove" ? "AI cutout" : "AI 2×"}`;
    $("qualityTitle").textContent = activeTool === "remove" ? "Precision AI background removal" : "Swin2SR neural reconstruction · 2×";
    $("qualityDetail").textContent = activeTool === "remove" ? `Foreground matte generated with ${chooseRemovalModel()} and refined alpha compositing.` : "Neural reconstruction with transparent alpha compositing.";
    $("qualityBadge").innerHTML = activeTool === "remove" ? "<span>✓</span> cutout ready" : "<span>✓</span> neural result";
    $("sourceInfo").textContent = `${f.name} · ${prepared.original.width} × ${prepared.original.height}px · ${(f.size / 1024 / 1024).toFixed(2)} MB`;
    hide("processing"); show("editor"); applyZoom();
  } catch (err) {
    console.error("Cutout Pro processing error:", err); clearInterval(timerInt);
    if (err?.name !== "AbortError") showError(err?.message || "The browser could not complete this image safely.");
  } finally { busy = false; }
}

async function createOpaqueMask(w,h){ const c=document.createElement("canvas"); c.width=w;c.height=h; const x=c.getContext("2d"); x.fillStyle="#fff";x.fillRect(0,0,w,h); const out=await canvasToBlob(c); c.width=1;c.height=1; return out; }

async function refineAlphaMask(blob){ const c=await blobToCanvas(blob); const o=document.createElement("canvas"); o.width=c.width; o.height=c.height; const x=o.getContext("2d",{willReadFrequently:true}); x.filter="blur(.45px)"; x.drawImage(c,0,0); x.filter="none"; const d=x.getImageData(0,0,o.width,o.height); for(let i=0;i<d.data.length;i+=4){ const a=d.data[i]; d.data[i]=255; d.data[i+1]=255; d.data[i+2]=255; d.data[i+3]=a<6?0:a>249?255:a; } x.putImageData(d,0,0); c.width=1;c.height=1; const out=await canvasToBlob(o); o.width=1;o.height=1; return out; }

async function resizeAlphaBlob(blob, w, h) {
  const c = await blobToCanvas(blob); const o = document.createElement("canvas"); o.width = w; o.height = h;
  const x = o.getContext("2d", { alpha: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, w, h);
  c.width = 1; c.height = 1; const out = await canvasToBlob(o); o.width = 1; o.height = 1; return out;
}

function showError(message) {
  hide("editor"); show("processing"); $("processBadge").textContent = "SAFE RETRY"; $("processTitle").textContent = "The image was not completed"; $("processSub").textContent = message; $("tip").textContent = "Cutout Pro stopped the job instead of continuing to consume memory. Try a smaller image if the browser reports a resource limit."; $("bar").style.width = "0%";
}
function resetToUpload() { jobToken++; busy = false; clearInterval(timerInt); revoke(resultUrl); resultUrl = null; revoke(originalUrl); originalUrl = null; processingBlob = null; alphaBlob = null; enhancedSourceBlob = null; maskOriginalBlob = null; maskCanvas = null; maskCtx = null; maskLayerCanvas = null; maskLayerCtx = null; $("fileInput").value = ""; hide("processing"); hide("editor"); show("uploadView"); }
function applyZoom() { $("previewImg").style.transform = `scale(${zoom})`; $("originalImg").style.transform = `scale(${zoom})`; $("zoomText").textContent = Math.round(zoom * 100) + "%"; }

$("choose").onclick = () => !busy && $("fileInput").click(); document.querySelectorAll(".tool-choice").forEach(b=>b.onclick=()=>setTool(b.dataset.tool)); setTool("remove");
$("fileInput").onchange = e => e.target.files[0] && start(e.target.files[0]);
$("processingNew").onclick = resetToUpload;
["dragenter", "dragover"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); if (!busy) $("dropzone").classList.add("drag"); }));
["dragleave", "drop"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); $("dropzone").classList.remove("drag"); }));
$("dropzone").addEventListener("drop", e => { if (busy) return; const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/")); if (f) start(f); });

document.querySelectorAll(".choice").forEach(b => b.onclick = () => { document.querySelectorAll(".choice").forEach(x => x.classList.remove("selected")); b.classList.add("selected"); const v = b.dataset.bg; $("preview").style.background = v === "checker" ? "" : v; $("preview").classList.toggle("checker", v === "checker"); });
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { document.querySelectorAll(".tab").forEach(x => x.classList.remove("active")); b.classList.add("active"); const m = b.dataset.mode; $("originalImg").style.display = m === "original" || m === "split" ? "block" : "none"; $("splitPane").style.display = m === "original" ? "none" : "block"; $("preview").classList.toggle("split", m === "split"); applyZoom(); });
$("zoomIn").onclick = () => { zoom = Math.min(2, zoom + .1); applyZoom(); }; $("zoomOut").onclick = () => { zoom = Math.max(.5, zoom - .1); applyZoom(); };
$("new").onclick = resetToUpload;

async function openExportPreview(){ if(!resultBlob)return; const url=URL.createObjectURL(resultBlob); $("exportImage").src=url; const info=await fileInfo(resultBlob); $("exportDimensions").textContent=`${info.width} × ${info.height}px`; $("exportFormat").textContent="PNG"; $("exportTransparency").textContent="Alpha ready"; $("exportPreview").classList.remove("hidden"); $("exportPreview").dataset.url=url; }
async function confirmExport(){ if(!resultBlob)return; const a=document.createElement("a"); a.href=URL.createObjectURL(resultBlob); a.download=`cutout-pro-${activeTool}-${Date.now()}.png`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); closeExportPreview(); }
function closeExportPreview(){ const u=$("exportPreview").dataset.url; if(u)URL.revokeObjectURL(u); $("exportPreview").dataset.url=""; $("exportImage").src=""; $("exportPreview").classList.add("hidden"); }
$("download").onclick = openExportPreview; $("exportConfirm").onclick=confirmExport; $("exportClose").onclick=closeExportPreview; $("exportCancel").onclick=closeExportPreview;

document.querySelectorAll(".mask-tool").forEach(b=>b.onclick=async()=>{ document.querySelectorAll(".mask-tool").forEach(x=>x.classList.remove("active")); b.classList.add("active"); maskTool=b.dataset.maskTool; await renderMaskPreview(); $("maskCanvas").classList.toggle("mask-only",maskTool==="mask"); });
$("brushSize").oninput=e=>$("brushSizeValue").textContent=`${e.target.value} px`;
$("edgeSoftness").oninput=e=>$("edgeSoftnessValue").textContent=`${e.target.value}%`;
$("maskCanvas").addEventListener("pointerdown",e=>{ if(maskTool==="mask")return; maskPainting=true; e.currentTarget.setPointerCapture(e.pointerId); paintMask(e); });
$("maskCanvas").addEventListener("pointermove",e=>{ const r=e.currentTarget.getBoundingClientRect(), c=$("maskCursor"), size=Number($("brushSize").value); c.style.width=`${size}px`; c.style.height=`${size}px`; c.style.left=`${e.clientX-r.left-size/2}px`; c.style.top=`${e.clientY-r.top-size/2}px`; c.hidden=false; if(maskPainting)paintMask(e); });
$("maskCanvas").addEventListener("pointerup",e=>{maskPainting=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}); $("maskCanvas").addEventListener("pointerleave",()=>{maskPainting=false;$("maskCursor").hidden=true;});
$("maskApply").onclick=applyMaskCorrection; $("maskReset").onclick=resetMaskEditor;
$("theme").onclick = () => document.documentElement.classList.toggle("dark");
