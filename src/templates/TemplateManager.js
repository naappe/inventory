import { Scene } from '../core/Scene.js';
import { Node } from '../core/Node.js';
import { templates } from './templates.js';

export class TemplateManager {
  static createScene(templateId, assetId = null) {
    const template = templates[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const scene = new Scene(template.canvas);
    for (const definition of template.nodes) {
      const data = structuredClone(definition);
      if (data.type === 'image') data.assetId = assetId;
      scene.addNode(Node.fromJSON({ ...data, children: [] }));
    }
    scene.selectedIds = [];
    return scene;
  }
}
