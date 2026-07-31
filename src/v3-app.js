const $=s=>document.querySelector(s);
const canvas=$('#publisherCanvas');
const ctx=canvas.getContext('2d');
const STORAGE_KEY='naappe-publisher-v3-project';
const state={
  width:1080,height:1350,image:null,imageData:null,imageX:0,imageY:0,scale:1,
  minScale:.2,maxScale:8,fitScale:1,drag:false,lastX:0,lastY:0,
  pointers:new Map(),pinchDistance:0,pinchScale:1,pinchCenter:null,
  quote:'މިއީ ނައްޕެ ޕަބްލިޝަރ ސްޓޫޑިއޯގެ ކުއިކް މޯޑެވެ.',
  speaker:'ނޭޝަން ޗެޓް',source:'NAAPPE',overlayStart:.43,overlayOpacity:.96,accent:'#168f87'
};
canvas.width=state.width;canvas.height=state.height;

function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
function coverScale(){return state.image?Math.max(state.width/state.image.width,state.height/state.image.height):1}
function containScale(){return state.image?Math.min(state.width/state.image.width,state.height/state.image.height):1}
function constrainImage(){
  if(!state.image)return;
  const w=state.image.width*state.scale,h=state.image.height*state.scale;
  if(w>=state.width) state.imageX=clamp(state.imageX,state.width-w,0); else state.imageX=(state.width-w)/2;
  if(h>=state.height) state.imageY=clamp(state.imageY,state.height-h,0); else state.imageY=(state.height-h)/2;
}
function applyScale(scale){
  state.scale=clamp(scale,state.minScale,state.maxScale);
  constrainImage();render();
}
function fillImage(){
  if(!state.image)return;
  state.fitScale=coverScale();state.minScale=state.fitScale;
  state.scale=state.fitScale;
  state.imageX=(state.width-state.image.width*state.scale)/2;
  state.imageY=(state.height-state.image.height*state.scale)/2;
  render();
}
function fitImage(){
  if(!state.image)return;
  state.fitScale=containScale();state.minScale=Math.min(state.fitScale,coverScale());
  state.scale=state.fitScale;
  state.imageX=(state.width-state.image.width*state.scale)/2;
  state.imageY=(state.height-state.image.height*state.scale)/2;
  render();
}
function resetImage(){fillImage()}
function pointerPosition(event){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)*state.width/r.width,y:(event.clientY-r.top)*state.height/r.height}}
function zoomAt(x,y,next){
  if(!state.image)return;
  next=clamp(next,state.minScale,state.maxScale);
  const localX=(x-state.imageX)/state.scale,localY=(y-state.imageY)/state.scale;
  state.scale=next;state.imageX=x-localX*next;state.imageY=y-localY*next;
  constrainImage();render();
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function midpoint(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}

canvas.addEventListener('pointerdown',e=>{
  if(!state.image)return;
  canvas.setPointerCapture(e.pointerId);
  const p=pointerPosition(e);state.pointers.set(e.pointerId,p);
  if(state.pointers.size===1){state.drag=true;state.lastX=p.x;state.lastY=p.y}
  if(state.pointers.size===2){
    const [a,b]=[...state.pointers.values()];
    state.drag=false;state.pinchDistance=distance(a,b);state.pinchScale=state.scale;state.pinchCenter=midpoint(a,b);
  }
});
canvas.addEventListener('pointermove',e=>{
  if(!state.pointers.has(e.pointerId))return;
  const p=pointerPosition(e);state.pointers.set(e.pointerId,p);
  if(state.pointers.size===2){
    const [a,b]=[...state.pointers.values()];const d=distance(a,b);const center=midpoint(a,b);
    if(state.pinchDistance>0)zoomAt(center.x,center.y,state.pinchScale*(d/state.pinchDistance));
    state.pinchCenter=center;return;
  }
  if(!state.drag)return;
  state.imageX+=p.x-state.lastX;state.imageY+=p.y-state.lastY;
  state.lastX=p.x;state.lastY=p.y;constrainImage();render();
});
function releasePointer(e){
  state.pointers.delete(e.pointerId);
  if(state.pointers.size===1){const p=[...state.pointers.values()][0];state.drag=true;state.lastX=p.x;state.lastY=p.y}else state.drag=false;
  state.pinchDistance=0;
}
canvas.addEventListener('pointerup',releasePointer);
canvas.addEventListener('pointercancel',releasePointer);
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointerPosition(e);zoomAt(p.x,p.y,state.scale*Math.exp(-e.deltaY*.001))},{passive:false});
canvas.addEventListener('dblclick',fillImage);
canvas.addEventListener('contextmenu',e=>{e.preventDefault();resetImage()});

function wrapText(text,maxWidth,font){ctx.font=font;const chars=[...text];const lines=[];let line='';for(const char of chars){const test=line+char;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=char}else line=test}if(line)lines.push(line);return lines}
function drawImage(){ctx.fillStyle='#dfe6ec';ctx.fillRect(0,0,state.width,state.height);if(!state.image)return;ctx.drawImage(state.image,state.imageX,state.imageY,state.image.width*state.scale,state.image.height*state.scale)}
function drawOverlay(){const start=state.height*state.overlayStart;const g=ctx.createLinearGradient(0,start,0,state.height*.86);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.38,`rgba(255,255,255,${state.overlayOpacity*.72})`);g.addColorStop(1,`rgba(255,255,255,${state.overlayOpacity})`);ctx.fillStyle=g;ctx.fillRect(0,start,state.width,state.height-start)}
function drawText(){ctx.textAlign='center';ctx.direction='rtl';ctx.fillStyle=state.accent;ctx.font='600 38px Arial';ctx.fillText(state.speaker,state.width/2,state.height*.62);ctx.font='700 73px "Noto Sans Thaana",Arial';const lines=wrapText(state.quote,state.width*.78,ctx.font).slice(0,6);const lineHeight=100,startY=state.height*.69;lines.forEach((line,i)=>ctx.fillText(line,state.width/2,startY+i*lineHeight));ctx.direction='ltr';ctx.font='700 28px Arial';ctx.fillStyle='#1c2737';ctx.fillText(state.source,100,state.height-55);ctx.font='800 42px Arial';ctx.fillStyle=state.accent;ctx.fillText('naappe',state.width-112,state.height-55)}
function render(){ctx.clearRect(0,0,state.width,state.height);drawImage();drawOverlay();drawText();$('#zoomValue').textContent=state.image?Math.round(state.scale/state.fitScale*100)+'%':'—'}

function projectData(){return{version:3,quote:state.quote,speaker:state.speaker,source:state.source,overlayStart:state.overlayStart,overlayOpacity:state.overlayOpacity,accent:state.accent,imageData:state.imageData,imageX:state.imageX,imageY:state.imageY,scale:state.scale}}
function saveProject(){localStorage.setItem(STORAGE_KEY,JSON.stringify(projectData()));setStatus('Project saved in this browser')}
function loadImage(data,transform=null){
  if(!data)return;
  const image=new Image();image.onload=()=>{state.image=image;state.imageData=data;state.fitScale=coverScale();state.minScale=state.fitScale;if(transform){state.scale=clamp(transform.scale||state.fitScale,state.minScale,state.maxScale);state.imageX=Number(transform.imageX)||0;state.imageY=Number(transform.imageY)||0;constrainImage();render()}else fillImage()};image.src=data;
}
function loadProject(){
  const saved=localStorage.getItem(STORAGE_KEY);if(!saved)return setStatus('No saved project found');
  try{const p=JSON.parse(saved);['quote','speaker','source','overlayStart','overlayOpacity','accent'].forEach(k=>{if(p[k]!==undefined)state[k]=p[k]});
    $('#quote').value=state.quote;$('#speaker').value=state.speaker;$('#source').value=state.source;$('#overlayStart').value=state.overlayStart;$('#overlayOpacity').value=state.overlayOpacity;$('#accent').value=state.accent;syncOutputs();
    if(p.imageData)loadImage(p.imageData,p);else render();setStatus('Project restored')
  }catch{setStatus('Saved project could not be opened')}
}
function setStatus(message){const el=$('#projectStatus');if(el){el.textContent=message;clearTimeout(setStatus.timer);setStatus.timer=setTimeout(()=>el.textContent='Changes stay editable',2200)}}
function syncOutputs(){$('#overlayStartValue').value=Math.round(state.overlayStart*100)+'%';$('#overlayOpacityValue').value=Math.round(state.overlayOpacity*100)+'%'}

$('#imageUpload').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>loadImage(reader.result);reader.readAsDataURL(file)});
$('#quote').addEventListener('input',e=>{state.quote=e.target.value;render()});
$('#speaker').addEventListener('input',e=>{state.speaker=e.target.value;render()});
$('#source').addEventListener('input',e=>{state.source=e.target.value;render()});
$('#overlayStart').addEventListener('input',e=>{state.overlayStart=Number(e.target.value);syncOutputs();render()});
$('#overlayOpacity').addEventListener('input',e=>{state.overlayOpacity=Number(e.target.value);syncOutputs();render()});
$('#accent').addEventListener('input',e=>{state.accent=e.target.value;render()});
$('#fitImage').onclick=fitImage;$('#fillImage').onclick=fillImage;$('#resetImage').onclick=resetImage;
$('#saveProject').onclick=saveProject;$('#loadSavedProject').onclick=loadProject;
$('#exportPng').onclick=()=>{render();const a=document.createElement('a');a.download='naappe-nationchat-1080x1350.png';a.href=canvas.toDataURL('image/png');a.click()};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.body.classList.toggle('studio-mode',b.dataset.mode==='studio')});
syncOutputs();render();