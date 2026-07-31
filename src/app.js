import './nodes/GroupNode.js';
import './nodes/ShapeNode.js';
import './nodes/TextNode.js';
import './nodes/ImageNode.js';

import { StudioDocument } from './document/Document.js';
import { Scene } from './core/Scene.js';
import { Node } from './core/Node.js';
import { AssetManager } from './assets/AssetManager.js';
import { CanvasRenderer } from './rendering/CanvasRenderer.js';
import { ExportRenderer } from './rendering/ExportRenderer.js';
import { CommandManager } from './commands/CommandManager.js';
import {
  DeleteNodeCommand,
  ReorderNodeCommand,
  UpdatePropertyCommand,
  AddNodeCommand
} from './commands/Commands.js';
import { SelectTool } from './interaction/SelectTool.js';
import { TemplateManager } from './templates/TemplateManager.js';
import { resizeSceneWithConstraints } from './core/ConstraintResolver.js';

const canvas = document.querySelector('#studioCanvas');
const assets = new AssetManager();
let documentModel = new StudioDocument({
  scene: TemplateManager.createScene('photo-left-text-right')
});

const renderer = new CanvasRenderer(canvas, documentModel.scene, assets);
const commands = new CommandManager(() => {
  documentModel.scene.emit('changed');
  renderLayers();
  renderInspector();
});
const selectTool = new SelectTool(renderer, documentModel.scene, commands);

function setStatus(message) {
  document.querySelector('#status').textContent = message;
}

function replaceScene(scene) {
  documentModel.replaceScene(scene);
  renderer.bindScene(scene);
  selectTool.bindScene(scene);
  commands.clear();
  scene.on('selectionChanged', () => {
    renderLayers();
    renderInspector();
  });
  renderLayers();
  renderInspector();
  setStatus('Scene loaded');
}

function activeNode() {
  return documentModel.scene.getSelectedNodes()[0] ?? null;
}

function renderLayers() {
  const list = document.querySelector('#layerList');
  const nodes = [...documentModel.scene.root.children].sort((a, b) => b.zIndex - a.zIndex);
  list.innerHTML = '';

  for (const node of nodes) {
    const item = document.createElement('div');
    item.className = `layer-item ${activeNode()?.id === node.id ? 'active' : ''}`;
    item.innerHTML = `<span>${node.name}<br><small>${node.type}</small></span><span>${node.visible ? '◉' : '○'}</span><span>${node.locked ? '🔒' : ''}</span>`;
    item.onclick = () => documentModel.scene.selectOnly(node);
    list.appendChild(item);
  }
}

const inspectorFields = {
  name: document.querySelector('#nodeName'),
  x: document.querySelector('#nodeX'),
  y: document.querySelector('#nodeY'),
  width: document.querySelector('#nodeWidth'),
  height: document.querySelector('#nodeHeight'),
  rotation: document.querySelector('#nodeRotation'),
  opacity: document.querySelector('#nodeOpacity')
};

function renderInspector() {
  const node = activeNode();
  document.querySelector('#emptyInspector').hidden = Boolean(node);
  document.querySelector('#nodeInspector').hidden = !node;
  document.querySelector('#textControls').hidden = node?.type !== 'text';
  if (!node) return;

  inspectorFields.name.value = node.name;
  inspectorFields.x.value = Math.round(node.x);
  inspectorFields.y.value = Math.round(node.y);
  inspectorFields.width.value = Math.round(node.width);
  inspectorFields.height.value = Math.round(node.height);
  inspectorFields.rotation.value = Math.round(node.rotation);
  inspectorFields.opacity.value = node.opacity;

  if (node.type === 'text') {
    document.querySelector('#nodeText').value = node.text;
    document.querySelector('#fontSize').value = node.fontSize;
    document.querySelector('#textAlign').value = node.textAlign;
  }
}

function bindProperty(field, key, parser = value => value) {
  field.addEventListener('change', () => {
    const node = activeNode();
    if (!node) return;
    const before = node[key];
    const after = parser(field.value);
    if (before === after) return;
    commands.execute(new UpdatePropertyCommand(
      node,
      key,
      before,
      after,
      () => documentModel.scene.emit('changed')
    ));
  });
}

bindProperty(inspectorFields.name, 'name', String);
bindProperty(inspectorFields.x, 'x', Number);
bindProperty(inspectorFields.y, 'y', Number);
bindProperty(inspectorFields.width, 'width', Number);
bindProperty(inspectorFields.height, 'height', Number);
bindProperty(inspectorFields.rotation, 'rotation', Number);
bindProperty(inspectorFields.opacity, 'opacity', Number);
bindProperty(document.querySelector('#nodeText'), 'text', String);
bindProperty(document.querySelector('#fontSize'), 'fontSize', Number);
bindProperty(document.querySelector('#textAlign'), 'textAlign', String);

document.querySelector('#applyTemplate').onclick = () => {
  const id = document.querySelector('#templateSelect').value;
  const currentPhoto = documentModel.scene.findById('photo')?.assetId ?? null;
  replaceScene(TemplateManager.createScene(id, currentPhoto));
};

document.querySelector('#imageUpload').onchange = async event => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const asset = await assets.addImageFile(file);
    let imageNode = documentModel.scene.root.children.find(node => node.type === 'image');

    if (imageNode) {
      commands.execute(new UpdatePropertyCommand(
        imageNode,
        'assetId',
        imageNode.assetId,
        asset.id,
        () => documentModel.scene.emit('changed')
      ));
    } else {
      imageNode = Node.fromJSON({
        id: crypto.randomUUID(),
        type: 'image',
        name: 'Photo',
        x: 0,
        y: 0,
        width: documentModel.scene.width,
        height: documentModel.scene.height,
        originX: 0,
        originY: 0,
        zIndex: 0,
        assetId: asset.id,
        children: []
      });
      commands.execute(new AddNodeCommand(documentModel.scene, imageNode));
    }

    setStatus('Photo added');
  } catch (error) {
    setStatus(error.message);
  }
};

document.querySelector('#deleteNode').onclick = () => {
  const node = activeNode();
  if (node) commands.execute(new DeleteNodeCommand(documentModel.scene, node));
};

document.querySelector('#duplicateNode').onclick = () => {
  const node = activeNode();
  if (!node) return;
  const cloneData = node.toJSON();
  cloneData.id = crypto.randomUUID();
  cloneData.name = `${cloneData.name} copy`;
  cloneData.x += 24;
  cloneData.y += 24;
  const clone = Node.fromJSON(cloneData);
  commands.execute(new AddNodeCommand(documentModel.scene, clone));
  documentModel.scene.selectOnly(clone);
};

document.querySelector('#bringForward').onclick = () => {
  const node = activeNode();
  if (!node?.parent) return;
  const from = node.parent.children.indexOf(node);
  const to = Math.min(node.parent.children.length - 1, from + 1);
  if (from !== to) commands.execute(new ReorderNodeCommand(documentModel.scene, node, from, to));
};

document.querySelector('#sendBackward').onclick = () => {
  const node = activeNode();
  if (!node?.parent) return;
  const from = node.parent.children.indexOf(node);
  const to = Math.max(0, from - 1);
  if (from !== to) commands.execute(new ReorderNodeCommand(documentModel.scene, node, from, to));
};

document.querySelector('#toggleLock').onclick = () => {
  const node = activeNode();
  if (node) commands.execute(new UpdatePropertyCommand(node, 'locked', node.locked, !node.locked, () => documentModel.scene.emit('changed')));
};

document.querySelector('#toggleVisibility').onclick = () => {
  const node = activeNode();
  if (node) commands.execute(new UpdatePropertyCommand(node, 'visible', node.visible, !node.visible, () => documentModel.scene.emit('changed')));
};

document.querySelector('#undo').onclick = () => commands.undo();
document.querySelector('#redo').onclick = () => commands.redo();

document.querySelector('#formatSelect').onchange = event => {
  const [width, height] = event.target.value.split('x').map(Number);
  resizeSceneWithConstraints(documentModel.scene, width, height);
  renderer.resize();
  renderInspector();
};

document.querySelector('#exportPng').onclick = async () => {
  try {
    await ExportRenderer.exportPNG(documentModel.scene, assets);
    setStatus('PNG exported');
  } catch (error) {
    setStatus(error.message);
  }
};

document.querySelector('#saveProject').onclick = () => {
  const blob = new Blob([JSON.stringify(documentModel.toJSON(assets), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'naappe-project.json';
  link.click();
  URL.revokeObjectURL(url);
};

document.querySelector('#loadProject').onchange = async event => {
  try {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    await assets.loadJSON(data.assets ?? []);
    documentModel = new StudioDocument({
      id: data.id,
      name: data.name,
      scene: Scene.fromJSON(data.scene)
    });
    replaceScene(documentModel.scene);
    setStatus('Project loaded');
  } catch (error) {
    setStatus(`Load failed: ${error.message}`);
  }
};

document.querySelector('#newDocument').onclick = () => {
  replaceScene(TemplateManager.createScene('photo-left-text-right'));
};

document.addEventListener('keydown', event => {
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    event.shiftKey ? commands.redo() : commands.undo();
  }
  if (modifier && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    document.querySelector('#duplicateNode').click();
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') &&
      !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
    document.querySelector('#deleteNode').click();
  }
});

window.addEventListener('resize', () => renderer.resize());
replaceScene(documentModel.scene);
