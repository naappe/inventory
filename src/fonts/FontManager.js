export class FontManager {
  constructor(){this.fonts=[]}
  async addFile(file){
    const buffer=await file.arrayBuffer();
    const family=`Custom ${file.name.replace(/\.[^.]+$/,'').replace(/[^\w -]/g,'')}`;
    const face=new FontFace(family,buffer); await face.load(); document.fonts.add(face);
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const item={family,name:file.name,data}; this.fonts.push(item); return item;
  }
  async loadJSON(items=[]){for(const item of items){try{const face=new FontFace(item.family,`url(${item.data})`);await face.load();document.fonts.add(face);this.fonts.push(item)}catch{}}}
  toJSON(){return this.fonts}
}
