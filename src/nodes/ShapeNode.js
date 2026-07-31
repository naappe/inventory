import { Node, NodeTypes } from '../core/Node.js';

export class ShapeNode extends Node {
  constructor(options = {}) {
    super(options);
    this.type = 'shape';
    this.fill = options.fill ?? '#ffffff';
    this.stroke = options.stroke ?? null;
    this.strokeWidth = options.strokeWidth ?? 1;
    this.radius = options.radius ?? 0;
  }

  draw(ctx) {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(0, 0, this.width, this.height, this.radius);
    } else {
      ctx.rect(0, 0, this.width, this.height);
    }

    if (this.fill) {
      ctx.fillStyle = this.fill;
      ctx.fill();
    }
    if (this.stroke) {
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = this.strokeWidth;
      ctx.stroke();
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fill: this.fill,
      stroke: this.stroke,
      strokeWidth: this.strokeWidth,
      radius: this.radius
    };
  }
}

NodeTypes.set('shape', ShapeNode);
