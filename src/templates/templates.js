export const templates = {
  'photo-left-text-right': {
    canvas: { width: 1200, height: 675, backgroundColor: '#ffffff' },
    nodes: [
      { id:'photo', type:'image', name:'Photo', x:0, y:0, width:660, height:675, originX:0, originY:0, zIndex:0,
        constraints:{horizontal:'left',vertical:'stretch',margins:{left:0,top:0,bottom:0}} },
      { id:'fade', type:'shape', name:'Fade', x:560, y:0, width:250, height:675, originX:0, originY:0, zIndex:1, fill:'rgba(255,255,255,.72)',
        constraints:{horizontal:'left',vertical:'stretch',margins:{left:560,top:0,bottom:0}} },
      { id:'headline', type:'text', name:'Headline', x:760, y:120, width:370, height:220, originX:0, originY:0, zIndex:2,
        text:'ނައްޕެ އިވެންޓް އަޕްޑޭޓް', fontSize:58, textAlign:'right',
        constraints:{horizontal:'right',vertical:'top',margins:{right:70,top:120}} },
      { id:'details', type:'text', name:'Details', x:760, y:390, width:370, height:120, originX:0, originY:0, zIndex:3,
        text:'މިއީ އިވެންޓްގެ ކުރު ތަޢާރަފެއް.', fontSize:24, fontWeight:500, color:'#334155', textAlign:'right',
        constraints:{horizontal:'right',vertical:'top',margins:{right:70,top:390}} },
      { id:'brand', type:'text', name:'Brand', x:900, y:590, width:230, height:50, originX:0, originY:0, zIndex:4,
        text:'naappe', direction:'ltr', textAlign:'right', fontFamily:'Arial', fontSize:28, color:'#07363a',
        constraints:{horizontal:'right',vertical:'bottom',margins:{right:70,bottom:35}} }
    ]
  },

  'photo-right-text-left': {
    canvas: { width: 1200, height: 675, backgroundColor: '#ffffff' },
    nodes: [
      { id:'headline', type:'text', name:'Headline', x:70, y:125, width:430, height:220, originX:0, originY:0, zIndex:2,
        text:'ނައްޕެ އިވެންޓް އަޕްޑޭޓް', fontSize:58, textAlign:'right',
        constraints:{horizontal:'left',vertical:'top',margins:{left:70,top:125}} },
      { id:'details', type:'text', name:'Details', x:70, y:390, width:430, height:120, originX:0, originY:0, zIndex:3,
        text:'މިއީ އިވެންޓްގެ ކުރު ތަޢާރަފެއް.', fontSize:24, fontWeight:500, color:'#334155', textAlign:'right',
        constraints:{horizontal:'left',vertical:'top',margins:{left:70,top:390}} },
      { id:'photo', type:'image', name:'Photo', x:560, y:0, width:640, height:675, originX:0, originY:0, zIndex:0,
        constraints:{horizontal:'right',vertical:'stretch',margins:{right:0,top:0,bottom:0}} }
    ]
  },

  'portrait-text-below': {
    canvas: { width: 1080, height: 1350, backgroundColor: '#ffffff' },
    nodes: [
      { id:'photo', type:'image', name:'Photo', x:0, y:0, width:1080, height:760, originX:0, originY:0, zIndex:0,
        constraints:{horizontal:'stretch',vertical:'top',margins:{left:0,right:0,top:0}} },
      { id:'headline', type:'text', name:'Headline', x:90, y:835, width:900, height:260, originX:0, originY:0, zIndex:2,
        text:'ނައްޕެ އިވެންޓް އަޕްޑޭޓް', fontSize:72, textAlign:'center',
        constraints:{horizontal:'stretch',vertical:'top',margins:{left:90,right:90,top:835}} },
      { id:'brand', type:'text', name:'Brand', x:790, y:1260, width:200, height:45, originX:0, originY:0, zIndex:3,
        text:'naappe', direction:'ltr', textAlign:'right', fontFamily:'Arial', fontSize:28,
        constraints:{horizontal:'right',vertical:'bottom',margins:{right:90,bottom:45}} }
    ]
  },

  'soft-editorial': {
    canvas: { width: 1080, height: 1080, backgroundColor: '#eefcfb' },
    nodes: [
      { id:'photo', type:'image', name:'Portrait', x:210, y:80, width:660, height:600, originX:0, originY:0, zIndex:0,
        constraints:{horizontal:'center',vertical:'top',margins:{top:80}} },
      { id:'headline', type:'text', name:'Headline', x:90, y:730, width:900, height:210, originX:0, originY:0, zIndex:2,
        text:'ނައްޕެ އިވެންޓް އަޕްޑޭޓް', fontSize:64, textAlign:'center',
        constraints:{horizontal:'stretch',vertical:'bottom',margins:{left:90,right:90,bottom:140}} },
      { id:'brand', type:'text', name:'Brand', x:790, y:1010, width:200, height:40, originX:0, originY:0, zIndex:3,
        text:'naappe', direction:'ltr', textAlign:'right', fontFamily:'Arial', fontSize:25,
        constraints:{horizontal:'right',vertical:'bottom',margins:{right:90,bottom:30}} }
    ]
  }
};
