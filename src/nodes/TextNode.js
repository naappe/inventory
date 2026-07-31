import { Node, NodeTypes } from '../core/Node.js';
import { layoutText } from '../typography/TextLayout.js';

export class TextNode extends Node {
  constructor(options = {}) {
    super(options);
    this.type = 'text';
    this.text = options.text ?? '';
    this.fontFamily = options.fontFamily ?? 'Arial';
    this.fontSize = options.fontSize ?? 32;
    this.fontWeight = options.fontWeight ?? 700;
    this.lineHeight = options.lineHeight ?? 1.25;
    this.textAlign = options.textAlign ?? 'right';
    this.direction = options.direction ?? 'rtl';
    this.color = options.color ?? '#07363a';
    this.maxLines = options.maxLines ?? 8;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.font = `${this.fontWeight} ${this.fontSize}px "${this.fontFamily}", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = this.textAlign;
    ctx.direction = this.direction;

    const lines = layoutText(ctx, this.text, this.width).slice(0, this.maxLines);
    const lineHeight = this.fontSize * this.lineHeight;
    const x = this.textAlign === 'left'
      ? 0
      : this.textAlign === 'center'
        ? this.width / 2
        : this.width;

    lines.forEach((line, index) => {
      ctx.fillText(line, x, index * lineHeight, this.width);
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      text: this.text,
      fontFamily: this.fontFamily,
      fontSize: this.fontSize,
      fontWeight: this.fontWeight,
      lineHeight: this.lineHeight,
      textAlign: this.textAlign,
      direction: this.direction,
      color: this.color,
      maxLines: this.maxLines
    };
  }
}

NodeTypes.set('text', TextNode);
