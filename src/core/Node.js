import { getNodeBounds } from './Bounds.js';
import { worldMatrix, inverseTransformPoint } from './Matrix.js';

export const NodeTypes = new Map();

export class Node {
  constructor(options = {}) {
    this.id = options.id ?? crypto.randomUUID();
    this.type = options.type ?? 'node';
    this.name = options.name ?? 'Node';

    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.width = options.width ?? 100;
    this.height = options.height ?? 100;
    this.rotation = options.rotation ?? 0;
    this.scaleX = options.scaleX ?? 1;
    this.scaleY = options.scaleY ?? 1;
    this.originX = options.originX ?? 0.5;
    this.originY = options.originY ?? 0.5;

    this.opacity = options.opacity ?? 1;
    this.visible = options.visible ?? true;
    this.locked = options.locked ?? false;
    this.selectable = options.selectable ?? true;
    this.zIndex = options.zIndex ?? 0;
    this.constraints = structuredClone(options.constraints ?? {});

    this.parent = null;
    this.children = [];

    this._boundsDirty = true;
    this._cachedBounds = null;
  }

  addChild(child, index = -1) {
    if (!(child instanceof Node)) {
      throw new TypeError('Child must be a Node');
    }
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    index < 0 ? this.children.push(child) : this.children.splice(index, 0, child);
    this.sortChildren();
    child.markDirty();
    this.markBoundsDirtyUpward();
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index < 0) return -1;
    this.children.splice(index, 1);
    child.parent = null;
    this.markBoundsDirtyUpward();
    return index;
  }

  sortChildren() {
    this.children.sort((a, b) => a.zIndex - b.zIndex);
  }

  findById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }

  markDirty() {
    this._boundsDirty = true;
    for (const child of this.children) child.markDirty();
    this.markBoundsDirtyUpward();
  }

  markBoundsDirtyUpward() {
    let current = this;
    while (current) {
      current._boundsDirty = true;
      current = current.parent;
    }
  }

  getBounds() {
    if (this._boundsDirty || !this._cachedBounds) {
      this._cachedBounds = getNodeBounds(this);
      this._boundsDirty = false;
    }
    return this._cachedBounds;
  }

  containsPoint(worldPoint) {
    if (!this.visible || !this.selectable) return false;
    try {
      const local = inverseTransformPoint(worldMatrix(this), worldPoint);
      return local.x >= 0 && local.x <= this.width &&
             local.y >= 0 && local.y <= this.height;
    } catch {
      return false;
    }
  }

  render(ctx, assetManager) {
    if (!this.visible) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(-this.width * this.originX, -this.height * this.originY);
    ctx.globalAlpha *= this.opacity;

    this.draw(ctx, assetManager);

    this.sortChildren();
    for (const child of this.children) {
      child.render(ctx, assetManager);
    }

    ctx.restore();
  }

  draw() {}

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      originX: this.originX,
      originY: this.originY,
      opacity: this.opacity,
      visible: this.visible,
      locked: this.locked,
      selectable: this.selectable,
      zIndex: this.zIndex,
      constraints: structuredClone(this.constraints),
      children: this.children.map(child => child.toJSON())
    };
  }

  static fromJSON(data) {
    const NodeClass = NodeTypes.get(data.type) ?? Node;
    const node = new NodeClass(data);
    for (const childData of data.children ?? []) {
      node.addChild(Node.fromJSON(childData));
    }
    return node;
  }
}
