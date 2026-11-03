(function(root){
 'use strict';
 const Space=root.OrbitaSpace||(typeof require==='function'?require('./scene-math.js'):null);
 const Links=root.OrbitaConnections||(typeof require==='function'?require('./connection-utils.js'):null);
 const clone=v=>JSON.parse(JSON.stringify(v)),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),limit=(n,a,b)=>Math.max(a,Math.min(b,n));
 const fields=['title','category','priority','benefit','description','deadline','status','next','notes','url','linkLabel','verified','x','y','z','width','height','thickness','color','central'];
 const fail=m=>{throw new Error(m);};
 const number=(v,a,b)=>{if(typeof v!=='number'||!Number.isFinite(v))fail('El valor numérico no es válido.');return limit(v,a,b);};
 function card(raw){
   if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||!raw.title.trim())fail('Cada cuadro necesita un título.');
   const c={id:String(raw.id||'card-'+crypto.randomUUID()).slice(0,160),title:raw.title.trim().slice(0,120)};
   for(const key of ['benefit','description','next','notes','url','linkLabel','deadline','status'])c[key]=String(raw[key]||'').slice(0,key==='notes'?3000:key==='description'?2500:key==='url'?2000:key==='next'?1500:150);
   if(c.url){try{if(!['https:','http:'].includes(new URL(c.url).protocol))c.url='';}catch{c.url='';}}
   c.status=['Por revisar','En proceso','Solicitada','Completada','Vigilar','Ruta futura','Descartada'].includes(c.status)?c.status:'Por revisar';if(!/^\d{4}-\d{2}-\d{2}$/.test(c.deadline)||!Number.isFinite(Date.parse(c.deadline)))c.deadline='';
   c.category=['money','learn','venture','university'].includes(raw.category)?raw.category:'money';c.priority=Math.round(number(raw.priority??3,1,5));c.verified=raw.verified===true;c.central=raw.central===true;
   for(const [k,min,max,def]of [['x',-10000,10000,0],['y',-10000,10000,0],['z',-2000,2000,0],['width',64,520,144],['height',40,400,94],['thickness',24,300,48]])c[k]=number(raw[k]??def,min,max);
   c.color=/^#[a-f0-9]{6}$/i.test(raw.color||'')?raw.color.toLowerCase():'';return c;
 }
 function data(raw){
   if(!raw||!Array.isArray(raw.cards)||raw.cards.length>500)fail('El mapa admite hasta 500 cuadros.');
   const cards=raw.cards.map(card);if(new Set(cards.map(c=>c.id)).size!==cards.length)fail('Hay cuadros con el mismo identificador.');
   const theme={planes:{XY:'#65eb83',XZ:'#f38173',YZ:'#8694ff'},sectors:{}};
   for(const k of Object.keys(theme.planes))if(/^#[a-f0-9]{6}$/i.test(raw.theme?.planes?.[k]||''))theme.planes[k]=raw.theme.planes[k];
   for(const [k,v]of Object.entries(raw.theme?.sectors||{}))if(/^(XY|XZ|YZ):[+-]{2}$/.test(k)&&/^#[a-f0-9]{6}$/i.test(v))theme.sectors[k]=v;
   return {cards,links:Links.normalizeAll(raw.links,cards),deleted:[...new Set((raw.deleted||[]).filter(v=>typeof v==='string').map(v=>v.slice(0,160)))].slice(0,1000),theme,palette:Array.isArray(raw.palette)&&raw.palette.length===5&&raw.palette.every(v=>/^#[a-f0-9]{6}$/i.test(v))?clone(raw.palette):['#d9ed91','#f7d094','#de91aa','#a994f7','#59e8df']};
 }
 function diff(base,current){
   const patch={cards:[],remove:[],links:[],removeLinks:[],settings:{}};
   const previous=new Map(base.cards.map(c=>[c.id,c]));
   for(const c of current.cards){const old=previous.get(c.id);if(!old)patch.cards.push({id:c.id,create:clone(c)});else{const set={};for(const k of fields)if(!same(old[k],c[k]))set[k]=c[k];if(Object.keys(set).length)patch.cards.push({id:c.id,set});}previous.delete(c.id);}
   patch.remove=[...previous.keys()];const oldLinks=new Map(base.links.map(l=>[l.id,l]));
   for(const l of current.links){if(!same(oldLinks.get(l.id),l))patch.links.push(clone(l));oldLinks.delete(l.id);}patch.removeLinks=[...oldLinks.keys()];
   for(const k of ['theme','palette','deleted'])if(!same(base[k],current[k]))patch.settings[k]=clone(current[k]);return patch;
 }
 const empty=p=>!p.cards.length&&!p.remove.length&&!p.links.length&&!p.removeLinks.length&&!Object.keys(p.settings).length;
 function patch(raw,p){
   if(!p||!Array.isArray(p.cards)||!Array.isArray(p.remove)||!Array.isArray(p.links)||!Array.isArray(p.removeLinks))fail('Cambio de mapa inválido.');
   if(p.cards.length>500||p.links.length>2000)fail('El cambio es demasiado grande.');const d=data(raw),cs=new Map(d.cards.map(c=>[c.id,c]));
   for(const id of p.remove){cs.delete(id);if(!d.deleted.includes(id))d.deleted.push(id);}
   for(const change of p.cards){if(change.create)cs.set(change.id,card({...change.create,id:change.id}));else{const c=cs.get(change.id);if(!c)continue;for(const k of fields)if(Object.hasOwn(change.set||{},k))c[k]=change.set[k];cs.set(c.id,card(c));}}
   d.cards=[...cs.values()];const ls=new Map(d.links.map(l=>[l.id,l]));for(const id of p.removeLinks)ls.delete(id);for(const l of p.links)ls.set(l.id,l);d.links=[...ls.values()];
   for(const k of ['theme','palette'])if(Object.hasOwn(p.settings||{},k))d[k]=p.settings[k];
   if(Array.isArray(p.settings?.deleted))d.deleted=[...new Set([...d.deleted,...p.settings.deleted])];d.deleted=d.deleted.filter(id=>!cs.has(id));return data(d);
 }
 const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 function target(d,name){if(typeof name!=='string'||!name)fail('Indica el cuadro que quieres cambiar.');const exact=d.cards.find(c=>c.id===name);if(exact)return exact;const matches=d.cards.filter(c=>fold(c.title)===fold(name)),partial=matches.length?matches:d.cards.filter(c=>fold(c.title).includes(fold(name)));if(partial.length!==1)fail(partial.length?'Hay varios cuadros con ese nombre. Usa su identificador.':'No encontré ese cuadro.');return partial[0];}
 function view(v){if(!v||typeof v!=='object')fail('No hay una vista activa.');return {camera:{zoom:number(v.camera?.zoom,.1,4),panX:number(v.camera?.panX,-30000,30000),panY:number(v.camera?.panY,-30000,30000),yaw:number(v.camera?.yaw,-180,180),pitch:number(v.camera?.pitch,-82,82),flat:v.camera?.flat===true},width:number(v.width,0,10000),height:number(v.height,0,10000),busy:v.busy===true,visible:v.visible!==false};}
 function actions(raw,list,currentView,{allowDelete=false}={}){
   if(!Array.isArray(list)||!list.length||list.length>500)fail('Envía entre 1 y 500 acciones.');const d=data(raw),summaries=[];
   for(const a of list){
     if(!a||typeof a.type!=='string')fail('Acción inválida.');
     if(a.type==='create'){if(d.cards.length>=500)fail('El mapa ya tiene 500 cuadros.');let center={x:0,y:0,z:0};if(currentView?.width>=50&&currentView?.height>=50){const v=view(currentView);center=Space.intersect(v.width/2,v.height/2,v.camera,v.width,v.height,center,Space.basis(v.camera).w)||center;}const c=card({...center,...a.fields,id:'card-'+crypto.randomUUID()});d.cards.push(c);summaries.push('Creado: '+c.title);continue;}
     if(a.type==='connect'){const from=target(d,a.from),to=target(d,a.to);if(from.id===to.id)fail('Un cuadro no puede conectarse consigo mismo.');if(d.links.some(l=>[l.from,l.to].includes(from.id)&&[l.from,l.to].includes(to.id)))fail('Estos cuadros ya están conectados.');d.links.push(...Links.normalizeAll([{...a.fields,id:'line-'+crypto.randomUUID(),from:from.id,to:to.id}],d.cards));summaries.push('Conectados: '+from.title+' y '+to.title);continue;}
     if(a.type==='line'){const line=d.links.find(l=>l.id===a.line_id);if(!line)fail('No encontré esa conexión.');const endpoint=target(d,a.target);if(endpoint.id!==line.from&&endpoint.id!==line.to)fail('Selecciona un cuadro conectado a esa línea.');const clean=Links.normalizeAll([{...line,...a.fields,id:line.id,from:line.from,to:line.to}],d.cards)[0];Object.assign(line,clean);summaries.push('Conexión actualizada');continue;}
     const c=target(d,a.target);
     if(a.type==='delete'){if(!allowDelete)fail('Usa orbita_delete_cards para eliminar cuadros.');d.cards=d.cards.filter(v=>v.id!==c.id);d.links=d.links.filter(l=>l.from!==c.id&&l.to!==c.id);d.deleted.push(c.id);summaries.push('Eliminado: '+c.title);continue;}
     if(a.type==='edit'){for(const k of fields)if(!['x','y','z','width','height','thickness'].includes(k)&&Object.hasOwn(a.fields||{},k))c[k]=a.fields[k];Object.assign(c,card(c));}
     else if(a.type==='resize'){if(a.factor!==undefined){const factor=number(a.factor,.1,10);for(const k of ['width','height','thickness'])c[k]*=factor;}else for(const k of ['width','height','thickness'])if(a[k]!==undefined)c[k]=a[k];Object.assign(c,card(c));}
     else if(a.type==='move'){
       if(a.screen_dx!==undefined||a.screen_dy!==undefined){const v=view(currentView);if(v.width<50||v.height<50)fail('La vista del mapa no está disponible.');const p=Space.project(c,v.camera,v.width,v.height),normal=Space.basis(v.camera).w,q=Space.intersect(p.x+number(a.screen_dx??0,-3000,3000),p.y+number(a.screen_dy??0,-3000,3000),v.camera,v.width,v.height,c,normal);if(!q)fail('No pude calcular ese movimiento en la vista actual.');for(const k of ['x','y','z'])c[k]=q[k];}
       else{for(const k of ['x','y','z']){if(a[k]!==undefined)c[k]=a[k];else if(a['d'+k]!==undefined)c[k]+=number(a['d'+k],-10000,10000);}}
       Object.assign(c,card(c));
     }else fail('Acción no admitida: '+a.type);
     summaries.push('Actualizado: '+c.title);
   }return {data:data(d),summary:summaries.join(' · ')};
 }
 const api={data,diff,patch,empty,actions,view,target,clone};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrbitaActions=api;
})(typeof window==='undefined'?globalThis:window);
