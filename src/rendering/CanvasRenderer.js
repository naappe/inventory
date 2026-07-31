export class CanvasRenderer {
  constructor(canvas, scene, assetManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D context is unavailable.');

    this.scene = scene;
    this.assetManager = assetManager;
    this.zoom = 1;
    this.dpr = window.devicePixelRatio || 1;
    this.dirty = true;
    this.raf = null;
    this.unsubscribe = null;

    this.bindScene(scene);
    this.resize();
  }

  bindScene(scene) {
    this.unsubscribe?.();
    this.scene = scene;
    this.unsubscribe = scene.on('changed', () => this.markDirty());
    this.resize();
  }

  resize() {
    const maxWidth = Math.max(320, Math.min(window.innerWidth - 650, 1100));
    this.zoom = Math.min(maxWidth / this.scene.width, 0.9);
    const cssWidth = Math.round(this.scene.width * this.zoom);
    const cssHeight = Math.round(this.scene.height * this.zoom);

    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.canvas.width = Math.round(cssWidth * this.dpr);
    this.canvas.height = Math.round(cssHeight * this.dpr);

    this.ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
    this.markDirty();
  }

  markDirty() {
    this.dirty = true;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.render();
    });
  }

  render() {
    if (!this.dirty) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    ctx.save();
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
    this.scene.render(ctx, this.assetManager);
    this.renderSelection(ctx);
    ctx.restore();

    this.dirty = false;
  }

  renderSelection(ctx) {
    const node = this.scene.getSelectedNodes()[0];
    if (!node || node.locked || !node.visible) return;

    const bounds = node.getBounds();
    ctx.save();
    ctx.strokeStyle = '#10a9aa';
    ctx.lineWidth = 2 / this.zoom;
    ctx.setLineDash([6 / this.zoom, 4 / this.zoom]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);

    for (const handle of this.getHandles(node)) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#10a9aa';
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, 7 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  getHandles(node) {
    const b = node.getBounds();
    return [
      { type: 'nw', x: b.x, y: b.y },
      { type: 'ne', x: b.x + b.width, y: b.y },
      { type: 'sw', x: b.x, y: b.y + b.height },
      { type: 'se', x: b.x + b.width, y: b.y + b.height },
      { type: 'rotate', x: b.x + b.width / 2, y: b.y - 30 / this.zoom }
    ];
  }

  hitHandle(node, point) {
    const threshold = 12 / this.zoom;
    return this.getHandles(node).find(handle =>
      Math.hypot(point.x - handle.x, point.y - handle.y) <= threshold
    ) ?? null;
  }

  eventToScene(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / this.zoom,
      y: (event.clientY - rect.top) / this.zoom
    };
  }
}
