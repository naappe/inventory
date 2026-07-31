import { GroupNode } from '../nodes/GroupNode.js';
import { Node } from './Node.js';

export class Scene {
  constructor(options = {}) {
    this.width = options.width ?? 1200;
    this.height = options.height ?? 675;
    this.backgroundColor = options.backgroundColor ?? '#ffffff';
    this.root = new GroupNode({
      id: 'root',
      name: 'Root',
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      originX: 0,
      originY: 0,
      selectable: false,
      locked: true
    });
    this.selectedIds = [];
    this.listeners = new Map();
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(callback);
    return () => this.listeners.get(eventName)?.delete(callback);
  }

  emit(eventName, payload) {
    for (const callback of this.listeners.get(eventName) ?? []) callback(payload);
  }

  addNode(node, parentId = 'root', index = -1) {
    const parent = this.findById(parentId);
    if (!parent) throw new Error(`Parent not found: ${parentId}`);
    parent.addChild(node, index);
    this.emit('changed');
    return node;
  }

  removeNode(node) {
    if (!node?.parent) return -1;
    const index = node.parent.removeChild(node);
    this.selectedIds = this.selectedIds.filter(id => id !== node.id);
    this.emit('changed');
    this.emit('selectionChanged');
    return index;
  }

  findById(id) {
    return this.root.findById(id);
  }

  getSelectedNodes() {
    return this.selectedIds.map(id => this.findById(id)).filter(Boolean);
  }

  selectOnly(node) {
    this.selectedIds = node ? [node.id] : [];
    this.emit('selectionChanged');
    this.emit('changed');
  }

  getNodesAtPoint(point) {
    const hits = [];

    const visit = node => {
      const ordered = [...node.children].sort((a, b) => b.zIndex - a.zIndex);
      for (const child of ordered) visit(child);

      if (node !== this.root &&
          node.visible &&
          node.selectable &&
          node.containsPoint(point)) {
        hits.push(node);
      }
    };

    visit(this.root);
    return hits;
  }

  render(ctx, assetManager) {
    if (this.backgroundColor && this.backgroundColor !== 'transparent') {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    this.root.sortChildren();
    for (const child of this.root.children) child.render(ctx, assetManager);
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor,
      root: this.root.toJSON()
    };
  }

  static fromJSON(data) {
    const scene = new Scene(data);
    scene.root = Node.fromJSON(data.root);
    scene.root.parent = null;
    scene.selectedIds = [];
    return scene;
  }
}
