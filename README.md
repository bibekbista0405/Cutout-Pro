# ClearCut Pro

Liquid-glass, local-first AI image restoration and background removal.

## What changed in this build

- Liquid-glass UI is now more transparent, layered, reflective and tactile, with restrained neumorphic depth.
- The hero typography uses a custom moving liquid-metal/chrome gradient instead of the generic purple AI gradient.
- Real Swin2SR neural super-resolution remains the enhancement engine; the app does not call canvas interpolation AI.
- Large source images are normalized to a controlled 1024px maximum working edge before heavy inference to prevent browser memory crashes.
- A 30 MP safety ceiling and 25 MB file ceiling prevent pathological inputs.
- Only one processing job can run at a time, preventing accidental concurrent model execution.
- Processing yields to the browser between expensive stages so the interface can repaint and remain interactive.
- The fake timed edge-refinement delay was removed. The edge stage now performs actual alpha-mask resampling.
- Errors stay visible with a safe retry path instead of silently dropping the user back to the upload screen.
- 4× export performs another real Swin2SR pass and blocks exports that would exceed the safe pixel budget.
- Original images remain available for comparison while enhanced results use the AI-generated pixels and refined transparency.

## Run

```bash
npm install
npm run dev
```

The first AI run can take longer because model assets are downloaded and cached by the browser.
