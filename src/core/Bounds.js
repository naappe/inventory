import { worldMatrix, transformPoint } from './Matrix.js';

export function getTransformedCorners(node) {
  const matrix = worldMatrix(node);
  return [
    transformPoint(matrix, 0, 0),
    transformPoint(matrix, node.width, 0),
    transformPoint(matrix, node.width, node.height),
    transformPoint(matrix, 0, node.height)
  ];
}

export function boundsFromCorners(corners) {
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    corners
  };
}

export function getNodeBounds(node) {
  return boundsFromCorners(getTransformedCorners(node));
}
