function breakLongToken(ctx, token, maxWidth) {
  const chunks = [];
  let current = '';

  for (const character of [...token]) {
    const candidate = current + character;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function layoutText(ctx, text, maxWidth) {
  const paragraphs = String(text ?? '').split(/\r?\n/);
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let current = '';

    for (const word of words) {
      const parts = ctx.measureText(word).width > maxWidth
        ? breakLongToken(ctx, word, maxWidth)
        : [word];

      for (const part of parts) {
        const candidate = current ? `${current} ${part}` : part;
        if (current && ctx.measureText(candidate).width > maxWidth) {
          lines.push(current);
          current = part;
        } else {
          current = candidate;
        }
      }
    }

    if (current) lines.push(current);
  }

  return lines;
}
