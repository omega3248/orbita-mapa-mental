(function(root){
 'use strict';
 const defaults={color:'#98b9ad',width:1.4,shape:'straight',style:'dotted',direction:'none'};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function normalizeAll(raw,cards){
   const ids=new Set(cards.map(c=>c.id)),pairs=new Set(),usedIds=new Set(),result=[];
   for(const [index,value]of (Array.isArray(raw)?raw:[]).slice(0,4000).entries()){
     if(!value||!ids.has(value.from)||!ids.has(value.to)||value.from===value.to)continue;
     const pair=JSON.stringify([value.from,value.to].sort());if(pairs.has(pair))continue;
     let id=String(value.id||'route-'+index).slice(0,180);if(usedIds.has(id))id+='-'+index;
     const width=Number(value.width);
     result.push({id,from:value.from,to:value.to,label:String(value.label||'').slice(0,150),color:/^#[0-9a-f]{6}$/i.test(value.color)?value.color.toLowerCase():defaults.color,width:Number.isFinite(width)?clamp(width,.6,8):defaults.width,shape:['straight','curve','elbow'].includes(value.shape)?value.shape:defaults.shape,style:['dotted','dashed','solid'].includes(value.style)?value.style:defaults.style,direction:['none','forward','reverse','both'].includes(value.direction)?value.direction:defaults.direction});
     pairs.add(pair);usedIds.add(id);if(result.length===2000)break;
   }return result;
 }
 function arrows(link,from,to){
   if(from?.central||to?.central)return {start:to?.central===true,end:from?.central===true};
   return {start:['reverse','both'].includes(link.direction),end:['forward','both'].includes(link.direction)};
 }
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 function hull(points){
   const p=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),lo=[],hi=[];
   const turn=(a,b,c)=>cross({x:b.x-a.x,y:b.y-a.y},{x:c.x-b.x,y:c.y-b.y});
   for(const v of p){while(lo.length>1&&turn(lo.at(-2),lo.at(-1),v)<=0)lo.pop();lo.push(v);}
   for(const v of [...p].reverse()){while(hi.length>1&&turn(hi.at(-2),hi.at(-1),v)<=0)hi.pop();hi.push(v);}
   return lo.slice(0,-1).concat(hi.slice(0,-1));
 }
 function boundary(center,toward,polygon){
   const d={x:toward.x-center.x,y:toward.y-center.y},length=Math.hypot(d.x,d.y);if(length<.001)return {...center};
   d.x/=length;d.y/=length;let distance=Infinity;
   for(let i=0;i<polygon.length;i++){
     const a=polygon[i],b=polygon[(i+1)%polygon.length],v={x:b.x-a.x,y:b.y-a.y},q={x:a.x-center.x,y:a.y-center.y},den=cross(d,v);if(Math.abs(den)<1e-7)continue;
     const t=cross(q,v)/den,u=cross(q,d)/den;if(t>=0&&u>=-.00001&&u<=1.00001)distance=Math.min(distance,t);
   }
   const r=Number.isFinite(distance)?Math.min(distance+3,length*.45):0;
   return {x:center.x+d.x*r,y:center.y+d.y*r};
 }
 function geometry(a,b,polygonA,polygonB,shape){
   const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<1)return null;
   const start=boundary(a,b,polygonA),end=boundary(b,a,polygonB),dx=end.x-start.x,dy=end.y-start.y;
   let mid={x:(start.x+end.x)/2,y:(start.y+end.y)/2},path='M '+start.x+' '+start.y;
   if(shape==='curve'){const length=Math.hypot(dx,dy)||1,bend=Math.min(90,Math.max(25,length*.18)),control={x:mid.x-dy/length*bend,y:mid.y+dx/length*bend};path+=' Q '+control.x+' '+control.y+' '+end.x+' '+end.y;mid={x:mid.x-dy/length*bend/2,y:mid.y+dx/length*bend/2};}
   else if(shape==='elbow')path+=' H '+mid.x+' V '+end.y+' H '+end.x;
   else path+=' L '+end.x+' '+end.y;
   return {path,mid,start,end};
 }
 const api={defaults,normalizeAll,arrows,hull,boundary,geometry};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrbitaConnections=api;
})(typeof window==='undefined'?globalThis:window);
