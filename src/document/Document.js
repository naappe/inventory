import { Scene } from '../core/Scene.js';

export class StudioDocument {
  constructor(options = {}) {
    this.id = options.id ?? crypto.randomUUID();
    this.name = options.name ?? 'Untitled';
    this.scene = options.scene ?? new Scene();
  }

  replaceScene(scene) {
    this.scene = scene;
  }

  toJSON(assetManager) {
    return {
      version: 1,
      id: this.id,
      name: this.name,
      scene: this.scene.toJSON(),
      assets: assetManager.toJSON()
    };
  }
}
