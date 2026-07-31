import { Node, NodeTypes } from '../core/Node.js';

export class ImageNode extends Node {
  constructor(options = {}) {
    super(options);
    this.type = 'image';
    this.assetId = options.assetId ?? null;
    this.objectFit = options.objectFit ?? 'cover';
    this.brightness = options.brightness ?? 1;
    this.contrast = options.contrast ?? 1;
  }

  draw(ctx, assetManager) {
    const asset = this.assetId ? assetManager.get(this.assetId) : null;
    const image = asset?.data;
    if (!image) {
      ctx.fillStyle = '#dfe8e8';
      ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.clip();
    ctx.filter = `brightness(${this.brightness}) contrast(${this.contrast})`;

    const imageRatio = image.width / image.height;
    const nodeRatio = this.width / this.height;

    let sx = 0, sy = 0, sw = image.width, sh = image.height;
    let dx = 0, dy = 0, dw = this.width, dh = this.height;

    if (this.objectFit === 'cover') {
      if (imageRatio > nodeRatio) {
        sw = image.height * nodeRatio;
        sx = (image.width - sw) / 2;
      } else {
        sh = image.width / nodeRatio;
        sy = (image.height - sh) / 2;
      }
    } else {
      if (imageRatio > nodeRatio) {
        dh = this.width / imageRatio;
        dy = (this.height - dh) / 2;
      } else {
        dw = this.height * imageRatio;
        dx = (this.width - dw) / 2;
      }
    }

    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  }

  toJSON() {
    return {
      ...super.toJSON(),
      assetId: this.assetId,
      objectFit: this.objectFit,
      brightness: this.brightness,
      contrast: this.contrast
    };
  }
}

NodeTypes.set('image', ImageNode);
