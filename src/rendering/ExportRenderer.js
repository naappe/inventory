export class ExportRenderer {
  static async exportPNG(scene, assetManager, filename = 'naappe-design.png', scale = 2) {
    await document.fonts.ready;

    const canvas = document.createElement('canvas');
    canvas.width = scene.width * scale;
    canvas.height = scene.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Export canvas context is unavailable.');

    ctx.scale(scale, scale);
    scene.render(ctx, assetManager);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG export failed.')), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
