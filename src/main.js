import { removeBackground } from "@imgly/background-removal";
import JSZip from "jszip";
import "./style.css";

const MAX_SOURCE_MB = 25;
const MAX_SOURCE_PIXELS = 30_000_000;
// Deliberately conservative: browser ML should never be allowed to consume the machine.
const PROCESS_MAX_EDGE = 1024;
const PRECISION_MAX_EDGE = 1280;
const PRECISION_CROP_MARGIN = 0.16;
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
        <input id="batchInput" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden>
        <div class="drop-visual"><div class="drop-orbit orbit-one"></div><div class="drop-orbit orbit-two"></div><div class="upload-orb"><span>↑</span></div></div>
        <div class="drop-copy"><span class="eyebrow">START A RESTORATION</span><h2>Place an image in the chamber</h2><p>JPG, PNG or WEBP · up to 25 MB</p><div class="tool-picker" role="tablist" aria-label="Choose processing tool"><button class="tool-choice active" data-tool="remove" type="button"><span>✦</span><b>Remove background</b><small>clean transparent cutout</small></button><button class="tool-choice" data-tool="enhance" type="button"><span>↗</span><b>Enhance image</b><small>reconstruct fine detail</small></button><button class="tool-choice" data-tool="both" type="button"><span>◈</span><b>Remove + enhance</b><small>full restoration</small></button></div></div>
        <div class="upload-actions"><button id="choose" class="primary liquid-button">Choose photo <span>↗</span></button><button id="batchChoose" class="ghost liquid-control" type="button">Batch 5–20 photos</button></div>
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
      <div class="studio-toolbar liquid-glass" role="toolbar" aria-label="Editing tools">
        <div class="studio-tool-group">
          <button class="studio-tool active" data-editor-tool="cutout" type="button"><span>✦</span><b>Cutout</b></button>
          <button class="studio-tool" data-editor-tool="background" type="button"><span>◒</span><b>Background</b></button>
          <button class="studio-tool" data-editor-tool="effects" type="button"><span>●</span><b>Effects</b></button>
          <button class="studio-tool" data-editor-tool="adjust" type="button"><span>◧</span><b>Adjust</b></button>
          <button class="studio-tool" data-editor-tool="design" type="button"><span>◫</span><b>Design</b></button>
        </div>
        <div class="studio-actions">
          <button id="compareTool" class="studio-icon" type="button" aria-label="Compare original and result">Compare</button>
          <button id="undoTool" class="studio-icon" type="button" aria-label="Undo last edit">Undo</button>
          <button id="redoTool" class="studio-icon" type="button" aria-label="Redo last edit">Redo</button>
          <button id="toolbarDownload" class="toolbar-download primary" type="button">Export <span>⌄</span></button>
        </div>
      </div>
      <div id="toolDrawer" class="tool-drawer liquid-glass hidden" aria-live="polite">
        <div id="adjustPanel" class="drawer-panel hidden">
          <div><span class="eyebrow">ADJUST</span><strong>Fine tune the image</strong><small>Simple controls — no technical settings.</small></div>
          <div class="drawer-controls">
            <label><span>Brightness</span><output id="brightnessValue">100%</output><input id="brightnessControl" type="range" min="85" max="115" value="100"></label>
            <label><span>Contrast</span><output id="contrastValue">100%</output><input id="contrastControl" type="range" min="85" max="120" value="100"></label>
            <label><span>Saturation</span><output id="saturationValue">100%</output><input id="saturationControl" type="range" min="70" max="125" value="100"></label>
            <button id="resetAdjust" class="ghost liquid-control" type="button">Reset</button>
          </div>
        </div>
        <div id="effectsPanel" class="drawer-panel hidden">
          <div><span class="eyebrow">EFFECTS</span><strong>Give the cutout a finish</strong><small>These are optional and never change the original AI mask.</small></div>
          <div class="drawer-pills">
            <label class="mini-toggle"><span>Natural shadow</span><input id="effectShadowToggle" type="checkbox"><i></i></label>
            <label class="mini-range"><span>Shadow <output id="effectShadowValue">18%</output></span><input id="effectShadowStrength" type="range" min="0" max="60" value="18"></label>
            <label class="mini-range"><span>Background blur <output id="effectBlurValue">14 px</output></span><input id="effectBlurStrength" type="range" min="0" max="40" value="14"></label>
          </div>
        </div>
        <div id="designPanel" class="drawer-panel hidden">
          <div><span class="eyebrow">DESIGN</span><strong>Choose the presentation</strong><small>Pick a background without opening a large settings panel.</small></div>
          <div class="design-pills">
            <button class="design-choice active" data-design-bg="checker" type="button">Transparent</button>
            <button class="design-choice" data-design-bg="white" type="button">White</button>
            <button class="design-choice" data-design-bg="dark" type="button">Dark</button>
            <button class="design-choice" data-design-bg="gradient" type="button">Gradient</button>
            <button class="design-choice" data-design-bg="blur" type="button">Original blur</button>
          </div>
        </div>
      </div>
      <div class="editor-head"><div><span class="glass-chip"><b id="resultModeLabel">CUTOUT READY</b><span>result ready</span></span><h2>Your cutout is ready.</h2><p id="stats"></p></div><button id="new" class="ghost liquid-control">＋ New photo</button></div>
      <div class="canvas-card liquid-glass">
        <div class="canvas-head"><div class="tabs"><button class="tab active" data-mode="result">Result</button><button class="tab" data-mode="original">Original</button><button class="tab" data-mode="split">Compare</button></div><div class="zoom"><button id="zoomOut">−</button><span id="zoomText">100%</span><button id="zoomIn">＋</button></div></div>
        <div id="preview" class="preview checker"><div id="splitPane"><img id="previewImg" alt="AI enhanced result"></div><img id="originalImg" class="original-img" alt="Original image"></div>
      </div>
      <div class="result-ribbon liquid-glass"><div class="ribbon-icon">✦</div><div><span class="eyebrow">RESTORATION REPORT</span><strong id="qualityTitle">Swin2SR neural reconstruction · 2×</strong><small id="qualityDetail">Neural reconstruction with transparent alpha compositing.</small></div><div id="qualityBadge" class="quality-badge"><span>✓</span> neural result</div></div>
      <div class="quick-actions liquid-glass">
        <div><span class="eyebrow">QUICK FINISH</span><h3>Ready to use</h3><p>Most images are finished here. Use advanced tools only when you need them.</p></div>
        <div class="quick-buttons"><button class="quick-btn active" data-quick-bg="checker">Transparent</button><button class="quick-btn" data-quick-bg="white">White</button><button class="quick-btn" data-quick-bg="dark">Dark</button><button id="download" class="primary liquid-button">Export <span>↗</span></button><button id="copyResult" class="ghost liquid-control" type="button">Copy</button></div>
      </div>
      <details class="advanced-section liquid-glass" id="advancedBackground">
        <summary><span><b>Background Studio</b><small>Colors, custom image, blur and shadow</small></span><i>＋</i></summary>
        <div class="details-body">
          <div class="background-studio-inner">
            <div class="background-options">
              <button class="background-option selected" data-background="checker" type="button"><span class="swatch checker"></span><b>Transparent</b><small>keep alpha</small></button>
              <button class="background-option" data-background="white" type="button"><span class="swatch solid-white"></span><b>Clean white</b><small>studio look</small></button>
              <button class="background-option" data-background="dark" type="button"><span class="swatch solid-dark"></span><b>Deep dark</b><small>high contrast</small></button>
              <button class="background-option" data-background="gradient" type="button"><span class="swatch gradient-swatch"></span><b>Liquid gradient</b><small>soft color field</small></button>
              <button class="background-option" data-background="blur" type="button"><span class="swatch blur-swatch"></span><b>Soft original</b><small>blurred scene</small></button>
              <button class="background-option" data-background="custom" type="button"><span class="swatch image-swatch">＋</span><b>Custom image</b><small>use your photo</small></button>
            </div>
            <div class="background-settings">
              <label class="toggle-row"><span><b>Natural shadow</b><small>Lift the subject from the background</small></span><input id="shadowToggle" type="checkbox"><i></i></label>
              <label class="range-label"><span>Shadow strength</span><output id="shadowValue">18%</output></label><input id="shadowStrength" type="range" min="0" max="60" value="18">
              <label class="range-label"><span>Background blur</span><output id="blurValue">14 px</output></label><input id="blurStrength" type="range" min="0" max="40" value="14">
              <button id="customBackgroundButton" class="ghost liquid-control" type="button">Choose background image</button>
              <input id="customBackgroundInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            </div>
          </div>
        </div>
      </details>
      <section class="preset-bar liquid-glass" aria-label="Saved presets">
        <div><span class="eyebrow">SAVED RECIPES</span><strong>Repeat a look in one click</strong><small>Save your background, shadow and image adjustments.</small></div>
        <div class="preset-controls"><select id="presetSelect" aria-label="Saved preset"><option value="">Choose preset…</option></select><button id="savePreset" class="ghost liquid-control" type="button">Save current</button><button id="deletePreset" class="ghost liquid-control" type="button">Delete</button></div>
      </section>
      <details class="advanced-section liquid-glass" id="advancedMask">
        <summary><span><b>Manual Cutout Editor</b><small>Fix small missed background areas or restore details</small></span><i>＋</i></summary>
        <div class="details-body">
          <div class="mask-head"><div><span class="eyebrow">ADVANCED</span><h3>Fine-tune the mask</h3><p>The automatic result is kept as your reset point.</p></div><div class="mask-status"><span class="mask-dot"></span><b id="maskStatus">AI mask ready</b></div></div>
          <div class="mask-layout"><div class="mask-canvas-wrap checker" id="maskCanvasWrap"><canvas id="maskCanvas" aria-label="Editable cutout mask"></canvas><div id="maskCursor" class="mask-cursor" hidden></div></div><div class="mask-controls"><div class="mask-tools"><button class="mask-tool active" data-mask-tool="remove"><b>−</b><span>Remove</span><small>erase subject</small></button><button class="mask-tool" data-mask-tool="keep"><b>+</b><span>Keep</span><small>restore subject</small></button><button class="mask-tool" data-mask-tool="mask"><b>◐</b><span>Mask</span><small>inspect AI mask</small></button></div><label class="range-label"><span>Brush size</span><output id="brushSizeValue">36 px</output></label><input id="brushSize" type="range" min="8" max="120" value="36"><label class="range-label"><span>Edge softness</span><output id="edgeSoftnessValue">20%</output></label><input id="edgeSoftness" type="range" min="0" max="100" value="20"><div class="mask-actions"><button id="maskReset" class="ghost liquid-control">Reset mask</button><button id="maskApply" class="primary liquid-button">Apply correction <span>✓</span></button></div><div class="mask-hint"><span>Tip</span> Use Remove for leftover background and Keep for missing subject detail.</div></div></div>
        </div>
      </details>
      <div class="extras"><div class="extra liquid-glass"><b>Source</b><span id="sourceInfo"></span></div><div class="extra liquid-glass"><b>Pipeline</b><span>AI mask → precision cleanup → alpha compositing</span></div><div class="extra liquid-glass"><b>Runtime</b><span id="runtimeInfo"></span></div></div>
      <p class="disclaimer">Super-resolution reconstructs plausible fine detail; it cannot recover missing information with certainty. Cutout Pro uses neural reconstruction rather than ordinary browser enlargement.</p>
    </section>
  </main>
  <div id="exportPreview" class="export-preview hidden" role="dialog" aria-modal="true" aria-label="Export preview"><div class="export-backdrop"></div><div class="export-dialog liquid-glass"><div class="export-head"><div><span class="eyebrow">EXPORT PREVIEW</span><h2>See it before it leaves.</h2><p>Inspect transparency, scale and output quality before downloading.</p></div><button id="exportClose" class="icon-btn liquid-control" aria-label="Close export preview">×</button></div><div class="export-stage checker"><img id="exportImage" alt="Final export preview"></div><div class="export-options">
  <label>Size<select id="exportSize"><option value="original">Original size</option><option value="400x400">LinkedIn · 400×400</option><option value="1080x1080">Instagram · 1080×1080</option><option value="1600x1600">eBay · 1600×1600</option></select></label>
  <label>Format<select id="exportFormatSelect"><option value="png">PNG · transparent</option><option value="webp">WebP · smaller</option><option value="jpeg">JPEG · solid background</option></select></label>
  <label class="export-toggle"><span>Watermark</span><input id="watermarkToggle" type="checkbox"><i></i></label>
</div>
<div class="export-meta"><div><b id="exportDimensions">—</b><span>output size</span></div><div><b id="exportFormat">PNG</b><span>format</span></div><div><b id="exportTransparency">Alpha</b><span>transparency</span></div></div><div class="export-actions"><button id="exportCancel" class="ghost liquid-control">Keep editing</button><button id="exportConfirm" class="primary liquid-button">Download <span>↓</span></button></div></div></div>
  <footer>Cutout Pro · image restoration studio · built around the pixels</footer>
</div>`

const $ = id => document.getElementById(id);
let file, processingBlob, originalUrl, resultUrl, resultBlob, alphaBlob;
let elapsed = 0, timerInt, zoom = 1, busy = false, jobToken = 0, activeTool = "remove", exportFormat = "png", exportSize = "original", watermarkEnabled = false;
let backgroundMode = "checker", customBackgroundBlob = null, customBackgroundUrl = null, renderedExportBlob = null, renderedPreviewUrl = null;
let shadowEnabled = false, shadowStrength = 18, backgroundBlur = 14;
let batchQueue = [], batchOutputs = [], batchMode = false;
let stateHistory = [], stateRedo = [];
let adjustBrightness = 100, adjustContrast = 100, adjustSaturation = 100;
let maskHistory = [], maskRedo = [];
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

function show(id) {
  $(id).classList.remove("hidden");
  if(id === "editor") {
    document.body.classList.add("editor-active");
    requestAnimationFrame(() => window.scrollTo({top:0,left:0,behavior:"instant"}));
  }
}
function hide(id) {
  $(id).classList.add("hidden");
  if(id === "editor") document.body.classList.remove("editor-active");
}
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

async function compositeWithAlpha(rgbBlob, maskBlob, width, height, cleanEdges = true) {
  const rgb = await createImageBitmap(rgbBlob);
  const mask = await createImageBitmap(maskBlob);
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  ctx.drawImage(rgb, 0, 0, width, height);
  if (!cleanEdges) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(mask, 0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";
  } else {
    const pixels = ctx.getImageData(0, 0, width, height);
    const matte = document.createElement("canvas"); matte.width = width; matte.height = height;
    const mx = matte.getContext("2d", { willReadFrequently: true });
    mx.drawImage(mask, 0, 0, width, height);
    const md = mx.getImageData(0, 0, width, height).data;
    const src = new Uint8ClampedArray(pixels.data);
    const alphaAt = (x,y) => md[(y*width+x)*4+3];
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4, a=alphaAt(x,y);
        if(a < 18){ pixels.data[i]=0; pixels.data[i+1]=0; pixels.data[i+2]=0; pixels.data[i+3]=0; continue; }
        if(a < 245){
          let bestA=a,bx=x,by=y;
          for(let oy=-1;oy<=1;oy++) for(let ox=-1;ox<=1;ox++){
            if(!ox && !oy) continue;
            const xx=x+ox, yy=y+oy;
            if(xx<0||yy<0||xx>=width||yy>=height) continue;
            const aa=alphaAt(xx,yy);
            if(aa>bestA){bestA=aa;bx=xx;by=yy;}
          }
          if(bestA > a+12){
            const bi=(by*width+bx)*4;
            const pull=Math.min(1, (bestA-a)/110);
            pixels.data[i]=Math.round(src[i]*(1-pull)+src[bi]*pull);
            pixels.data[i+1]=Math.round(src[i+1]*(1-pull)+src[bi+1]*pull);
            pixels.data[i+2]=Math.round(src[i+2]*(1-pull)+src[bi+2]*pull);
          }
        }
        pixels.data[i+3]=a;
      }
    }
    ctx.putImageData(pixels,0,0); matte.width=1; matte.height=1;
  }
  rgb.close(); mask.close();
  const blob = await canvasToBlob(canvas); canvas.width = 1; canvas.height = 1;
  return blob;
}

async function setupMaskEditor(enhancedBlob, refinedMask) {
  enhancedSourceBlob = enhancedBlob; maskOriginalBlob = refinedMask;
  const img = await createImageBitmap(enhancedBlob); const mask = await createImageBitmap(refinedMask);
  maskCanvas = $("maskCanvas"); maskCanvas.width = img.width; maskHistory=[]; maskRedo=[]; updateHistoryButtons(); maskCanvas.height = img.height;
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
function saveMaskHistory(){
  if(!maskLayerCtx || !maskCanvas) return;
  const snap=maskLayerCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height);
  maskHistory.push(snap); if(maskHistory.length>6) maskHistory.shift(); maskRedo=[]; updateHistoryButtons();
}
function restoreMaskSnapshot(snap){ if(!snap||!maskLayerCtx) return; maskLayerCtx.putImageData(snap,0,0); renderMaskPreview(); updateHistoryButtons(); }
function snapshotState(){ return {backgroundMode,shadowEnabled,shadowStrength,backgroundBlur,adjustBrightness,adjustContrast,adjustSaturation}; }
function restoreState(st){ if(!st)return; backgroundMode=st.backgroundMode;shadowEnabled=st.shadowEnabled;shadowStrength=st.shadowStrength;backgroundBlur=st.backgroundBlur;adjustBrightness=st.adjustBrightness;adjustContrast=st.adjustContrast;adjustSaturation=st.adjustSaturation; [$("shadowToggle"),$("effectShadowToggle")].forEach(x=>x&&(x.checked=shadowEnabled)); $("shadowStrength").value=shadowStrength;$("effectShadowStrength").value=shadowStrength;$("blurStrength").value=backgroundBlur;$("effectBlurStrength").value=backgroundBlur; $("brightnessControl").value=adjustBrightness;$("contrastControl").value=adjustContrast;$("saturationControl").value=adjustSaturation; updateAdjustLabels(); renderBackgroundComposite(); }
function pushState(){ const cur=snapshotState(); if(JSON.stringify(stateHistory.at(-1))===JSON.stringify(cur)) return; stateHistory.push(cur); if(stateHistory.length>30)stateHistory.shift(); stateRedo=[]; updateHistoryButtons(); }
function undoState(){ if(stateHistory.length<2)return; stateRedo.push(stateHistory.pop()); restoreState(stateHistory.at(-1)); updateHistoryButtons(); }
function redoState(){ if(!stateRedo.length)return; const st=stateRedo.pop(); stateHistory.push(st); restoreState(st); updateHistoryButtons(); }
function updateAdjustLabels(){ [$("brightnessValue"),$("contrastValue"),$("saturationValue")].forEach((o,i)=>o.textContent=[adjustBrightness,adjustContrast,adjustSaturation][i]+"%"); }
function updatePresetList(){ const sel=$("presetSelect"); if(!sel)return; const presets=JSON.parse(localStorage.getItem("cutoutPro.presets")||"{}"); sel.innerHTML='<option value="">Choose preset…</option>'+Object.keys(presets).map(n=>`<option value="${n.replaceAll('"','&quot;')}">${n}</option>`).join(""); }
function savePreset(){ const name=prompt("Preset name"); if(!name?.trim())return; const presets=JSON.parse(localStorage.getItem("cutoutPro.presets")||"{}"); presets[name.trim()]=snapshotState(); localStorage.setItem("cutoutPro.presets",JSON.stringify(presets)); updatePresetList(); $("presetSelect").value=name.trim(); }
function applyPreset(name){ const presets=JSON.parse(localStorage.getItem("cutoutPro.presets")||"{}"); if(!presets[name])return; pushState(); restoreState(presets[name]); }
function deletePreset(){ const name=$("presetSelect").value;if(!name)return;const presets=JSON.parse(localStorage.getItem("cutoutPro.presets")||"{}");delete presets[name];localStorage.setItem("cutoutPro.presets",JSON.stringify(presets));updatePresetList(); }

function updateHistoryButtons(){ const u=$("undoTool"), r=$("redoTool"); if(u){u.disabled=stateHistory.length<2 && !maskHistory.length;u.classList.toggle("disabled",u.disabled);} if(r){r.disabled=!stateRedo.length && !maskRedo.length;r.classList.toggle("disabled",r.disabled);} }
function undoMask(){ if(!maskHistory.length)return; const current=maskLayerCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height); maskRedo.push(current); const snap=maskHistory.pop(); restoreMaskSnapshot(snap); }
function redoMask(){ if(!maskRedo.length)return; const current=maskLayerCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height); maskHistory.push(current); const snap=maskRedo.pop(); restoreMaskSnapshot(snap); }

function paintMask(e) {
  if (!maskCanvas || !maskLayerCtx || !maskPainting || maskTool === "mask") return; const p=maskPoint(e); const scale=maskCanvas.width/maskCanvas.getBoundingClientRect().width; const radius=Number($("brushSize").value)*scale/2; const softness=Number($("edgeSoftness").value)/100;
  const g=maskLayerCtx.createRadialGradient(p.x,p.y,radius*Math.max(.05,softness),p.x,p.y,radius); const keep=maskTool==="keep"; g.addColorStop(0,keep?"rgba(255,255,255,1)":"rgba(0,0,0,1)"); g.addColorStop(1,keep?"rgba(255,255,255,0)":"rgba(0,0,0,0)");
  maskLayerCtx.save(); maskLayerCtx.globalCompositeOperation=keep?"source-over":"destination-out"; maskLayerCtx.fillStyle=g; maskLayerCtx.beginPath(); maskLayerCtx.arc(p.x,p.y,radius,0,Math.PI*2); maskLayerCtx.fill(); maskLayerCtx.restore();
  renderMaskPreview(); $("maskStatus").textContent=keep?"Manual keep stroke":"Manual remove stroke";
}
async function applyMaskCorrection() {
  if (!maskCanvas || !enhancedSourceBlob || maskTool === "mask") return; const source=await createImageBitmap(enhancedSourceBlob); const c=document.createElement("canvas"); c.width=maskCanvas.width; c.height=maskCanvas.height; const ctx=c.getContext("2d",{alpha:true}); ctx.drawImage(source,0,0);
  const edited=maskLayerCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height), src=ctx.getImageData(0,0,c.width,c.height); for(let i=0;i<edited.data.length;i+=4) src.data[i+3]=edited.data[i+3]; ctx.putImageData(src,0,0); resultBlob=await canvasToBlob(c); revoke(resultUrl); resultUrl=URL.createObjectURL(resultBlob); $("previewImg").src=resultUrl; source.close(); c.width=1;c.height=1; $("maskStatus").textContent="Correction applied · result updated"; await renderBackgroundComposite(); $("qualityDetail").textContent="AI segmentation with manual mask correction and transparent compositing."; $("qualityBadge").innerHTML="<span>✓</span> edited mask";
}
async function resetMaskEditor() { if(!enhancedSourceBlob||!maskOriginalBlob)return; await setupMaskEditor(enhancedSourceBlob,maskOriginalBlob); await renderMaskPreview(); $("maskStatus").textContent="AI mask restored"; }

function setTool(tool){ activeTool=tool; document.querySelectorAll(".tool-choice").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool)); const labels={remove:["REMOVE BACKGROUND","Pure subject isolation","The AI is building a clean alpha matte — no enhancement pass."],enhance:["ENHANCE IMAGE","Detail reconstruction","The AI is rebuilding fine detail while preserving the original scene."],both:["FULL RESTORATION","Remove + enhance","Subject isolation followed by memory-safe neural reconstruction."]}; const x=labels[tool]; $("processEyebrow").textContent=x[0]; $("processTitle").textContent=x[1]; $("processSub").textContent=x[2]; document.body.dataset.tool=tool; $("processing").dataset.tool=tool; if(tool==="remove"){ $("stage3").querySelector("b").textContent="Reveal"; $("stage3").querySelector("small").textContent="live cutout"; $("stage4").querySelector("b").textContent="Polish"; $("stage4").querySelector("small").textContent="edge alpha"; } else { $("stage3").querySelector("b").textContent="Rebuild"; $("stage3").querySelector("small").textContent="neural detail"; $("stage4").querySelector("b").textContent="Refine"; $("stage4").querySelector("small").textContent="edge alpha"; } }

function chooseRemovalModel(){ return navigator.gpu ? "isnet_fp16" : "isnet_quint8"; }

async function inspectMask(maskBlob){
  const c=await blobToCanvas(maskBlob);
  const ctx=c.getContext("2d",{willReadFrequently:true});
  const w=c.width,h=c.height,d=ctx.getImageData(0,0,w,h).data;
  let soft=0, edge=0, fg=0, n=0, minX=w, minY=h, maxX=-1, maxY=-1;
  const step=Math.max(1,Math.floor(Math.min(w,h)/140));
  for(let y=0;y<h;y+=step) for(let x=0;x<w;x+=step){
    const i=(y*w+x)*4,a=d[i+3]; n++;
    if(a>20){ fg++; minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); }
    if(a>24 && a<232) soft++;
    if(x<step*2||y<step*2||x>=w-step*2||y>=h-step*2) if(a>35) edge++;
  }
  c.width=1;c.height=1;
  const softRate=soft/Math.max(n,1), edgeRate=edge/Math.max(n,1), fgRate=fg/Math.max(n,1);
  const bbox=maxX>=0 ? {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1} : null;
  const subjectRate=bbox ? (bbox.w*bbox.h)/(w*h) : 1;
  return {softRate,edgeRate,fgRate,subjectRate,bbox,width:w,height:h,
    difficult:(edgeRate>.008 && fgRate<.92) || softRate>.16 || subjectRate<.48 || fgRate>.96};
}

async function maskNeedsPrecisionPass(maskBlob){ return (await inspectMask(maskBlob)).difficult; }

async function cropImageBlob(blob, rect){
  const bitmap=await createImageBitmap(blob);
  const x=Math.max(0,Math.floor(rect.x)), y=Math.max(0,Math.floor(rect.y));
  const w=Math.min(bitmap.width-x,Math.max(1,Math.floor(rect.w))), h=Math.min(bitmap.height-y,Math.max(1,Math.floor(rect.h)));
  const c=document.createElement("canvas"); c.width=w;c.height=h;
  const ctx=c.getContext("2d",{alpha:true}); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.drawImage(bitmap,x,y,w,h,0,0,w,h); bitmap.close();
  const out=await canvasToBlob(c); c.width=1;c.height=1; return {blob:out,x,y,w,h};
}

async function scaleCropForPrecision(crop){
  const maxEdge=Math.max(crop.w,crop.h);
  if(maxEdge>=PRECISION_MAX_EDGE) return crop;
  const scale=PRECISION_MAX_EDGE/maxEdge;
  const bm=await createImageBitmap(crop.blob);
  const c=document.createElement("canvas"); c.width=Math.round(crop.w*scale); c.height=Math.round(crop.h*scale);
  const x=c.getContext("2d",{alpha:true}); x.imageSmoothingEnabled=true; x.imageSmoothingQuality="high"; x.drawImage(bm,0,0,c.width,c.height); bm.close();
  const out=await canvasToBlob(c); c.width=1;c.height=1;
  return {...crop,blob:out,w:Math.round(crop.w*scale),h:Math.round(crop.h*scale),scale};
}

async function pasteMaskIntoCanvas(cropMask, fullW, fullH, rect){
  const full=document.createElement("canvas"); full.width=fullW; full.height=fullH;
  const ctx=full.getContext("2d",{alpha:true}); ctx.clearRect(0,0,fullW,fullH);
  const mask=await createImageBitmap(cropMask);
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high";
  ctx.drawImage(mask,0,0,mask.width,mask.height,rect.x,rect.y,rect.w,rect.h); mask.close();
  const out=await canvasToBlob(full); full.width=1;full.height=1; return out;
}

async function mergePrecisionMask(primaryMask, focusedMask, rect, fullW, fullH){
  const primary = await blobToCanvas(primaryMask);
  const focused = await blobToCanvas(focusedMask);
  const w=fullW,h=fullH;
  const out=document.createElement("canvas"); out.width=w; out.height=h;
  const ox=out.getContext("2d",{willReadFrequently:true});
  const pd=primary.getContext("2d",{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const fd=focused.getContext("2d",{willReadFrequently:true}).getImageData(0,0,focused.width,focused.height).data;
  const dst=ox.createImageData(w,h);
  const sx=focused.width/Math.max(1,rect.w), sy=focused.height/Math.max(1,rect.h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4;
    let a=pd[i+3];
    if(x>=rect.x && y>=rect.y && x<rect.x+rect.w && y<rect.y+rect.h){
      const fx=Math.min(focused.width-1,Math.max(0,Math.floor((x-rect.x)*sx)));
      const fy=Math.min(focused.height-1,Math.max(0,Math.floor((y-rect.y)*sy)));
      const fa=fd[(fy*focused.width+fx)*4+3];
      // Let the focused model improve uncertain pixels, but never erase a
      // confident primary foreground pixel merely because the crop disagrees.
      if(a < 48) a=fa;
      else if(fa > a) a=Math.round(a*0.35 + fa*0.65);
      else if(a > 210 && fa < 80) a=Math.round(a*0.82 + fa*0.18);
    }
    dst.data[i]=dst.data[i+1]=dst.data[i+2]=255;
    dst.data[i+3]=a;
  }
  ox.putImageData(dst,0,0);
  primary.width=1; primary.height=1; focused.width=1; focused.height=1;
  const result=await canvasToBlob(out); out.width=1; out.height=1; return result;
}

async function focusedPrecisionPass(sourceBlob, firstMask, token){
  const stats=await inspectMask(firstMask);
  if(!stats.bbox) return null;
  const mx=Math.round(stats.bbox.w*PRECISION_CROP_MARGIN), my=Math.round(stats.bbox.h*PRECISION_CROP_MARGIN);
  const baseRect={
    x:Math.max(0,stats.bbox.x-mx), y:Math.max(0,stats.bbox.y-my),
    w:Math.min(stats.width,stats.bbox.w+mx*2), h:Math.min(stats.height,stats.bbox.h+my*2)
  };
  const crop=await cropImageBlob(sourceBlob,baseRect);
  const scaled=await scaleCropForPrecision(crop);
  if(token!==jobToken) throw new DOMException("Cancelled","AbortError");
  const config={proxyToWorker:true,output:{format:"image/png",type:"mask"},progress:(key,current,total)=>{
    if(token===jobToken && key.includes("inference")) $("signalMask").textContent=`focus ${Math.round((current/Math.max(total,1))*100)}%`;
  }};
  const mask=await removeBackground(scaled.blob,{...config,model:navigator.gpu?"isnet":"isnet_quint8",device:navigator.gpu?"gpu":"cpu"});
  if(token!==jobToken) throw new DOMException("Cancelled","AbortError");
  // Convert the high-resolution crop mask back into the original working
  // coordinate system and merge it with the primary mask instead of replacing
  // the whole matte. This preserves confident pixels around the subject.
  const focusedFull=await pasteMaskIntoCanvas(mask,stats.width,stats.height,{x:baseRect.x,y:baseRect.y,w:baseRect.w,h:baseRect.h});
  return await mergePrecisionMask(firstMask,focusedFull,baseRect,stats.width,stats.height);
}

async function runBackgroundRemoval(blob, token) {
  const primary = chooseRemovalModel();
  const config = { model: primary, device: navigator.gpu ? "gpu" : "cpu", proxyToWorker: true, output: { format: "image/png", type: "mask" },
    progress: (key,current,total) => { if(key.includes("inference")){ const pct=Math.round((current/Math.max(total,1))*100); $("signalMask").textContent=`AI ${pct}%`; } } };
  try {
    const first = await removeBackground(blob, config);
    if(token !== jobToken) throw new DOMException("Cancelled", "AbortError");
    const stats=await inspectMask(first);
    const shouldRefine=await maskNeedsPrecisionPass(first);
    if(primary === "isnet_fp16" && shouldRefine) {
      $("processSub").textContent = stats.subjectRate < .48 ? "The subject is small in the frame · focusing the AI on the subject for a cleaner matte…" : "This image has difficult edges · running a focused high-resolution matte pass…";
      $("signalMask").textContent = "focus pass";
      try {
        const focused=await focusedPrecisionPass(blob,first,token);
        if(focused) return {blob:focused,model:"isnet + focused",precision:true};
      } catch(e) { console.warn("Focused precision pass unavailable; keeping primary matte.",e); }
    }
    return { blob: first, model: primary, precision: false };
  } catch (err) {
    if(primary !== "isnet_fp16") throw err;
    $("processSub").textContent = "GPU model hit a device limit · switching to the safe CPU model…";
    const fallback = await removeBackground(blob, { ...config, model: "isnet_quint8", device: "cpu" });
    return { blob: fallback, model: "isnet_quint8", precision: false };
  }
}

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
      $("signalMask").textContent = navigator.gpu ? "precision GPU" : "safe CPU";
      const removal = await runBackgroundRemoval(processingBlob, token);
      alphaBlob = removal.blob;
      window.__cutoutModelUsed = removal.model;
      window.__cutoutPrecisionPass = removal.precision;
      if (token !== jobToken) return;
      $("previewState").textContent = "AI matte generated · revealing cutout";
      if (activeTool === "remove") {
        const liveCutout = await compositeWithAlpha(processingBlob, alphaBlob, prepared.width, prepared.height, false);
        const liveUrl = URL.createObjectURL(liveCutout);
        $("processingPreview").src = liveUrl;
        $("processingPreview").classList.remove("mask-preview");
        await nextFrame();
        $("cutoutReveal").classList.add("active");
        $("cutoutReveal").style.width = "100%";
        await new Promise(r=>setTimeout(r,180));
        URL.revokeObjectURL(liveUrl);
      } else {
        const maskUrl = URL.createObjectURL(alphaBlob);
        $("processingPreview").src = maskUrl;
        $("processingPreview").classList.add("mask-preview");
        await nextFrame();
        $("cutoutReveal").classList.add("active");
        $("cutoutReveal").style.width = "100%";
        await new Promise(r=>setTimeout(r,180));
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
    const resizedMask = await resizeAlphaBlob(alphaBlob, enhanced.width, enhanced.height);
    const refinedMask = await refineAlphaMask(resizedMask, false);
    await setupMaskEditor(enhanced.blob, refinedMask);
    URL.revokeObjectURL(enhancedUrl);
    await yieldToBrowser();

    setStage(5); $("processTitle").textContent = activeTool === "remove" ? "The background is gone." : "Compositing your result…"; $("processSub").textContent = activeTool === "remove" ? "Your original pixels are preserved; only the background alpha has changed." : "Applying transparency without a giant pixel-by-pixel loop."; await nextFrame();
    resultBlob = await compositeWithAlpha(enhanced.blob, refinedMask, enhanced.width, enhanced.height);
    revoke(resultUrl); resultUrl = URL.createObjectURL(resultBlob); $("previewImg").src = resultUrl;
    backgroundMode="checker"; await renderBackgroundComposite();
    const info = await fileInfo(resultBlob); clearInterval(timerInt); setStage(5);
    $("stats").textContent = `${elapsed.toFixed(1)}s · ${info.width} × ${info.height}px · ${activeTool === "remove" ? "AI cutout" : "AI 2×"}`;
    $("qualityTitle").textContent = activeTool === "remove" ? "Precision AI background removal" : "Swin2SR neural reconstruction · 2×";
    $("qualityDetail").textContent = activeTool === "remove" ? `Foreground matte generated with ${window.__cutoutModelUsed || chooseRemovalModel()}${window.__cutoutPrecisionPass ? " precision pass" : ""} and refined alpha compositing.` : "Neural reconstruction with transparent alpha compositing.";
    $("qualityBadge").innerHTML = activeTool === "remove" ? "<span>✓</span> cutout ready" : "<span>✓</span> neural result"; $("resultModeLabel").textContent = activeTool === "remove" ? "CUTOUT READY" : "ENHANCED READY";
    $("sourceInfo").textContent = `${f.name} · ${prepared.original.width} × ${prepared.original.height}px · ${(f.size / 1024 / 1024).toFixed(2)} MB`;
    hide("processing"); show("editor"); setPreviewMode("split"); applyZoom();
  } catch (err) {
    console.error("Cutout Pro processing error:", err); clearInterval(timerInt);
    if (err?.name !== "AbortError") showError(err?.message || "The browser could not complete this image safely.");
  } finally { busy = false; }
}

async function createOpaqueMask(w,h){ const c=document.createElement("canvas"); c.width=w;c.height=h; const x=c.getContext("2d"); x.fillStyle="#fff";x.fillRect(0,0,w,h); const out=await canvasToBlob(c); c.width=1;c.height=1; return out; }

async function refineAlphaMask(blob, aggressive = false){
  const c=await blobToCanvas(blob); const w=c.width,h=c.height;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  const src=ctx.getImageData(0,0,w,h).data;
  const out=document.createElement("canvas"); out.width=w; out.height=h;
  const ox=out.getContext("2d",{willReadFrequently:true}); const dst=ox.createImageData(w,h);
  const aAt=(x,y)=>src[(y*w+x)*4+3];
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=(y*w+x)*4, a=aAt(x,y);
    dst.data[i]=dst.data[i+1]=dst.data[i+2]=255;
    // Preserve the model's soft matte. Only remove near-zero speckle/noise;
    // aggressively shrinking semi-transparent pixels destroys hair and thin
    // contours, which is exactly what the previous pass was doing.
    if(a<=8){dst.data[i+3]=0;continue;}
    let maxA=a, opaqueNeighbors=0;
    for(let oy=-1;oy<=1;oy++) for(let oxi=-1;oxi<=1;oxi++){
      if(!oxi&&!oy) continue;
      const xx=x+oxi,yy=y+oy; if(xx<0||yy<0||xx>=w||yy>=h) continue;
      const aa=aAt(xx,yy); maxA=Math.max(maxA,aa); if(aa>=245) opaqueNeighbors++;
    }
    let clean=a;
    // Only suppress extremely weak pixels immediately outside a solid region.
    // Keep a meaningful alpha ramp for natural anti-aliased edges and hair.
    if(opaqueNeighbors>=5 && a<20) clean=Math.round(a*0.35);
    if(clean<4) clean=0;
    dst.data[i+3]=Math.max(0,Math.min(255,clean));
  }
  ox.putImageData(dst,0,0); c.width=1;c.height=1; const outBlob=await canvasToBlob(out); out.width=1;out.height=1; return outBlob;
}

async function resizeAlphaBlob(blob, w, h) {
  const c = await blobToCanvas(blob); const o = document.createElement("canvas"); o.width = w; o.height = h;
  const x = o.getContext("2d", { alpha: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, w, h);
  c.width = 1; c.height = 1; const out = await canvasToBlob(o); o.width = 1; o.height = 1; return out;
}

async function renderBackgroundComposite() {
  if(!resultBlob) return;
  const subject = await createImageBitmap(resultBlob);
  const w=subject.width,h=subject.height;
  const c=document.createElement("canvas"); c.width=w;c.height=h;
  const x=c.getContext("2d",{alpha:true});
  if(backgroundMode==="checker"){ x.clearRect(0,0,w,h); }
  else if(backgroundMode==="white"){ x.fillStyle="#ffffff"; x.fillRect(0,0,w,h); }
  else if(backgroundMode==="dark"){ x.fillStyle="#10181d"; x.fillRect(0,0,w,h); }
  else if(backgroundMode==="gradient"){ const g=x.createLinearGradient(0,0,w,h); g.addColorStop(0,"#f6d7e6");g.addColorStop(.48,"#e5f5f1");g.addColorStop(1,"#d9e7fb");x.fillStyle=g;x.fillRect(0,0,w,h); }
  else if(backgroundMode==="blur" || backgroundMode==="custom"){
    let bg=customBackgroundBlob;
    if(backgroundMode==="blur" && originalUrl) bg=await fetch(originalUrl).then(r=>r.blob());
    if(bg){ const b=await createImageBitmap(bg); x.save(); x.filter=`blur(${backgroundBlur}px)`; const scale=Math.max(w/b.width,h/b.height); const bw=b.width*scale,bh=b.height*scale; x.drawImage(b,(w-bw)/2,(h-bh)/2,bw,bh); x.restore(); b.close(); }
    else { x.fillStyle="#e9eff2";x.fillRect(0,0,w,h); }
  }
  if(shadowEnabled && shadowStrength>0){
    const sc=document.createElement("canvas"); sc.width=w;sc.height=h; const sx=sc.getContext("2d"); sx.drawImage(subject,0,0);
    sx.globalCompositeOperation="source-in"; sx.fillStyle=`rgba(20,30,35,${shadowStrength/100})`; sx.fillRect(0,0,w,h);
    x.save(); x.filter=`blur(${Math.max(2,Math.round(w*.006))}px)`; x.globalAlpha=.55; x.drawImage(sc,Math.round(w*.018),Math.round(h*.035)); x.restore(); sc.width=1;sc.height=1;
  }
  x.save(); x.filter=`brightness(${adjustBrightness}%) contrast(${adjustContrast}%) saturate(${adjustSaturation}%)`; x.drawImage(subject,0,0); x.restore(); subject.close();
  if(exportFormat === "jpeg"){
    const bg=c.getContext("2d"); const image=bg.getImageData(0,0,c.width,c.height); const d=image.data;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<255){d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;} }
    bg.putImageData(image,0,0);
  }
  if(exportSize!=="original"){
    const [tw,th]=exportSize.split("x").map(Number); const out=document.createElement("canvas"); out.width=tw;out.height=th;
    const ox=out.getContext("2d",{alpha:true}); if(exportFormat==="jpeg"){ox.fillStyle="#fff";ox.fillRect(0,0,tw,th);}
    const scale=Math.min(tw/w,th/h), dw=Math.round(w*scale), dh=Math.round(h*scale); ox.drawImage(c,Math.round((tw-dw)/2),Math.round((th-dh)/2),dw,dh); c.width=1;c.height=1;
    c.width=tw;c.height=th; const cx=c.getContext("2d",{alpha:true}); cx.drawImage(out,0,0); out.width=1;out.height=1;
  }
  const drawCtx=c.getContext("2d",{alpha:true});
  if(watermarkEnabled){ drawCtx.save(); drawCtx.globalAlpha=.62; drawCtx.fillStyle=exportFormat==="jpeg"?"#26343a":"#ffffff"; drawCtx.font=`700 ${Math.max(14,Math.round(c.width*.018))}px system-ui`; drawCtx.textAlign="right"; drawCtx.textBaseline="bottom"; drawCtx.fillText("Cutout Pro",c.width-22,c.height-18); drawCtx.restore(); }
  const mime=exportFormat==="jpeg"?"image/jpeg":exportFormat==="webp"?"image/webp":"image/png";
  renderedExportBlob=await canvasToBlob(c,mime,exportFormat==="jpeg"||exportFormat==="webp"?0.92:undefined); c.width=1;c.height=1;
  revoke(renderedPreviewUrl); renderedPreviewUrl=URL.createObjectURL(renderedExportBlob);
  $("previewImg").src=renderedPreviewUrl;
}

async function updateBackgroundMode(mode){ backgroundMode=mode; document.querySelectorAll(".background-option").forEach(b=>b.classList.toggle("selected",b.dataset.background===mode)); document.querySelectorAll(".quick-btn[data-quick-bg]").forEach(b=>b.classList.toggle("active",b.dataset.quickBg===mode)); await renderBackgroundComposite(); }

function showError(message) {
  hide("editor"); show("processing"); $("processBadge").textContent = "SAFE RETRY"; $("processTitle").textContent = "The image was not completed"; $("processSub").textContent = message; $("tip").textContent = "Cutout Pro stopped the job instead of continuing to consume memory. Try a smaller image if the browser reports a resource limit."; $("bar").style.width = "0%";
}
function resetToUpload() { jobToken++; busy = false; clearInterval(timerInt); revoke(resultUrl); resultUrl = null; revoke(renderedPreviewUrl); renderedPreviewUrl=null; renderedExportBlob=null; revoke(customBackgroundUrl); customBackgroundUrl=null; customBackgroundBlob=null; backgroundMode="checker"; shadowEnabled=false; backgroundBlur=14; shadowStrength=18; revoke(originalUrl); originalUrl = null; processingBlob = null; alphaBlob = null; enhancedSourceBlob = null; maskOriginalBlob = null; maskCanvas = null; maskCtx = null; maskLayerCanvas = null; maskLayerCtx = null; $("fileInput").value = ""; hide("processing"); hide("editor"); show("uploadView"); }
function applyZoom() { $("previewImg").style.transform = `scale(${zoom})`; $("originalImg").style.transform = `scale(${zoom})`; $("zoomText").textContent = Math.round(zoom * 100) + "%"; }

$("choose").onclick = () => !busy && $("fileInput").click(); document.querySelectorAll(".tool-choice").forEach(b=>b.onclick=()=>setTool(b.dataset.tool)); setTool("remove");
$("fileInput").onchange = e => e.target.files[0] && start(e.target.files[0]);
$("processingNew").onclick = resetToUpload;
["dragenter", "dragover"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); if (!busy) $("dropzone").classList.add("drag"); }));
["dragleave", "drop"].forEach(x => $("dropzone").addEventListener(x, e => { e.preventDefault(); $("dropzone").classList.remove("drag"); }));
$("dropzone").addEventListener("drop", e => { if (busy) return; const f = [...e.dataTransfer.files].find(x => x.type.startsWith("image/")); if (f) start(f); });

document.querySelectorAll(".quick-btn[data-quick-bg]").forEach(b=>b.onclick=async()=>{ pushState(); document.querySelectorAll(".quick-btn[data-quick-bg]").forEach(x=>x.classList.remove("active")); b.classList.add("active"); await updateBackgroundMode(b.dataset.quickBg); });
function setPreviewMode(m){ document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.mode===m)); $("originalImg").style.display=m==="original"||m==="split"?"block":"none"; $("splitPane").style.display=m==="original"?"none":"block"; $("preview").classList.toggle("split",m==="split"); $("preview").dataset.mode=m; applyZoom(); }
function updateCompareSlider(v){ $("preview").style.setProperty("--compare",v+"%"); }
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>setPreviewMode(b.dataset.mode));
$("zoomIn").onclick = () => { zoom = Math.min(2, zoom + .1); applyZoom(); }; $("zoomOut").onclick = () => { zoom = Math.max(.5, zoom - .1); applyZoom(); };
$("new").onclick = resetToUpload;

async function openExportPreview(){
  if(!resultBlob)return;
  await renderBackgroundComposite();
  const blob=renderedExportBlob||resultBlob;
  const url=URL.createObjectURL(blob);
  $("exportImage").src=url;
  const info=await fileInfo(blob);
  $("exportDimensions").textContent=`${info.width} × ${info.height}px`;
  $("exportFormat").textContent=exportFormat.toUpperCase();
  $("exportTransparency").textContent=exportFormat==="jpeg"?"Flattened":"Alpha ready";
  $("exportPreview").classList.remove("hidden");
  $("exportPreview").dataset.url=url;
}
async function confirmExport(){
  if(!resultBlob)return;
  await renderBackgroundComposite();
  const blob=renderedExportBlob||resultBlob;
  const ext=exportFormat==="jpeg"?"jpg":exportFormat;
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`cutout-pro-${activeTool}-${Date.now()}.${ext}`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500); closeExportPreview();
}
async function copyResult(){
  if(!resultBlob || !navigator.clipboard?.write || typeof ClipboardItem==="undefined")return;
  await renderBackgroundComposite();
  const blob=renderedExportBlob||resultBlob;
  try{
    await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);
    const b=$("copyResult"),old=b.textContent;b.textContent="Copied ✓";setTimeout(()=>b.textContent=old,1200);
  }catch(e){console.warn("Clipboard copy unavailable",e);}
}
function closeExportPreview(){
  const u=$("exportPreview").dataset.url;if(u)URL.revokeObjectURL(u);
  $("exportPreview").dataset.url="";$("exportImage").src="";$("exportPreview").classList.add("hidden");
}
$("download").onclick=openExportPreview;$("toolbarDownload").onclick=openExportPreview;
$("exportConfirm").onclick=confirmExport;$("exportClose").onclick=closeExportPreview;$("exportCancel").onclick=closeExportPreview;$("copyResult").onclick=copyResult;
$("exportSize").onchange=async e=>{exportSize=e.target.value;await renderBackgroundComposite();if(!$("exportPreview").classList.contains("hidden")){const u=$("exportPreview").dataset.url;if(u)URL.revokeObjectURL(u);const nu=URL.createObjectURL(renderedExportBlob);$("exportImage").src=nu;$("exportPreview").dataset.url=nu;}};
$("exportFormatSelect").onchange=async e=>{exportFormat=e.target.value;await renderBackgroundComposite();if(!$("exportPreview").classList.contains("hidden")){const u=$("exportPreview").dataset.url;if(u)URL.revokeObjectURL(u);const nu=URL.createObjectURL(renderedExportBlob);$("exportImage").src=nu;$("exportPreview").dataset.url=nu;}$("exportFormat").textContent=exportFormat.toUpperCase();$("exportTransparency").textContent=exportFormat==="jpeg"?"Flattened":"Alpha ready";};
$("watermarkToggle").onchange=async e=>{watermarkEnabled=e.target.checked;await renderBackgroundComposite();if(!$("exportPreview").classList.contains("hidden")){const u=$("exportPreview").dataset.url;if(u)URL.revokeObjectURL(u);const nu=URL.createObjectURL(renderedExportBlob);$("exportImage").src=nu;$("exportPreview").dataset.url=nu;}};

document.querySelectorAll(".mask-tool").forEach(b=>b.onclick=async()=>{ document.querySelectorAll(".mask-tool").forEach(x=>x.classList.remove("active")); b.classList.add("active"); maskTool=b.dataset.maskTool; await renderMaskPreview(); $("maskCanvas").classList.toggle("mask-only",maskTool==="mask"); });
$("brushSize").oninput=e=>$("brushSizeValue").textContent=`${e.target.value} px`;
$("edgeSoftness").oninput=e=>$("edgeSoftnessValue").textContent=`${e.target.value}%`;
$("maskCanvas").addEventListener("pointerdown",e=>{ if(maskTool==="mask")return; saveMaskHistory(); maskPainting=true; e.currentTarget.setPointerCapture(e.pointerId); paintMask(e); });
$("maskCanvas").addEventListener("pointermove",e=>{ const r=e.currentTarget.getBoundingClientRect(), c=$("maskCursor"), size=Number($("brushSize").value); c.style.width=`${size}px`; c.style.height=`${size}px`; c.style.left=`${e.clientX-r.left-size/2}px`; c.style.top=`${e.clientY-r.top-size/2}px`; c.hidden=false; if(maskPainting)paintMask(e); });
$("maskCanvas").addEventListener("pointerup",e=>{maskPainting=false;try{e.currentTarget.releasePointerCapture(e.pointerId)}catch{}}); $("maskCanvas").addEventListener("pointerleave",()=>{maskPainting=false;$("maskCursor").hidden=true;});
$("maskApply").onclick=applyMaskCorrection; $("maskReset").onclick=resetMaskEditor;
document.querySelectorAll(".background-option").forEach(b=>b.onclick=()=>updateBackgroundMode(b.dataset.background));
$("shadowToggle").onchange=e=>{pushState();shadowEnabled=e.target.checked;renderBackgroundComposite();};
$("shadowStrength").oninput=e=>{pushState();$("shadowValue").textContent=`${e.target.value}%`;shadowStrength=Number(e.target.value);if(shadowEnabled)renderBackgroundComposite();};
$("blurStrength").oninput=e=>{pushState();$("blurValue").textContent=`${e.target.value} px`;backgroundBlur=Number(e.target.value);if(backgroundMode==="blur"||backgroundMode==="custom")renderBackgroundComposite();};
$("customBackgroundButton").onclick=()=>$("customBackgroundInput").click();
$("customBackgroundInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>MAX_SOURCE_MB*1024*1024){showError("That background image is larger than 25 MB. Choose a smaller image.");return;}revoke(customBackgroundUrl);customBackgroundBlob=f;customBackgroundUrl=URL.createObjectURL(f);await updateBackgroundMode("custom");};


function setEditorTool(tool){
  document.querySelectorAll(".studio-tool").forEach(b=>b.classList.toggle("active",b.dataset.editorTool===tool));
  const drawer=$("toolDrawer"), panels={effects:$("effectsPanel"),adjust:$("adjustPanel"),design:$("designPanel")};
  Object.values(panels).forEach(p=>p?.classList.add("hidden"));
  if(tool==="cutout"){ $("advancedMask").open=true; drawer.classList.add("hidden"); $("advancedMask").scrollIntoView({behavior:"smooth",block:"nearest"}); return; }
  if(tool==="background"){ $("advancedBackground").open=true; drawer.classList.add("hidden"); $("advancedBackground").scrollIntoView({behavior:"smooth",block:"nearest"}); return; }
  drawer.classList.remove("hidden"); panels[tool]?.classList.remove("hidden");
}
document.querySelectorAll(".studio-tool").forEach(b=>b.onclick=()=>setEditorTool(b.dataset.editorTool));
$("compareTool").onclick=()=>setPreviewMode("split");
$("undoTool").onclick=()=>stateHistory.length>1?undoState():undoMask(); $("redoTool").onclick=()=>stateRedo.length?redoState():redoMask(); stateHistory=[snapshotState()]; updateHistoryButtons();
function updateAdjust(){ updateAdjustLabels(); renderBackgroundComposite(); }
$("brightnessControl").setAttribute("aria-label","Brightness");$("contrastControl").setAttribute("aria-label","Contrast");$("saturationControl").setAttribute("aria-label","Saturation");$("brushSize").setAttribute("aria-label","Brush size");$("edgeSoftness").setAttribute("aria-label","Edge softness");$("brightnessControl").oninput=e=>{pushState();adjustBrightness=Number(e.target.value);updateAdjust();};
$("contrastControl").oninput=e=>{pushState();adjustContrast=Number(e.target.value);updateAdjust();};
$("saturationControl").oninput=e=>{pushState();adjustSaturation=Number(e.target.value);updateAdjust();};
$("resetAdjust").onclick=()=>{adjustBrightness=adjustContrast=adjustSaturation=100;["brightnessControl","contrastControl","saturationControl"].forEach(id=>$(id).value=100);updateAdjust();};
$("effectShadowToggle").onchange=e=>{pushState();$("shadowToggle").checked=e.target.checked;shadowEnabled=e.target.checked;renderBackgroundComposite();};
$("effectShadowStrength").oninput=e=>{pushState();$("shadowStrength").value=e.target.value;shadowStrength=Number(e.target.value);$("effectShadowValue").textContent=e.target.value+"%";if(shadowEnabled)renderBackgroundComposite();};
$("effectBlurStrength").oninput=e=>{$("blurStrength").value=e.target.value;backgroundBlur=Number(e.target.value);$("effectBlurValue").textContent=e.target.value+" px";if(backgroundMode==="blur"||backgroundMode==="custom")renderBackgroundComposite();};
document.querySelectorAll(".design-choice").forEach(b=>b.onclick=async()=>{document.querySelectorAll(".design-choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");await updateBackgroundMode(b.dataset.designBg);});
$("batchChoose").onclick=()=>$("batchInput").click();
$("batchInput").onchange=async e=>{
  const files=[...e.target.files].filter(f=>f.type.startsWith("image/")).slice(0,20);
  if(!files.length)return;
  batchQueue=files; batchOutputs=[]; batchMode=true;
  for(let i=0;i<files.length;i++){
    $("processBadge").textContent=`BATCH ${i+1}/${files.length}`;
    await start(files[i]);
    if(resultBlob){ await renderBackgroundComposite(); batchOutputs.push({name:files[i].name,blob:renderedExportBlob||resultBlob}); }
  }
  const zip=new JSZip();
  batchOutputs.forEach(o=>zip.file(o.name.replace(/\.[^.]+$/,"")+".png",o.blob));
  const out=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
  const a=document.createElement("a");a.href=URL.createObjectURL(out);a.download=`cutout-pro-batch-${Date.now()}.zip`;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  batchQueue=[];batchOutputs=[];batchMode=false;e.target.value="";
};
$("presetSelect").onchange=e=>applyPreset(e.target.value);$("savePreset").onclick=savePreset;$("deletePreset").onclick=deletePreset;updatePresetList();
window.addEventListener("keydown",e=>{
  if(e.ctrlKey&&e.key.toLowerCase()==="z"){e.preventDefault();$("undoTool").click();}
  else if(e.ctrlKey&&(e.key.toLowerCase()==="y"||(e.shiftKey&&e.key.toLowerCase()==="z"))){e.preventDefault();$("redoTool").click();}
  else if((e.key==="["||e.key==="]")&&!e.target.matches("input,textarea,select,button")){const r=$("brushSize");r.value=Math.max(+r.min,Math.min(+r.max,+r.value+(e.key==="]"?4:-4)));r.dispatchEvent(new Event("input"));}
  else if(e.code==="Space"&&!e.target.matches("input,textarea,select,button")){e.preventDefault();$("previewImg").style.opacity=".01";}
});
window.addEventListener("keyup",e=>{if(e.code==="Space")$("previewImg").style.opacity="1";});
$("theme").onclick = () => document.documentElement.classList.toggle("dark");
