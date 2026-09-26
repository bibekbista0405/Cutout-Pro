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


## Phase 1 Cutout Editor
The result view now includes a non-destructive mask refinement workspace. The AI mask can be inspected, manually corrected with Keep/Remove brush strokes, reset to the original AI mask, and explicitly applied to the enhanced pixels. The existing segmentation and tiled neural reconstruction pipeline remains unchanged.
