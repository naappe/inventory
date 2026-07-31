export class AddNodeCommand {
  constructor(scene, node, parentId = 'root', index = -1) {
    this.scene = scene;
    this.node = node;
    this.parentId = parentId;
    this.index = index;
  }

  execute() {
    this.scene.addNode(this.node, this.parentId, this.index);
  }

  undo() {
    this.scene.removeNode(this.node);
  }
}

export class DeleteNodeCommand {
  constructor(scene, node) {
    this.scene = scene;
    this.node = node;
    this.parent = node.parent;
    this.index = this.parent ? this.parent.children.indexOf(node) : -1;
  }

  execute() {
    this.scene.removeNode(this.node);
  }

  undo() {
    if (!this.parent) return;
    this.parent.addChild(this.node, this.index);
    this.scene.emit('changed');
  }
}

export class TransformNodeCommand {
  constructor(node, before, after, notify = () => {}) {
    this.node = node;
    this.before = structuredClone(before);
    this.after = structuredClone(after);
    this.notify = notify;
  }

  apply(value) {
    Object.assign(this.node, value);
    this.node.markDirty();
    this.notify();
  }

  execute() {
    this.apply(this.after);
  }

  undo() {
    this.apply(this.before);
  }
}

export class UpdatePropertyCommand {
  constructor(node, key, before, after, notify = () => {}) {
    this.node = node;
    this.key = key;
    this.before = before;
    this.after = after;
    this.notify = notify;
  }

  execute() {
    this.node[this.key] = this.after;
    this.node.markDirty();
    this.notify();
  }

  undo() {
    this.node[this.key] = this.before;
    this.node.markDirty();
    this.notify();
  }
}

export class ReorderNodeCommand {
  constructor(scene, node, fromIndex, toIndex) {
    this.scene = scene;
    this.node = node;
    this.parent = node.parent;
    this.fromIndex = fromIndex;
    this.toIndex = toIndex;
  }

  move(index) {
    const children = this.parent.children;
    const current = children.indexOf(this.node);
    if (current >= 0) children.splice(current, 1);
    children.splice(index, 0, this.node);
    children.forEach((child, position) => child.zIndex = position);
    this.parent.markDirty();
    this.scene.emit('changed');
  }

  execute() { this.move(this.toIndex); }
  undo() { this.move(this.fromIndex); }
}
