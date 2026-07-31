import { TransformNodeCommand } from '../commands/Commands.js';

function transformSnapshot(node) {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    scaleX: node.scaleX,
    scaleY: node.scaleY
  };
}

export class SelectTool {
  constructor(renderer, scene, commands) {
    this.renderer = renderer;
    this.scene = scene;
    this.commands = commands;
    this.drag = null;

    const canvas = renderer.canvas;
    canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    canvas.addEventListener('pointermove', event => this.pointerMove(event));
    canvas.addEventListener('pointerup', event => this.pointerUp(event));
    canvas.addEventListener('pointercancel', event => this.pointerUp(event));
  }

  bindScene(scene) {
    this.scene = scene;
    this.drag = null;
  }

  pointerDown(event) {
    const point = this.renderer.eventToScene(event);
    const selected = this.scene.getSelectedNodes()[0];
    const handle = selected ? this.renderer.hitHandle(selected, point) : null;

    let node = selected;
    let mode = handle?.type ?? null;

    if (!handle) {
      node = this.scene.getNodesAtPoint(point)[0] ?? null;
      this.scene.selectOnly(node);
      mode = node ? 'move' : null;
    }

    if (!node || node.locked || !mode) return;

    this.drag = {
      node,
      mode,
      startPoint: point,
      start: transformSnapshot(node),
      startAngle: Math.atan2(point.y - node.y, point.x - node.x)
    };

    this.renderer.canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  pointerMove(event) {
    if (!this.drag) return;
    const point = this.renderer.eventToScene(event);
    const { node, mode, startPoint, start } = this.drag;
    const dx = point.x - startPoint.x;
    const dy = point.y - startPoint.y;

    if (mode === 'move') {
      node.x = start.x + dx;
      node.y = start.y + dy;
    } else if (mode === 'rotate') {
      const angle = Math.atan2(point.y - node.y, point.x - node.x);
      node.rotation = start.rotation + (angle - this.drag.startAngle) * 180 / Math.PI;
    } else {
      const horizontal = mode.includes('e') ? dx : -dx;
      const vertical = mode.includes('s') ? dy : -dy;
      node.width = Math.max(20, start.width + horizontal);
      node.height = Math.max(20, start.height + vertical);
    }

    node.markDirty();
    this.scene.emit('changed');
  }

  pointerUp() {
    if (!this.drag) return;
    const { node, start } = this.drag;
    const after = transformSnapshot(node);
    this.drag = null;

    if (JSON.stringify(start) !== JSON.stringify(after)) {
      this.commands.commitExecuted(new TransformNodeCommand(
        node,
        start,
        after,
        () => this.scene.emit('changed')
      ));
    }
  }
}
