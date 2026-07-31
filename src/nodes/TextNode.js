import { Node, NodeTypes } from '../core/Node.js';
import { layoutText } from '../typography/TextLayout.js';
export class TextNode extends Node{
 constructor(o={}){super(o);this.type='text';this.text=o.text??'';this.fontFamily=o.fontFamily??'Noto Sans Thaana';this.fontSize=o.fontSize??32;this.fontWeight=o.fontWeight??400;this.lineHeight=o.lineHeight??1.35;this.letterSpacing=o.letterSpacing??0;this.textAlign=o.textAlign??'right';this.direction=o.direction??'rtl';this.color=o.color??'#073b63';this.maxLines=o.maxLines??12;this.baselineOffset=o.baselineOffset??0}
 draw(ctx){ctx.fillStyle=this.color;ctx.font=`${this.fontWeight} ${this.fontSize}px "${this.fontFamily}", "Noto Sans Thaana", Faruma, Arial, sans-serif`;ctx.textBaseline='top';ctx.textAlign=this.textAlign;ctx.direction=this.direction;const lines=layoutText(ctx,this.text,this.width).slice(0,this.maxLines);const lh=this.fontSize*this.lineHeight;const x=this.textAlign==='left'?0:this.textAlign==='center'?this.width/2:this.width;lines.forEach((line,i)=>ctx.fillText(line,x,i*lh+this.baselineOffset,this.width))}
 toJSON(){return{...super.toJSON(),text:this.text,fontFamily:this.fontFamily,fontSize:this.fontSize,fontWeight:this.fontWeight,lineHeight:this.lineHeight,letterSpacing:this.letterSpacing,textAlign:this.textAlign,direction:this.direction,color:this.color,maxLines:this.maxLines,baselineOffset:this.baselineOffset}}
}
NodeTypes.set('text',TextNode);
