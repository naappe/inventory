const quote='އެއްވެސް ފަރާތަކުން ބާރުފޯރުވުމެއް ނެތި، އަމިއްލައަށް ނިންމާނީ ކޮންމެ މަގަކަށް ކުރިއަށް ދާންކަމެވެ.';
const common=[
{id:'background',type:'shape',name:'Background',x:0,y:0,width:1200,height:675,originX:0,originY:0,zIndex:0,fill:'#ffffff',locked:true},
{id:'quote-mark',type:'text',name:'Quote mark',x:80,y:55,width:150,height:130,originX:0,originY:0,zIndex:2,text:'“',fontFamily:'Georgia',fontSize:128,fontWeight:700,direction:'ltr',textAlign:'left',color:'#073b63'},
{id:'quote',type:'text',name:'Quote',x:78,y:170,width:600,height:260,originX:0,originY:0,zIndex:3,text:quote,fontSize:38,fontWeight:400,lineHeight:1.55,textAlign:'center',color:'#073b63'},
{id:'divider',type:'shape',name:'Divider',x:140,y:465,width:480,height:3,originX:0,originY:0,zIndex:3,fill:'#68517f'},
{id:'speaker',type:'text',name:'Speaker',x:120,y:492,width:520,height:48,originX:0,originY:0,zIndex:4,text:'އަހުމަދު ނަސީރު',fontSize:25,fontWeight:500,textAlign:'center',color:'#68517f'},
{id:'role',type:'text',name:'Role',x:120,y:535,width:520,height:40,originX:0,originY:0,zIndex:4,text:'ރައީސް، މަދަނީ ޖަމިއްޔާ',fontSize:17,fontWeight:400,textAlign:'center',color:'#68517f'},
{id:'brand',type:'text',name:'Brand',x:92,y:590,width:160,height:42,originX:0,originY:0,zIndex:5,text:'naappe',fontFamily:'Arial',fontSize:25,fontWeight:700,direction:'ltr',textAlign:'left',color:'#073b63',locked:true},
{id:'brand-line',type:'shape',name:'Brand divider',x:275,y:590,width:3,height:48,originX:0,originY:0,zIndex:5,fill:'#68517f',locked:true},
{id:'date',type:'text',name:'Date',x:296,y:596,width:250,height:38,originX:0,originY:0,zIndex:5,text:'17 ޖުލައި 2026',fontSize:18,fontWeight:400,textAlign:'left',color:'#68517f',locked:true},
{id:'portrait',type:'image',name:'Portrait',x:730,y:54,width:430,height:567,originX:0,originY:0,zIndex:2,assetId:null,originalAssetId:null,radius:42,shadow:true,zoom:1}
];
function scaled(w,h){const sx=w/1200,sy=h/675;return common.map(n=>({...n,x:n.x*sx,y:n.y*sy,width:n.width*sx,height:n.height*sy,fontSize:n.fontSize?Math.round(n.fontSize*Math.min(sx,sy)):n.fontSize,radius:n.radius?Math.round(n.radius*Math.min(sx,sy)):n.radius}))}
export const templates={
'editorial-quote-reference':{canvas:{width:1200,height:675,backgroundColor:'#ffffff'},nodes:common},
'editorial-quote-square':{canvas:{width:1080,height:1080,backgroundColor:'#ffffff'},nodes:scaled(1080,1080)},
'editorial-quote-portrait':{canvas:{width:1080,height:1350,backgroundColor:'#ffffff'},nodes:scaled(1080,1350)}
};
