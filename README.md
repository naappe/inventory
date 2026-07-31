# Naappe Publisher Studio v2

A rebuilt, static browser editor focused on high-fidelity Dhivehi editorial quote graphics.

## What changed

- Reference-inspired editorial quote template
- Landscape, square, and portrait variants
- Custom `.ttf`, `.otf`, `.woff`, and `.woff2` font upload
- Custom fonts embedded in saved project JSON
- RTL/Thaana text controls: family, weight, line height, alignment, and color
- Portrait upload, crop zoom, brightness, contrast, rounded corners, and soft shadow
- Browser-based white/light background removal with threshold and feather controls
- Original/cutout switching
- Transparent canvas export
- Lockable brand and date layers
- Layer selection, move, resize, rotate, visibility, ordering, undo, and redo
- PNG export and versioned project save/load

## Run

This project uses ES modules and must be served over HTTP.

```bash
python -m http.server 8080
```

Open `http://localhost:8080`.

## Important font note

No proprietary font file is bundled. Upload the exact font used by your publication through the Typography panel. The uploaded font is stored in project JSON so it can reload with the project.

## Background removal scope

The included remover works locally in the browser and targets white/light backgrounds. It is not a full AI person segmentation model. The code is intentionally isolated in `src/image/BackgroundRemover.js` so an external AI provider can replace it later.

## GitHub Pages

Copy the contents of this folder to the root of your GitHub Pages repository. `index.html` must remain at the repository root.
