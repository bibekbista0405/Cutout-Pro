# Cutout Pro

A local-first AI image cutout and neural enhancement web app.

## What it does

- AI background segmentation
- Genuine 2× neural super-resolution with Swin2SR
- Small-tile inference to reduce peak browser memory
- Transparent PNG output
- Original / enhanced / compare preview
- Liquid-glass interface
- Browser-local processing

## Stability design

Heavy neural reconstruction is never run on the complete working frame at once. Images are normalized to a conservative 768px maximum edge and processed in 256px tiles. The UI yields between tiles and 4× browser export is intentionally disabled because repeated browser-side neural inference can overwhelm a laptop.

## Development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm run preview
```


## Reliability architecture

- Source images are decoded and validated before model execution.
- Working images are capped to a conservative 768px maximum edge.
- Background removal uses the quantized ISNet mask model through a worker.
- Swin2SR reconstruction runs in a dedicated module worker, never on the page thread.
- Neural reconstruction is tiled; capable devices can use a modest 288px tile budget, while unknown/low-memory devices stay at 256px.
- A tile/model watchdog reports fatal timeouts and terminates the worker so a timed-out inference cannot continue consuming resources in the background.
- Canceling a job invalidates its token, terminates the neural worker, releases object URLs, and prevents a replacement job from overlapping the still-running async pipeline.
- The application releases canvases, image bitmaps, blobs, timers, workers, and preview URLs during cleanup.
- Export is limited to the real 2× result. 4× is not presented as a fake browser resize.
- PNG preserves transparency; WebP is available when a smaller transparent export is preferred.
- Theme preference is persisted locally.

## Current browser-safe limits

The app intentionally favors predictable browser behavior over maximum theoretical resolution. Neural reconstruction is expensive, and client-side super-resolution cannot recreate missing photographic information with certainty.
