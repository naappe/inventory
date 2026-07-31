import { Node, NodeTypes } from '../core/Node.js';

export class GroupNode extends Node {
  constructor(options = {}) {
    super(options);
    this.type = 'group';
    this.clip = options.clip ?? false;
  }

  draw(ctx) {
    if (!this.clip) return;
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();
  }

  toJSON() {
    return { ...super.toJSON(), clip: this.clip };
  }
}

NodeTypes.set('group', GroupNode);
