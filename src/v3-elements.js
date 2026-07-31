const $=s=>document.querySelector(s),base=$('#publisherCanvas'),overlay=$('#elementCanvas'),ctx=overlay.getContext('2d');
let elements=[],selectedId=null,drag=null,history=[],future=[];
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const selected=()=>elements.find(e=>e.id===selectedId)||null;
const clone=v=>JSON.parse(JSON.stringify(v));
const fieldValue=id=>$('#'+id)?.value||'';
const accent=()=>$('#accent')?.value||'#168f87';
const template=()=>document.querySelector('[data-template].active')?.dataset.template||'nationchat';
function textElement(sourceKey,label,x,y,w,h,fontSize,weight,color,opts={}){return{id:uid(),type:'text',builtIn:true,sourceKey,label,text:fieldValue(sourceKey),x,y,w,h,fontSize,weight,color,rotation:0,align:opts.align||'center',font:opts.font||'thaana'}}
function templateElements(name){const w=base.width,h=base.height,a=accent(),dark='#172033',white='#ffffff';
 if(name==='interview')return[
  textElement('quote','Quote',w*.77,h*.39,w*.37,h*.55,58,700,dark),
  textElement('speaker','Speaker',w*.77,h*.82,w*.36,90,40,700,a),
  textElement('role','Role / category',w*.77,h*.865,w*.34,60,26,600,'#667085',{font:'latin'}),
  textElement('source','Source',105,h-50,180,55,25,700,dark,{font:'latin'}),
  {id:uid(),type:'text',builtIn:true,sourceKey:'brandName',label:'Logo',text:fieldValue('brandName')||'naappe',x:w-115,y:h-52,w:210,h:65,fontSize:38,weight:800,color:a,rotation:0,font:'latin',align:'center'}
 ];
 if(name==='breaking')return[
  textElement('role','Role / category',180,82,300,70,46,800,white,{font:'latin'}),
  textElement('headline','Headline',w/2,h*.49,w*.84,h*.38,90,800,white,{font:'auto'}),
  textElement('quote','Quote',w/2,h*.82,w*.82,150,34,600,white),
  textElement('source','Source',105,h-50,180,55,25,700,white,{font:'latin'}),
  {id:uid(),type:'text',builtIn:true,sourceKey:'brandName',label:'Logo',text:fieldValue('brandName')||'naappe',x:w-115,y:h-52,w:210,h:65,fontSize:38,weight:800,color:a,rotation:0,font:'latin',align:'center'}
 ];
 if(name==='statement')return[
  textElement('quote','Quote',w/2,h*.49,w*.72,h*.58,72,700,dark),
  textElement('speaker','Speaker',w/2,h-190,w*.72,80,36,700,a),
  textElement('source','Source',105,h-50,180,55,25,700,dark,{font:'latin'}),
  {id:uid(),type:'text',builtIn:true,sourceKey:'brandName',label:'Logo',text:fieldValue('brandName')||'naappe',x:w-115,y:h-52,w:210,h:65,fontSize:38,weight:800,color:a,rotation:0,font:'latin',align:'center'}
 ];
 return[
  textElement('speaker','Speaker',w/2,h*.61,w*.78,75,38,600,a),
  textElement('quote','Quote',w/2,h*.77,w*.78,h*.28,68,700,dark),
  textElement('source','Source',105,h-50,180,55,25,700,dark,{font:'latin'}),
  {id:uid(),type:'text',builtIn:true,sourceKey:'brandName',label:'Logo',text:fieldValue('brandName')||'naappe',x:w-115,y:h-52,w:210,h:65,fontSize:38,weight:800,color:a,rotation:0,font:'latin',align:'center'}
 ]
}
function rebuildTemplateText(keepCustom=true){const custom=keepCustom?elements.filter(e=>!e.builtIn):[];elements=[...templateElements(template()),...custom];selectedId=null;history=[];future=[];refresh();draw();buttons();persist()}
function syncSize(){if(overlay.width!==base.width||overlay.height!==base.height){overlay.width=base.width;overlay.height=base.height;rebuildTemplateText(true)}else draw()}
new ResizeObserver(syncSize).observe(base);
setInterval(()=>{if(overlay.width!==base.width||overlay.height!==base.height)syncSize()},400);
function point(e){const r=base.getBoundingClientRect();return{x:(e.clientX-r.left)*base.width/r.width,y:(e.clientY-r.top)*base.height/r.height}}
function bounds(e){return e.type==='text'?{x:e.x-e.w/2,y:e.y-e.h/2,w:e.w,h:e.h}:{x:e.x-e.size/2,y:e.y-e.size/2,w:e.size,h:e.size}}
function hit(p){for(let i=elements.length-1;i>=0;i--){const e=elements[i],b=bounds(e);if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return e}return null}
function snapshot(){history.push(JSON.stringify(elements));if(history.length>80)history.shift();future=[];buttons()}
function undo(){if(!history.length)return;future.push(JSON.stringify(elements));elements=JSON.parse(history.pop());selectedId=null;refresh();draw();buttons();persist()}
function redo(){if(!future.length)return;history.push(JSON.stringify(elements));elements=JSON.parse(future.pop());selectedId=null;refresh();draw();buttons();persist()}
function buttons(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length}
function wrapLines(target,text,max,font){target.font=font;const out=[];for(const para of String(text||'').split('\n')){let line='';const parts=para.split(/(\s+)/).filter(Boolean);for(const part of parts){const test=line+part;if(target.measureText(test).width<=max||!line)line=test;else{out.push(line.trim());line=part.trimStart()}}if(line)out.push(line.trim())}return out.slice(0,10)}
function fontFor(e){const family=e.font==='latin'?'Arial,sans-serif':e.font==='auto'?'Arial,"Noto Sans Thaana",sans-serif':'"Noto Sans Thaana",Arial,sans-serif';return `${e.weight||700} ${e.fontSize||58}px ${family}`}
function paint(e,target=ctx){target.save();target.translate(e.x,e.y);target.rotate((e.rotation||0)*Math.PI/180);target.strokeStyle=e.color;target.fillStyle=e.color;target.lineCap='round';if(e.type==='circle'){target.lineWidth=Math.max(8,e.size*.055);target.beginPath();target.arc(0,0,e.size/2-target.lineWidth/2,0,Math.PI*2);target.stroke()}else if(e.type==='cross'){const h=e.size/2;target.lineWidth=Math.max(10,e.size*.075);target.beginPath();target.moveTo(-h,-h);target.lineTo(h,h);target.moveTo(h,-h);target.lineTo(-h,h);target.stroke()}else{target.direction=/[ހ-޿]/.test(e.text)?'rtl':'ltr';target.textAlign=e.align||'center';target.textBaseline='middle';const font=fontFor(e),ls=wrapLines(target,e.text,e.w,font),lh=(e.fontSize||58)*1.2;ls.forEach((line,i)=>target.fillText(line,0,(i-(ls.length-1)/2)*lh))}target.restore()}
function draw(){ctx.clearRect(0,0,overlay.width,overlay.height);elements.forEach(e=>paint(e));const e=selected();if(e){const b=bounds(e);ctx.save();ctx.strokeStyle='#2563eb';ctx.lineWidth=3;ctx.setLineDash([12,8]);ctx.strokeRect(b.x-8,b.y-8,b.w+16,b.h+16);ctx.restore()}}
function add(type){snapshot();const e=type==='text'?{id:uid(),type,builtIn:false,label:'Custom text',x:base.width/2,y:base.height/2,w:520,h:150,text:'Move this text',fontSize:58,weight:700,color:'#ef4444',rotation:0,font:'auto',align:'center'}:{id:uid(),type,builtIn:false,label:type==='circle'?'Circle':'Cross',x:base.width/2,y:base.height/2,size:220,color:'#ef4444',rotation:0};elements.push(e);selectedId=e.id;refresh();draw();persist()}
function remove(){const e=selected();if(!e)return;snapshot();elements=elements.filter(x=>x.id!==selectedId);selectedId=null;refresh();draw();persist()}
function duplicate(){const e=selected();if(!e)return;snapshot();const c={...clone(e),id:uid(),builtIn:false,sourceKey:null,label:`${e.label||'Element'} copy`,x:e.x+36,y:e.y+36};elements.push(c);selectedId=c.id;refresh();draw();persist()}
function refresh(){const list=$('#layerList');list.textContent='';[...elements].reverse().forEach(e=>{const row=document.createElement('div');row.className='layer-item'+(e.id===selectedId?' active':'');const name=document.createElement('strong');name.textContent=e.label||(e.type==='text'?(e.text||'Text').slice(0,24):e.type);const b=document.createElement('button');b.textContent='Select';b.onclick=()=>{selectedId=e.id;refresh();draw()};row.append(name,b);list.append(row)});const e=selected(),ins=$('#elementInspector');ins.hidden=!e;if(!e)return;document.querySelectorAll('.text-prop').forEach(n=>n.hidden=e.type!=='text');$('#elementText').value=e.text||'';$('#elementFontSize').value=e.fontSize||58;$('#elementWeight').value=e.weight||700;$('#elementSize').value=e.type==='text'?e.w:e.size;$('#elementRotation').value=e.rotation||0;$('#elementColor').value=e.color||'#ef4444'}
function updateSource(e){if(e?.sourceKey&&$('#'+e.sourceKey))$('#'+e.sourceKey).value=e.text}
function persist(){try{localStorage.setItem(`publisher-studio-v3-elements-${template()}`,JSON.stringify(elements))}catch{}}
base.addEventListener('pointerdown',e=>{const p=point(e),el=hit(p);if(!el){selectedId=null;refresh();draw();return}e.stopImmediatePropagation();e.preventDefault();base.setPointerCapture(e.pointerId);selectedId=el.id;drag={id:el.id,p,x:el.x,y:el.y,saved:false};refresh();draw()},true);
base.addEventListener('pointermove',e=>{if(!drag)return;e.stopImmediatePropagation();e.preventDefault();const p=point(e),el=elements.find(x=>x.id===drag.id);if(!el)return;if(!drag.saved){snapshot();drag.saved=true}el.x=drag.x+p.x-drag.p.x;el.y=drag.y+p.y-drag.p.y;draw()},true);
function end(e){if(!drag)return;e.stopImmediatePropagation();drag=null;persist()}base.addEventListener('pointerup',end,true);base.addEventListener('pointercancel',end,true);
document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));$('#undo').onclick=undo;$('#redo').onclick=redo;$('#deleteElement').onclick=remove;$('#duplicateElement').onclick=duplicate;
$('#elementText').oninput=e=>{const x=selected();if(x){x.text=e.target.value;updateSource(x);refresh();draw();persist()}};$('#elementFontSize').oninput=e=>{const x=selected();if(x){x.fontSize=Number(e.target.value);draw();persist()}};$('#elementWeight').onchange=e=>{const x=selected();if(x){x.weight=Number(e.target.value);draw();persist()}};$('#elementSize').oninput=e=>{const x=selected();if(x){x.type==='text'?x.w=Number(e.target.value):x.size=Number(e.target.value);draw();persist()}};$('#elementRotation').oninput=e=>{const x=selected();if(x){x.rotation=Number(e.target.value);draw();persist()}};$('#elementColor').oninput=e=>{const x=selected();if(x){x.color=e.target.value;draw();persist()}};
for(const id of ['headline','quote','speaker','role','source','brandName'])$('#'+id)?.addEventListener('input',e=>{const x=elements.find(v=>v.sourceKey===id);if(x){x.text=e.target.value;draw();persist()}});
$('#accent')?.addEventListener('input',()=>{for(const e of elements)if(['speaker','brandName'].includes(e.sourceKey))e.color=accent();draw();persist()});
document.querySelectorAll('[data-template]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>rebuildTemplateText(true),0)));
document.addEventListener('keydown',e=>{const active=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}else if((e.key==='Delete'||e.key==='Backspace')&&selected()&&!active){e.preventDefault();remove()}else if(selected()&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!active){e.preventDefault();snapshot();const x=selected(),n=e.shiftKey?10:2;if(e.key==='ArrowLeft')x.x-=n;if(e.key==='ArrowRight')x.x+=n;if(e.key==='ArrowUp')x.y-=n;if(e.key==='ArrowDown')x.y+=n;draw();persist()}});
const originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){if(this!==base)return originalToBlob.call(this,callback,type,quality);const merged=document.createElement('canvas');merged.width=base.width;merged.height=base.height;const m=merged.getContext('2d');m.drawImage(base,0,0);elements.forEach(e=>paint(e,m));originalToBlob.call(merged,callback,type,quality)};
$('#saveProject').addEventListener('click',persist,true);$('#newProject').addEventListener('click',()=>setTimeout(()=>rebuildTemplateText(false),0),true);
function restore(){try{const saved=JSON.parse(localStorage.getItem(`publisher-studio-v3-elements-${template()}`)||'null');if(Array.isArray(saved)&&saved.some(e=>e.builtIn))elements=saved;else elements=templateElements(template())}catch{elements=templateElements(template())}syncSize();refresh();buttons();draw()}
restore();