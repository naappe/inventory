export class AssetManager {
  constructor() {
    this.assets = new Map();
  }

  get(id) {
    return this.assets.get(id) ?? null;
  }

  async addImageFile(file, id = crypto.randomUUID()) {
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      throw new TypeError('Please choose a valid image file.');
    }

    const dataUrl = await this.fileToDataUrl(file);
    return this.addImageDataUrl(id, dataUrl);
  }

  async addImageDataUrl(id, dataUrl) {
    const image = await this.loadImage(dataUrl);
    const asset = {
      id,
      type: 'image',
      source: dataUrl,
      data: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    };
    this.assets.set(id, asset);
    return asset;
  }

  loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image could not be loaded.'));
      image.src = source;
    });
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
      reader.readAsDataURL(file);
    });
  }

  toJSON() {
    return [...this.assets.values()].map(asset => ({
      id: asset.id,
      type: asset.type,
      source: asset.source,
      width: asset.width,
      height: asset.height
    }));
  }

  async loadJSON(assets = []) {
    this.assets.clear();
    for (const asset of assets) {
      if (asset.type === 'image') {
        await this.addImageDataUrl(asset.id, asset.source);
      }
    }
  }
}
