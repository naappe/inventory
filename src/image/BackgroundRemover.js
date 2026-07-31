export async function removeLightBackground(image,threshold=42,feather=10){
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const frame=ctx.getImageData(0,0,canvas.width,canvas.height);const d=frame.data;
  for(let i=0;i<d.length;i+=4){const distance=Math.sqrt((255-d[i])**2+(255-d[i+1])**2+(255-d[i+2])**2);const low=threshold,high=threshold+Math.max(1,feather*3);if(distance<=low)d[i+3]=0;else if(distance<high)d[i+3]=Math.round(255*(distance-low)/(high-low));}
  ctx.putImageData(frame,0,0);return canvas.toDataURL('image/png');
}
