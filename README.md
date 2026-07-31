# Naappe Publisher Studio — Corrected Starter

A minimal browser-based scene-graph editor focused on Dhivehi news graphics.

## Included

- Local recursive transforms
- World-matrix hit testing
- Transformed-corner bounds
- Scene selection
- Move, resize, rotate
- Layer order
- Lock and visibility
- Command-based undo/redo
- Central asset manager
- Dhivehi/RTL canvas text
- Four JSON-style templates
- Constraint-aware canvas resizing
- Project JSON save/load
- Preview-matched PNG export

## Run

ES modules require a local web server.

### Python

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### VS Code

Use the Live Server extension and open `index.html`.

## Important scope notes

This is a v1 core, not a complete Canva replacement.

The resize handles currently resize the axis-aligned node dimensions. Precise rotated-handle geometry and group editing are suitable next steps.

Custom Dhivehi fonts are not bundled. The browser will use locally available fonts and then fall back to Arial/sans-serif.
