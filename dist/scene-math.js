(function(root){
 'use strict';
 const F=5000, dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
 const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
 const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
 function basis(c){
   if(c.flat)return {u:{x:1,y:0,z:0},v:{x:0,y:0,z:-1},w:{x:0,y:1,z:0}};
   const a=c.yaw*Math.PI/180,b=c.pitch*Math.PI/180,sa=Math.sin(a),ca=Math.cos(a),sb=Math.sin(b),cb=Math.cos(b);
   return {u:{x:ca,y:-sa,z:0},v:{x:sa*sb,y:ca*sb,z:-cb},w:{x:sa*cb,y:ca*cb,z:sb}};
 }
 function project(point,c,width,height){
   const {u,v,w}=basis(c),depth=dot(point,w),perspective=c.flat?1:F/(F-depth);
   return {x:width/2+dot(point,u)*c.zoom*perspective+c.panX,y:height/2+dot(point,v)*c.zoom*perspective+c.panY,scale:c.zoom*perspective,depth};
 }
 function intersect(x,y,c,width,height,planePoint,normal){
   const {u,v,w}=basis(c),qx=(x-width/2-c.panX)/c.zoom,qy=(y-height/2-c.panY)/c.zoom;
   const screen=add(mul(u,qx),mul(v,qy));
   const origin=c.flat?add(screen,mul(w,F)):mul(w,F);
   const direction=c.flat?mul(w,-1):sub(screen,mul(w,F));
   const denominator=dot(direction,normal);
   if(Math.abs(denominator)<1e-8)return null;
   return add(origin,mul(direction,dot(sub(planePoint,origin),normal)/denominator));
 }
 function zoomAt(c,factor,x,y,width,height){
   const zoom=Math.max(.10,Math.min(4,c.zoom*factor)),r=zoom/c.zoom;
   return {...c,zoom,panX:x-width/2-(x-width/2-c.panX)*r,panY:y-height/2-(y-height/2-c.panY)*r};
 }
 function normalFor(mode,c){return mode==='xy'?{x:0,y:0,z:1}:mode==='xz'?{x:0,y:1,z:0}:mode==='yz'?{x:1,y:0,z:0}:basis(c).w;}
 const limits={width:[64,520],height:[40,400],thickness:[24,300]};
 function viewMatrix(c){
   const {u,v,w}=basis(c);
   // CSS local axes are X, -Z, Y. The object stays aligned with the world.
   return [u.x,v.x,w.x,0,-u.z,-v.z,-w.z,0,u.y,v.y,w.y,0,0,0,0,1];
 }
 function corner(c,sx,sy,sz){return {x:c.x+sx*c.width/2,y:c.y+sy*c.thickness/2,z:c.z+sz*c.height/2};}
 function face(c,name){
   const center={x:c.x,y:c.y,z:c.z},normal={x:0,y:0,z:0};
   if(name==='front'||name==='back'){normal.y=name==='front'?1:-1;center.y+=normal.y*c.thickness/2;}
   if(name==='right'||name==='left'){normal.x=name==='right'?1:-1;center.x+=normal.x*c.width/2;}
   if(name==='top'||name==='bottom'){normal.z=name==='top'?1:-1;center.z+=normal.z*c.height/2;}
   return {center,normal};
 }
 function linePlane(axis,c){const w=basis(c).w,n=sub(w,mul(axis,dot(w,axis)));return dot(n,n)<1e-8?null:n;}
 function resizeAxis(c,key,sign,value){
   const [min,max]=limits[key],size=Math.max(min,Math.min(max,value)),axis=key==='width'?'x':key==='height'?'z':'y';
   return {...c,[key]:size,[axis]:c[axis]+sign*(size-c[key])/2};
 }
 function resizeUniform(c,sx,sy,sz,ratio){
   const min=Math.max(...Object.keys(limits).map(k=>limits[k][0]/c[k])),max=Math.min(...Object.keys(limits).map(k=>limits[k][1]/c[k]));
   const r=Math.max(min,Math.min(max,ratio)),anchor=corner(c,-sx,-sy,-sz);
   return {...c,width:c.width*r,height:c.height*r,thickness:c.thickness*r,x:anchor.x+sx*c.width*r/2,y:anchor.y+sy*c.thickness*r/2,z:anchor.z+sz*c.height*r/2};
 }
 const api={F,dot,add,sub,mul,basis,project,intersect,zoomAt,normalFor,limits,viewMatrix,corner,face,linePlane,resizeAxis,resizeUniform};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.OrbitaSpace=api;
})(typeof window==='undefined'?globalThis:window);
