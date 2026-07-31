export function identityMatrix() {
  return new DOMMatrix();
}

export function localMatrix(node) {
  const originX = node.width * node.originX;
  const originY = node.height * node.originY;

  return new DOMMatrix()
    .translate(node.x, node.y)
    .rotate(node.rotation)
    .scale(node.scaleX, node.scaleY)
    .translate(-originX, -originY);
}

export function worldMatrix(node) {
  const local = localMatrix(node);
  return node.parent ? worldMatrix(node.parent).multiply(local) : local;
}

export function transformPoint(matrix, x, y) {
  const p = new DOMPoint(x, y).matrixTransform(matrix);
  return { x: p.x, y: p.y };
}

export function inverseTransformPoint(matrix, point) {
  const p = new DOMPoint(point.x, point.y).matrixTransform(matrix.inverse());
  return { x: p.x, y: p.y };
}
