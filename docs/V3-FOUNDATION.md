# Publisher Studio v3 Foundation

## Mission

Turn editorial content into a professional visual post in under 60 seconds.

## Current foundation

- Quick Mode as the default newsroom workflow
- Studio Mode with progressive disclosure
- NationChat 1080 × 1350 canvas
- Direct photo upload
- Non-destructive photo translation and scaling
- Pointer-centred mouse-wheel zoom
- Pointer and touch-compatible panning
- Fit and reset controls
- Adjustable overlay start and transparency
- Live quote, speaker, source and brand accent editing
- PNG export using the same canvas renderer as the preview

## Engineering rules

1. Templates describe content and layout; shared engines own interaction behavior.
2. Image edits store transforms and never alter the source asset.
3. Preview and export use the same renderer.
4. Quick Mode must remain usable without layers or technical controls.
5. Advanced controls belong in Studio Mode.

## Next work

1. Add pinch zoom with two-pointer distance tracking.
2. Add crop bounds and Fit/Fill presets.
3. Persist the project state in versioned JSON.
4. Add proper Thaana font loading and adaptive text fitting.
5. Convert NationChat rendering into reusable template data and scene nodes.
6. Add automated browser tests for pan, zoom and export dimensions.
