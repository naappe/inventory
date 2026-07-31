export function applyConstraints(node, oldSize, newSize) {
  const c = node.constraints ?? {};
  const margins = c.margins ?? {};
  const left = margins.left ?? node.x;
  const top = margins.top ?? node.y;
  const right = margins.right ?? (oldSize.width - node.x - node.width);
  const bottom = margins.bottom ?? (oldSize.height - node.y - node.height);

  switch (c.horizontal) {
    case 'center':
      node.x = newSize.width / 2;
      break;
    case 'right':
      node.x = newSize.width - right;
      break;
    case 'stretch':
      node.x = left;
      node.width = Math.max(1, newSize.width - left - right);
      break;
    default:
      node.x = left;
  }

  switch (c.vertical) {
    case 'center':
      node.y = newSize.height / 2;
      break;
    case 'bottom':
      node.y = newSize.height - bottom;
      break;
    case 'stretch':
      node.y = top;
      node.height = Math.max(1, newSize.height - top - bottom);
      break;
    default:
      node.y = top;
  }

  node.markDirty();
}

export function resizeSceneWithConstraints(scene, width, height) {
  const oldSize = { width: scene.width, height: scene.height };
  const newSize = { width, height };

  for (const node of scene.root.children) {
    applyConstraints(node, oldSize, newSize);
  }

  scene.width = width;
  scene.height = height;
  scene.root.width = width;
  scene.root.height = height;
  scene.root.markDirty();
  scene.emit('changed');
}
