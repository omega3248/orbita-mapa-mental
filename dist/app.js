(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const KEY = 'orbita-julian-map-v1';
 const Space=window.OrbitaSpace;
 const Color=window.OrbitaColor;
 const Links=window.OrbitaConnections;
 const DEFAULT_PLANES={XY:'#65eb83',XZ:'#f38173',YZ:'#8694ff'};
 const DEFAULT_PALETTE=['#d9ed91','#f7d094','#de91aa','#a994f7','#59e8df'];
 function normalizeTheme(raw){const planes={...DEFAULT_PLANES},sectors={};for(const key of Object.keys(planes))if(Color.hex(raw?.planes?.[key]))planes[key]=Color.hex(raw.planes[key]);for(const [key,value]of Object.entries(raw?.sectors||{}))if(/^(XY|XZ|YZ):[+-]{2}$/.test(key)&&Color.hex(value))sectors[key]=Color.hex(value);return {planes,sectors};}
 const categories = {money:{name:'Apoyo económico',short:'APOYO',symbol:'◈',color:'#d9e6b4',edge:'#8a9d74'},learn:{name:'Formación',short:'FORMACIÓN',symbol:'▤',color:'#badfdc',edge:'#648f8b'},venture:{name:'Emprendimiento',short:'EMPRENDER',symbol:'↗',color:'#d5c9e7',edge:'#9380af'},university:{name:'Universidad',short:'UNIVERSIDAD',symbol:'◇',color:'#efd4af',edge:'#ad8d67'}};
 const priorities = {5:'Muy alta',4:'Alta',3:'Media',2:'Baja',1:'Vigilancia'};
 const statuses = ['Por revisar','En proceso','Solicitada','Completada','Vigilar','Ruta futura','Descartada'];
 const depthFor = p => ({5:120,4:45,3:-15,2:-80,1:-155})[p];
 const clone = x => JSON.parse(JSON.stringify(x));
 const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
 const escape = value => String(value ?? '').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
 const safeUrl = value => {try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
 const finite = (v,f=0) => Number.isFinite(Number(v)) ? Number(v) : f;
 function normalize(raw,index=0){
   if(!raw || typeof raw!=='object' || typeof(raw.title??raw.name??raw.nombre)!=='string') throw new Error('Cada oportunidad debe incluir un nombre.');
   const title=String(raw.title??raw.name??raw.nombre).trim().slice(0,120);
   if(!title) throw new Error('Hay una oportunidad sin nombre.');
   const rawPriority=raw.priority??raw.importance??raw.prioridad??3;
   const priority=Object.keys(priorities).find(k=>priorities[k].toLowerCase()===String(rawPriority).toLowerCase()) || clamp(Math.round(finite(rawPriority,3)),1,5);
   const category=Object.hasOwn(categories,raw.category)?raw.category:'money';
   const date=String(raw.deadline??raw.fechaLimite??'');
   return {id:String(raw.id||'import-'+slug(title)).slice(0,160),title,category,priority:Number(priority),benefit:String(raw.benefit??raw.beneficio??'').slice(0,150),description:String(raw.description??raw.descripcion??'').slice(0,2500),deadline:/^\d{4}-\d{2}-\d{2}$/.test(date)&&!isNaN(Date.parse(date))?date:'',status:statuses.includes(raw.status)?raw.status:'Por revisar',next:String(raw.next??raw.siguientePaso??'').slice(0,1500),notes:String(raw.notes??raw.notas??'').slice(0,3000),url:safeUrl(raw.url??raw.link??raw.enlace??''),linkLabel:String(raw.linkLabel??'Abrir fuente oficial').slice(0,80),verified:raw.verified===true,x:clamp(finite(raw.x,(index%5-2)*330),-10000,10000),y:clamp(finite(raw.y,Math.floor(index/5)*315),-10000,10000),z:clamp(finite(raw.z,depthFor(Number(priority))),-2000,2000),width:clamp(finite(raw.width,144),64,520),height:clamp(finite(raw.height,94),40,400),thickness:clamp(finite(raw.thickness,48),24,300),color:Color.hex(raw.color),central:raw.central===true};
 }
 function slug(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);}
 let state={schema:1,sceneVersion:2,objectVersion:1,theme:normalizeTheme(),palette:[...DEFAULT_PALETTE],dragPlane:'free',cards:window.ORBITA_SEED.map(normalize),deleted:[],camera:{zoom:1,panX:0,panY:0,yaw:-25,pitch:35,flat:false},filter:'all',priorityFilter:0,view:'spatial',showLinks:true};
 state.links=Links.normalizeAll(window.ORBITA_LINKS,state.cards);
 let saved=false, migrated=false, storageAvailable=true;
 try {
   const text=localStorage.getItem(KEY);
   if(text){const s=JSON.parse(text);if(s.schema===1&&Array.isArray(s.cards)&&s.cards.length<=500){
     const deleted=Array.isArray(s.deleted)?s.deleted.filter(v=>typeof v==='string').slice(0,500):[];
     const byId=new Map(s.cards.map(normalize).map(c=>[c.id,c]));
     state.cards=Array.from(byId.values());state.deleted=deleted;
     state.theme=normalizeTheme(s.theme);if(Array.isArray(s.palette)&&s.palette.length===5&&s.palette.every(c=>Color.hex(c)))state.palette=s.palette.map(Color.hex);
     if(s.objectVersion!==1){state.cards.forEach(compactLegacy);migrated=true;}
     for(const c of window.ORBITA_SEED.map(normalize)) if(!byId.has(c.id)&&!deleted.includes(c.id)) state.cards.push(c);
     state.links=Links.normalizeAll(Array.isArray(s.links)?s.links:window.ORBITA_LINKS,state.cards);
     if(s.sceneVersion===2&&s.camera)state.camera=normalizeCamera(s.camera);
     else saved=false;
     state.dragPlane=['free','xy','xz','yz'].includes(s.dragPlane)?s.dragPlane:'free';
     state.filter=Object.hasOwn(categories,s.filter)?s.filter:'all';
     state.priorityFilter=clamp(Math.round(finite(s.priorityFilter)),0,5);
     state.view=s.view==='list'?'list':'spatial';state.showLinks=s.showLinks!==false;saved=s.sceneVersion===2;
   }}
 }catch { storageAvailable=false; $('save-indicator').textContent='Guardado no disponible · exporta tu mapa'; }
 function compactLegacy(c){c.width=clamp(Math.round(c.width*.58),64,520);c.height=clamp(Math.round(c.height*.55),40,400);c.thickness=clamp(Math.max(42,c.thickness),24,300);}
 function normalizeCamera(c){return {zoom:clamp(finite(c.zoom,1),.10,4),panX:clamp(finite(c.panX),-30000,30000),panY:clamp(finite(c.panY),-30000,30000),yaw:clamp(finite(c.yaw,-25),-180,180),pitch:clamp(finite(c.pitch,35),-82,82),flat:c.flat===true};}
 let selected=new Set(),focusedId=null, tool='pan',drag=null,editingId=null,dirtyFrame=false,detailsOpen=false,activeLinkId=null;
 const history=[], nodes=new Map(), projected=new Map();
 const board=$('board'),layer=$('cards-layer');
 const resizeControls=document.createElement('div');resizeControls.id='resize-controls';resizeControls.className='resize-controls';resizeControls.hidden=true;board.append(resizeControls);
 function snapshot(){history.push(clone({cards:state.cards,deleted:state.deleted,camera:state.camera,theme:state.theme,palette:state.palette,links:state.links}));if(history.length>30)history.shift();$('undo').disabled=false;}
 function cubeColor(c){return c.color||categories[c.category].color;}
 function sectorKey(plane,a,b){return plane+':'+(a<0?'-':'+')+(b<0?'-':'+');}
 function sectorColor(plane,a,b){return state.theme.sectors[sectorKey(plane,a,b)]||state.theme.planes[plane];}
 function paletteTargets(){
   const sectors=[];for(const plane of['XY','XZ','YZ'])for(const a of['-','+'])for(const b of['-','+'])sectors.push({value:'sector:'+plane+':'+a+b,label:plane+' · '+plane[0]+a+' / '+plane[1]+b});
   const targets=[{label:'Planos completos',items:[{value:'plane:XY',label:'Plano XY · horizontal'},{value:'plane:XZ',label:'Plano XZ · vertical'},{value:'plane:YZ',label:'Plano YZ · vertical'}]},{label:'Sectores del espacio',items:sectors}];
   const cards=[{value:'cards:all',label:'Todos los cuadros'}];if(selected.size)cards.push({value:'cards:selected',label:selected.size===1?'Cuadro seleccionado':'Los '+selected.size+' cuadros seleccionados'});
   cards.push(...state.cards.map(c=>({value:'card:'+c.id,label:c.title})));targets.push({label:'Cuadros de ideas',items:cards});
   const lines=editableLinks();if(lines.length)targets.push({label:'Líneas de los cuadros seleccionados',items:lines.map(l=>({value:'link:'+l.id,label:linkName(l)}))});return targets;
 }
 function targetCards(target){return target==='cards:all'?state.cards:target==='cards:selected'?state.cards.filter(c=>selected.has(c.id)):state.cards.filter(c=>c.id===target.slice(5));}
 function targetColor(target){if(target.startsWith('link:'))return editableLinks().find(l=>l.id===target.slice(5))?.color||Links.defaults.color;if(target.startsWith('plane:'))return state.theme.planes[target.slice(6)];if(target.startsWith('sector:')){const key=target.slice(7);return state.theme.sectors[key]||state.theme.planes[key.slice(0,2)];}const c=targetCards(target)[0];return c?cubeColor(c):DEFAULT_PALETTE[2];}
 function paintTarget(target,color,reset=false){
   if(target.startsWith('plane:')){const key=target.slice(6);state.theme.planes[key]=reset?DEFAULT_PLANES[key]:color;for(const sector of Object.keys(state.theme.sectors))if(sector.startsWith(key+':'))delete state.theme.sectors[sector];}
   else if(target.startsWith('sector:')){const key=target.slice(7);if(reset)delete state.theme.sectors[key];else state.theme.sectors[key]=color;}
   else if(target.startsWith('link:')){const link=editableLinks().find(l=>l.id===target.slice(5));if(link)link.color=reset?Links.defaults.color:color;}
   else for(const c of targetCards(target))c.color=reset?'':color;
 }
 const paletteEditor=new window.OrbitaPalette({targets:paletteTargets,defaultTarget:()=>selected.size?'cards:selected':'plane:XY',getColor:targetColor,getPalette:()=>state.palette,
   apply:(target,color,palette)=>{snapshot();paintTarget(target,color);state.palette=palette;save();renderAll();},
   reset:target=>{snapshot();paintTarget(target,'',true);save();renderAll();},
   savePalette:palette=>{snapshot();state.palette=palette;save();}
 });
 function save(){
   try {localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;$('save-indicator').textContent='Guardado en este navegador';}
   catch{storageAvailable=false;$('save-indicator').textContent='Guardado no disponible · exporta tu mapa';toast('No se pudo guardar aquí. Exporta una copia desde •••.');}
 }
 let toastTimer;
 function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
 function isVisible(c){return(state.filter==='all'||c.category===state.filter)&&(!state.priorityFilter||c.priority===state.priorityFilter);}
 function visibleCards(){return state.cards.filter(isVisible);}
 function rankDots(p){return '<span class="rank-dots" aria-label="Importancia '+escape(priorities[p])+'">'+[1,2,3,4,5].map(i=>'<i class="'+(i<=p?'on':'')+'"></i>').join('')+'</span>';}
 function dateText(c){if(!c.deadline)return c.status==='Vigilar'||c.status==='Ruta futura'?'PRÓXIMA EDICIÓN':'SIN FECHA';const d=new Date(c.deadline+'T12:00:00');return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'}).toUpperCase().replace('.','')+(c.verified?'':' *');}
 function project(c,withPan=true){return Space.project(c,withPan?state.camera:{...state.camera,panX:0,panY:0},board.clientWidth,board.clientHeight);}
 function renderCartesian(){
   const span=600;
   const defs=[{name:'XY',color:state.theme.planes.XY,axis:'z',extent:600},{name:'XZ',color:state.theme.planes.XZ,axis:'y',extent:500},{name:'YZ',color:state.theme.planes.YZ,axis:'x',extent:500}];
   for(const key of['XY','XZ','YZ'])board.style.setProperty('--plane-'+key.toLowerCase(),state.theme.planes[key]);
   const point=(def,a,b)=>def.axis==='z'?{x:a,y:b,z:0}:def.axis==='y'?{x:a,y:0,z:b}:{x:0,y:a,z:b};
   const xy=p=>{const q=project(p);return q.x.toFixed(2)+','+q.y.toFixed(2);};
   const line=(a,b,color,opacity,width=1,dash='')=>'<line x1="'+project(a).x+'" y1="'+project(a).y+'" x2="'+project(b).x+'" y2="'+project(b).y+'" stroke="'+color+'" stroke-opacity="'+opacity+'" stroke-width="'+width+'" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>';
   const pieces=[];
   for(const def of defs){
     for(const a of[-span,0])for(const b of[-def.extent,0]){
       const corners=[point(def,a,b),point(def,a+span,b),point(def,a+span,b+def.extent),point(def,a,b+def.extent)];
       const color=sectorColor(def.name,a,b);pieces.push({depth:corners.reduce((sum,p)=>sum+project(p).depth,0)/4,html:'<polygon data-sector="'+sectorKey(def.name,a,b)+'" points="'+corners.map(xy).join(' ')+'" fill="'+color+'" fill-opacity=".17" stroke="'+color+'" stroke-opacity=".4" stroke-width="1"/>'});
     }
   }
   pieces.sort((a,b)=>a.depth-b.depth);let markup=pieces.map(p=>p.html).join('');
   for(const def of defs){
     for(let i=-span;i<=span;i+=100)if(i!==0)for(const b of[-def.extent,0])markup+=line(point(def,i,b),point(def,i,b+def.extent),sectorColor(def.name,i,b),i%500===0?.4:.22,i%500===0?1.2:.7);
     for(let i=-def.extent;i<=def.extent;i+=100)if(i!==0)for(const a of[-span,0])markup+=line(point(def,a,i),point(def,a+span,i),sectorColor(def.name,a,i),i%500===0?.4:.22,i%500===0?1.2:.7);
   }
   const axes=[{key:'x',name:'X',color:Color.mix(state.theme.planes.XZ,'#ffffff',.18),extent:740},{key:'y',name:'Y',color:Color.mix(state.theme.planes.XY,'#ffffff',.18),extent:740},{key:'z',name:'Z',color:Color.mix(state.theme.planes.YZ,'#ffffff',.18),extent:620}];
   for(const a of axes){
     const pt=v=>({x:a.key==='x'?v:0,y:a.key==='y'?v:0,z:a.key==='z'?v:0});
     markup+=line(pt(-a.extent),pt(0),a.color,.55,1.6,'4 5')+line(pt(0),pt(a.extent),a.color,.9,1.8);
     const q=project(pt(a.extent)),r=project(pt(a.extent-40)),angle=Math.atan2(q.y-r.y,q.x-r.x);
     markup+='<path d="M '+(q.x-9*Math.cos(angle-.45))+' '+(q.y-9*Math.sin(angle-.45))+' L '+q.x+' '+q.y+' L '+(q.x-9*Math.cos(angle+.45))+' '+(q.y-9*Math.sin(angle+.45))+'" fill="none" stroke="'+a.color+'" stroke-width="2"/>';
     markup+='<text x="'+(q.x+12)+'" y="'+(q.y-9)+'" fill="'+a.color+'" class="axis-label">'+a.name+'</text>';
     for(let v=-Math.floor(a.extent/100)*100;v<a.extent;v+=100){if(!v)continue;const p=project(pt(v));markup+='<circle cx="'+p.x+'" cy="'+p.y+'" r="1.8" fill="'+a.color+'"/>';if(v%500===0&&state.camera.zoom>.4)markup+='<text x="'+(p.x+6)+'" y="'+(p.y+13)+'" fill="'+a.color+'" class="axis-tick">'+v+'</text>';}
   }
   const zero=project({x:0,y:0,z:0});markup+='<circle cx="'+zero.x+'" cy="'+zero.y+'" r="4" fill="#e6eadd"/><text x="'+(zero.x+8)+'" y="'+(zero.y+15)+'" fill="#dbe6dc" class="axis-tick">0</text>';
   $('cartesian').innerHTML=markup;
 }
 function requestRender(){if(dirtyFrame)return;dirtyFrame=true;requestAnimationFrame(()=>{dirtyFrame=false;renderMap();});}
 function renderMap(){
   projected.clear();const visible=visibleCards(),ids=new Set(state.cards.map(c=>c.id));
   layer.style.left=(board.clientWidth/2+state.camera.panX)+'px';layer.style.top=(board.clientHeight/2+state.camera.panY)+'px';
   layer.style.transform='scale('+state.camera.zoom+') '+(state.camera.flat?'':'perspective('+Space.F+'px) ')+'matrix3d('+Space.viewMatrix(state.camera).join(',')+')';
   for(const[id,n]of nodes)if(!ids.has(id)){n.remove();nodes.delete(id);}
   for(const c of state.cards){
     let n=nodes.get(c.id);if(!n){n=document.createElement('div');n.className='opportunity solid-box';n.dataset.id=c.id;n.tabIndex=0;n.setAttribute('role','button');nodes.set(c.id,n);layer.append(n);}
     n.hidden=!isVisible(c);if(n.hidden)continue;
     const p=project(c);projected.set(c.id,p);const cat=categories[c.category];
     const meta=JSON.stringify([c.title,c.category,c.priority,c.color]);
     if(n.dataset.meta!==meta){
       n.innerHTML=['front','back','right','left','top','bottom'].map(face=>'<div class="cube-face face-'+face+'" data-face="'+face+'" aria-hidden="true"><span class="face-category">'+cat.symbol+' '+cat.short+'</span><h3>'+escape(c.title)+'</h3></div>').join('');n.dataset.meta=meta;
       const base=cubeColor(c),edge=c.color?Color.mix(base,'#000000',.28):cat.edge;
       n.style.setProperty('--card-color',base);n.style.setProperty('--edge-color',edge);n.style.setProperty('--card-ink',Color.ink(base));n.style.setProperty('--side-ink',Color.ink(Color.mix(base,'#304b43',.2)));n.style.setProperty('--top-ink',Color.ink(Color.mix(base,'#ffffff',.08)));n.style.setProperty('--edge-ink',Color.ink(edge));
     }
     n.tabIndex=p.x>=-80&&p.x<=board.clientWidth+80&&p.y>=-45&&p.y<=board.clientHeight+45?0:-1;
     n.classList.toggle('selected',selected.has(c.id));n.classList.toggle('dragging',drag?.kind==='card'&&drag.ids.includes(c.id));n.setAttribute('aria-pressed',String(selected.has(c.id)));
     n.setAttribute('aria-label',c.title+', '+priorities[c.priority]+'. Clic derecho sostenido para seleccionar y mover. Arrastra sus tiradores con el izquierdo para cambiar el tamaño.');
     n.style.width=c.width+'px';n.style.height=c.height+'px';n.style.left=(-c.width/2)+'px';n.style.top=(-c.height/2)+'px';
     n.style.setProperty('--box-width',c.width+'px');n.style.setProperty('--box-height',c.height+'px');n.style.setProperty('--box-depth',c.thickness+'px');
     n.style.transform='translate3d('+c.x+'px,'+(-c.z)+'px,'+c.y+'px)';n.style.visibility=p.scale<=0||p.depth>Space.F-100?'hidden':'';
   }
   $('board-empty').hidden=visible.length>0;$('zoom-value').textContent=Math.round(state.camera.zoom*100)+'%';
   $('visible-count').textContent=visible.length+' oportunidad'+(visible.length===1?'':'es');
   $('selection-count').textContent=selected.size?selected.size+' seleccionada'+(selected.size===1?'':'s'):'Ninguna seleccionada';
   renderCartesian();renderConnections();renderMini();renderResizeHandles();renderQuickSize();
 }
 function renderQuickSize(){
   const c=state.cards.find(c=>c.id===focusedId);resizeControls.hidden=!c||!isVisible(c);if(resizeControls.hidden)return;
   const p=project(c);
   if(resizeControls.dataset.id!==c.id){
     resizeControls.dataset.id=c.id;
     resizeControls.innerHTML='<div class="resize-controls-heading"><strong>Cambiar tamaño</strong><button data-open-color>Color</button><button data-open-details>Detalles</button></div><p class="resize-controls-name"></p><div class="quick-dimensions">'+[['width','Ancho X'],['thickness','Largo Y'],['height','Alto Z']].map(([key,label])=>'<label>'+label+'<input type="number" data-quick-size="'+key+'" aria-label="'+label+' del cuadro" min="'+Space.limits[key][0]+'" max="'+Space.limits[key][1]+'" step="1"></label>').join('')+'</div><small>Arrastra las esquinas o los lados con el izquierdo.</small><div data-connection-settings></div><div class="resize-controls-actions"><button type="button" class="delete" data-delete-card>Eliminar cuadro</button></div>';
   }
   resizeControls.querySelector('.resize-controls-name').textContent=c.title;
   resizeControls.querySelector('[data-open-details]').textContent=detailsOpen?'Ocultar detalles':'Detalles';
   resizeControls.querySelectorAll('[data-quick-size]').forEach(input=>{if(input!==document.activeElement)input.value=Math.round(c[input.dataset.quickSize]);});
   renderConnectionSettings(resizeControls.querySelector('[data-connection-settings]'),c);
   resizeControls.style.top=(p.y<board.clientHeight/2?Math.max(66,board.clientHeight-resizeControls.offsetHeight-20):66)+'px';
 }
 let quickSnapshot=false,quickSaveTimer;
 resizeControls.addEventListener('input',e=>{
   const key=e.target.dataset.quickSize;if(!key||e.target.value===''||!Number.isFinite(Number(e.target.value)))return;
   if(!quickSnapshot){snapshot();quickSnapshot=true;}const value=clamp(Number(e.target.value),...Space.limits[key]);
   for(const c of state.cards)if(selected.has(c.id))c[key]=value;
   requestRender();clearTimeout(quickSaveTimer);quickSaveTimer=setTimeout(save,200);
 });
 resizeControls.addEventListener('change',e=>{if(e.target.dataset.quickSize){quickSnapshot=false;save();}});
 resizeControls.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();save();}});
 resizeControls.addEventListener('click',e=>{if(e.target.closest('[data-delete-card]')){deleteFocusedCard();return;}if(e.target.closest('[data-connect-selected]'))connectSelected();if(e.target.closest('[data-remove-link]'))removeActiveLink();if(e.target.closest('[data-line-palette]')&&getEditableLink())paletteEditor.open('link:'+activeLinkId);if(e.target.closest('[data-open-color]'))paletteEditor.open('cards:selected');if(e.target.closest('[data-open-details]')){detailsOpen=!detailsOpen;renderInspector();requestRender();}});
 function editableLinks(){return state.links.filter(l=>selected.has(l.from)||selected.has(l.to));}
 function getEditableLink(){return editableLinks().find(l=>l.id===activeLinkId);}
 function linkName(l){const from=state.cards.find(c=>c.id===l.from),to=state.cards.find(c=>c.id===l.to);return (from?.title||'Cuadro')+' ↔ '+(to?.title||'Cuadro');}
 function connectSelected(){
   const cards=[...selected].map(id=>state.cards.find(c=>c.id===id)).filter(Boolean);if(cards.length<2)return;
   const anchor=cards.find(c=>c.id===focusedId&&c.central)||cards.find(c=>c.central)||cards.find(c=>c.id===focusedId)||cards[0];
   const fresh=cards.filter(c=>c.id!==anchor.id&&!state.links.some(l=>(l.from===anchor.id&&l.to===c.id)||(l.to===anchor.id&&l.from===c.id)));
   if(!fresh.length){toast('Estos cuadros ya están conectados.');return;}if(state.links.length+fresh.length>2000){toast('El mapa admite hasta 2000 conexiones.');return;}
   snapshot();for(const c of fresh){const l={...Links.defaults,id:'line-'+crypto.randomUUID(),from:anchor.id,to:c.id,label:''};state.links.push(l);activeLinkId=l.id;}
   state.showLinks=true;save();renderAll();toast(fresh.length+(fresh.length===1?' conexión creada.':' conexiones creadas.'));
 }
 function removeActiveLink(){const l=getEditableLink();if(!l)return;snapshot();state.links=state.links.filter(v=>v.id!==l.id);activeLinkId=null;save();renderAll();toast('Conexión eliminada. Puedes deshacer el cambio.');}
 function renderConnectionSettings(host,c){
   const links=editableLinks();if(!links.some(l=>l.id===activeLinkId))activeLinkId=links[0]?.id||null;
   const signature=JSON.stringify([[...selected],focusedId,links,c.central,state.cards.map(v=>[v.id,v.title,v.central])]);if(host.dataset.signature===signature)return;
   const wasOpen=host.querySelector('details')?.open||false;host.dataset.signature=signature;const l=getEditableLink(),from=state.cards.find(v=>v.id===l?.from),to=state.cards.find(v=>v.id===l?.to),centralDirection=from?.central||to?.central;
   const options=(items,value)=>items.map(([key,label])=>'<option value="'+key+'" '+(value===key?'selected':'')+'>'+escape(label)+'</option>').join('');
   host.innerHTML='<details class="connection-settings" '+(wasOpen||selected.size>1?'open':'')+'><summary>Conexiones <span>'+links.length+'</span></summary><div class="connection-content"><p class="connection-tip">Ctrl + clic añade o quita cuadros de la selección.</p><label class="central-option"><input type="checkbox" data-central-card '+(c.central?'checked':'')+'> Cuadro central</label><p class="connection-tip">Las flechas salen de este cuadro hacia sus conexiones.</p>'+
     '<button type="button" class="connect-selected" data-connect-selected '+(selected.size<2?'disabled':'')+'>Conectar '+(selected.size>1?selected.size+' cuadros seleccionados':'cuadros seleccionados')+'</button>'+(selected.size>1?'<p class="connection-tip">Se unen al central seleccionado o al último cuadro elegido.</p>':'')+
     (l?'<label class="connection-label">Línea conectada<select data-link-choice aria-label="Línea conectada">'+links.map(v=>'<option value="'+escape(v.id)+'" '+(v.id===activeLinkId?'selected':'')+'>'+escape(linkName(v))+'</option>').join('')+'</select></label><div class="connection-fields"><label>Forma<select data-link-property="shape" aria-label="Forma de la línea">'+options([['straight','Recta'],['curve','Curva'],['elbow','En ángulo']],l.shape)+'</select></label><label>Tipo de línea<select data-link-property="style" aria-label="Tipo de línea">'+options([['dotted','Punteada'],['dashed','Discontinua'],['solid','Continua']],l.style)+'</select></label><label>Grosor<input type="number" data-link-property="width" aria-label="Grosor de la línea" min="0.6" max="8" step="0.2" value="'+l.width+'"></label><label>Color<div class="connection-color"><input type="color" data-link-property="color" aria-label="Color de la línea" value="'+l.color+'"><button type="button" data-line-palette>Paleta</button></div></label></div><label class="connection-label">Código HEX<input data-link-property="color" aria-label="Código HEX de la línea" value="'+l.color.toUpperCase()+'" maxlength="7" spellcheck="false"></label><label class="connection-label">Dirección<select data-link-property="direction" aria-label="Dirección de la línea" '+(centralDirection?'disabled':'')+'>'+options([['none','Sin flecha'],['forward',from.title+' → '+to.title],['reverse',to.title+' → '+from.title],['both','Flechas en ambos sentidos']],centralDirection?(from.central&&to.central?'both':from.central?'forward':'reverse'):l.direction)+'</select></label>'+(centralDirection?'<p class="connection-tip">La dirección la fija el cuadro central. Desmarca esa opción para elegir otro sentido.</p>':'')+'<button type="button" class="remove-link" data-remove-link>Quitar conexión</button>':'<p class="connection-tip">Selecciona otro cuadro con Ctrl para crear una conexión.</p>')+'</div></details>';
   host.querySelector('details').addEventListener('toggle',()=>requestRender());
 }
 resizeControls.addEventListener('change',e=>{
   if(e.target.matches('[data-central-card]')){const c=state.cards.find(c=>c.id===focusedId);if(!c||!selected.has(c.id))return;snapshot();c.central=e.target.checked;save();renderAll();return;}
   if(e.target.matches('[data-link-choice]')){activeLinkId=e.target.value;renderQuickSize();return;}
   const property=e.target.dataset.linkProperty,l=getEditableLink();if(!property||!l)return;lineInputSnapshot=null;let value=e.target.value;
   if(property==='color'){value=Color.hex(value);if(!value){e.target.setAttribute('aria-invalid','true');toast('Usa un color HEX como #A994F7.');return;}e.target.removeAttribute('aria-invalid');}
   if(property==='width'){if(value===''||!Number.isFinite(Number(value))){e.target.value=l.width;return;}value=clamp(Number(value),.6,8);}
   const choices={shape:['straight','curve','elbow'],style:['dotted','dashed','solid'],direction:['none','forward','reverse','both']};if(choices[property]&&!choices[property].includes(value))return;
   if(property==='direction'&&state.cards.some(c=>(c.id===l.from||c.id===l.to)&&c.central))return;
   if(l[property]===value){e.target.value=property==='color'&&e.target.type!=='color'?value.toUpperCase():value;save();return;}snapshot();l[property]=value;save();renderAll();
 });
 let lineInputSnapshot=null,lineSaveTimer;
 resizeControls.addEventListener('focusout',e=>{if(e.target.dataset.linkProperty){lineInputSnapshot=null;save();}});
 resizeControls.addEventListener('input',e=>{
   const property=e.target.dataset.linkProperty,l=getEditableLink();if(!l||!['color','width'].includes(property))return;
   let value=e.target.value;
   if(property==='color'){value=Color.hex(value);e.target.setAttribute('aria-invalid',String(!value));if(!value)return;}
   else{if(value===''||!Number.isFinite(Number(value)))return;value=clamp(Number(value),.6,8);}
   if(l[property]===value)return;const token=l.id+':'+property;if(lineInputSnapshot!==token){snapshot();lineInputSnapshot=token;}l[property]=value;
   resizeControls.querySelectorAll('[data-link-property="'+property+'"]').forEach(input=>{if(input!==e.target)input.value=input.type==='color'?value:property==='color'?value.toUpperCase():value;});
   const host=resizeControls.querySelector('[data-connection-settings]'),c=state.cards.find(c=>c.id===focusedId);host.dataset.signature=JSON.stringify([[...selected],focusedId,editableLinks(),c.central,state.cards.map(v=>[v.id,v.title,v.central])]);
   renderConnections();clearTimeout(lineSaveTimer);lineSaveTimer=setTimeout(save,150);
 });
 function resizeHandleDefinitions(c){
   const list=[];let index=0;
   for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])list.push({token:'corner-'+index++,mode:'uniform',sx,sy,sz,point:Space.corner(c,sx,sy,sz),label:'Tamaño proporcional · esquina '+index});
   for(const sign of[-1,1]){
     list.push({token:'width-'+sign,mode:'width',sign,axis:{x:sign,y:0,z:0},point:{x:c.x+sign*c.width/2,y:c.y+c.thickness/2,z:c.z},label:'Ancho · eje X'});
     list.push({token:'height-'+sign,mode:'height',sign,axis:{x:0,y:0,z:sign},point:{x:c.x,y:c.y+c.thickness/2,z:c.z+sign*c.height/2},label:'Alto · eje Z'});
     list.push({token:'thickness-'+sign,mode:'thickness',sign,axis:{x:0,y:sign,z:0},point:{x:c.x-c.width/4,y:c.y+sign*c.thickness/2,z:c.z+c.height/2},label:'Largo · eje Y'});
   }
   return list;
 }
 function renderResizeHandles(){
   const svg=$('resize-layer'),c=state.cards.find(c=>c.id===focusedId);
   if(!c||!isVisible(c)){svg.innerHTML='';return;}
   const active=document.activeElement?.closest('[data-resize]')?.dataset.token;
   const vertices=[];for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])vertices.push({sx,sy,sz,...project(Space.corner(c,sx,sy,sz))});
   const lines=[];for(let i=0;i<vertices.length;i++)for(let j=i+1;j<vertices.length;j++){const a=vertices[i],b=vertices[j];if(['sx','sy','sz'].filter(k=>a[k]!==b[k]).length===1)lines.push('<line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" class="resize-edge"/>');}
   const handles=resizeHandleDefinitions(c).map(h=>{const p=project(h.point),isCorner=h.mode==='uniform',size=isCorner?10:11;return '<g class="resize-handle '+(isCorner?'corner-handle':'axis-handle '+h.mode)+'" data-resize="'+h.mode+'" data-token="'+h.token+'" data-id="'+escape(c.id)+'" tabindex="0" role="button" aria-label="'+h.label+'" transform="translate('+p.x+' '+p.y+')"><title>'+h.label+' · arrastra con el clic izquierdo</title><rect class="handle-hit" x="-11" y="-11" width="22" height="22"/><rect class="handle-grip" x="'+(-size/2)+'" y="'+(-size/2)+'" width="'+size+'" height="'+size+'" rx="'+(isCorner?0:1)+'"/></g>';}).join('');
   const minY=Math.min(...vertices.map(p=>p.y)),center=project(c);
   svg.innerHTML=lines.join('')+handles+'<text class="resize-caption" x="'+center.x+'" y="'+(minY-16)+'" text-anchor="middle">Esquinas: proporcional · Bordes: X / Y / Z</text>';
   if(active)svg.querySelector('[data-token="'+active+'"]')?.focus({preventScroll:true});
 }
 function startResize(e,element){
   const c=state.cards.find(c=>c.id===element.dataset.id),h=resizeHandleDefinitions(c).find(h=>h.token===element.dataset.token),p=localPointer(e),screen=project(h.point),origin=clone(c);
   let axis,anchor;
   if(h.mode==='uniform'){anchor=Space.corner(c,-h.sx,-h.sy,-h.sz);const diagonal=Space.sub(h.point,anchor);axis=Space.mul(diagonal,1/Math.sqrt(Space.dot(diagonal,diagonal)));}
   else{axis=h.axis;anchor=Space.sub(h.point,Space.mul(axis,c[h.mode]));}
   drag={kind:'resize',id:c.id,handle:h,origin,anchor,axis,normal:Space.linePlane(axis,state.camera),offset:{x:p.x-screen.x,y:p.y-screen.y},startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false,pointerId:e.pointerId};
   board.setPointerCapture(e.pointerId);board.classList.add('resizing');e.preventDefault();
 }
 function updateResize(x,y,moving=true){
   if(drag?.kind!=='resize')return;
   if(moving&&!drag.moved&&Math.hypot(x-drag.startX,y-drag.startY)<2)return;
   const c=state.cards.find(c=>c.id===drag.id),h=drag.handle,o=drag.origin;
   const hit=drag.normal?Space.intersect(x-drag.offset.x,y-drag.offset.y,state.camera,board.clientWidth,board.clientHeight,drag.anchor,drag.normal):null;
   let updated;
   if(h.mode==='uniform'){
     const diagonal=Space.sub(h.point,drag.anchor),ratio=hit?Space.dot(Space.sub(hit,drag.anchor),diagonal)/Space.dot(diagonal,diagonal):1+(x-drag.startX-y+drag.startY)/200;
     updated=Space.resizeUniform(o,h.sx,h.sy,h.sz,ratio);
   }else{const size=hit?Space.dot(Space.sub(hit,drag.anchor),drag.axis):o[h.mode]+(x-drag.startX-y+drag.startY)/state.camera.zoom;updated=Space.resizeAxis(o,h.mode,h.sign,size);}
   if(!drag.moved){snapshot();drag.moved=true;}Object.assign(c,updated);syncGeometry(c);requestRender();
 }
 function syncGeometry(c){
   for(const key of['width','height','thickness']){const input=$('card-'+key),value=$(key+'-value');if(input)input.value=Math.round(c[key]);if(value)value.textContent=Math.round(c[key]);}
   document.querySelectorAll('[data-coordinate]').forEach(input=>{if(input!==document.activeElement)input.value=Math.round(c[input.dataset.coordinate]);});
 }
 function renderConnections(){
   if(!state.showLinks){$('connections').innerHTML='';return;}
   const paths=[];
   const cards=new Map(state.cards.map(c=>[c.id,c])),polygons=new Map();
   const polygon=id=>{if(!polygons.has(id)){const c=cards.get(id),points=[];for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])points.push(project(Space.corner(c,x,y,z)));polygons.set(id,Links.hull(points));}return polygons.get(id);};
   for(const [index,link]of state.links.entries()){const a=projected.get(link.from),b=projected.get(link.to);if(!a||!b||a.scale<=0||b.scale<=0)continue;
     const highlight=selected.has(link.from)||selected.has(link.to),g=Links.geometry(a,b,polygon(link.from),polygon(link.to),link.shape);if(!g)continue;
     const arrow=Links.arrows(link,cards.get(link.from),cards.get(link.to)),marker='connection-arrow-'+index,size=8+link.width*.8;
     if(arrow.start||arrow.end)paths.push('<defs><marker id="'+marker+'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="'+size+'" markerHeight="'+size+'" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><polygon points="0,1 9,5 0,9" fill="'+link.color+'"/></marker></defs>');
     const dash=link.style==='dotted'?'1 '+(4+link.width):link.style==='dashed'?'8 6':'none';
     paths.push('<path data-connection-id="'+escape(link.id)+'" d="'+g.path+'" style="stroke:'+link.color+';stroke-width:'+link.width+';stroke-dasharray:'+dash+';stroke-linecap:round;opacity:'+(highlight?.72:.38)+'"'+(arrow.start?' marker-start="url(#'+marker+')"':'')+(arrow.end?' marker-end="url(#'+marker+')"':'')+'/>');
     if(highlight&&link.label&&Math.hypot(b.x-a.x,b.y-a.y)>160)paths.push('<text x="'+g.mid.x+'" y="'+(g.mid.y-10)+'" text-anchor="middle">'+escape(link.label)+'</text>');
   }$('connections').innerHTML=paths.join('');
 }
 function renderMini(){
   const cards=visibleCards();if(!cards.length){$('mini-svg').innerHTML='';return;}
   const minX=Math.min(...cards.map(c=>c.x))-150,maxX=Math.max(...cards.map(c=>c.x))+150,minY=Math.min(...cards.map(c=>c.y))-120,maxY=Math.max(...cards.map(c=>c.y))+120;
   const s=Math.min(145/(maxX-minX),76/(maxY-minY));
   $('mini-svg').innerHTML=cards.map(c=>'<rect x="'+((c.x-minX)*s+3)+'" y="'+((c.y-minY)*s+4)+'" width="10" height="6" rx="1.5" fill="'+cubeColor(c)+'" opacity="'+(selected.has(c.id)?1:.55)+'"/>').join('');
 }
 function renderChrome(){
   for(const k of ['all',...Object.keys(categories)])$('count-'+k).textContent=k==='all'?state.cards.length:state.cards.filter(c=>c.category===k).length;
   document.querySelectorAll('[data-filter]').forEach(b=>{const a=b.dataset.filter===state.filter;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));});
   document.querySelectorAll('[data-priority-filter]').forEach(b=>{const a=Number(b.dataset.priorityFilter)===state.priorityFilter;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));});
   $('spatial-view').classList.toggle('active',state.view==='spatial');$('list-view').classList.toggle('active',state.view==='list');$('spatial-view').setAttribute('aria-pressed',String(state.view==='spatial'));$('list-view').setAttribute('aria-pressed',String(state.view==='list'));
   board.hidden=state.view==='list';$('list-panel').hidden=state.view!=='list';$('show-links').setAttribute('aria-pressed',String(state.showLinks));$('flat').setAttribute('aria-pressed',String(state.camera.flat));$('flat').classList.toggle('active',state.camera.flat);
 }
 function renderList(){
   $('list-panel').innerHTML=visibleCards().sort((a,b)=>b.priority-a.priority).map(c=>'<button class="list-item '+(selected.has(c.id)?'selected':'')+'" data-list-id="'+escape(c.id)+'" aria-pressed="'+selected.has(c.id)+'"><div><h3>'+escape(c.title)+'</h3><p>'+escape(c.benefit||categories[c.category].name)+' · '+escape(c.status)+'</p></div><span class="list-priority">'+escape(priorities[c.priority])+'</span></button>').join('');
   if(!visibleCards().length)$('list-panel').innerHTML='<p class="detail-description">No hay oportunidades en esta vista.</p>';
 }
 function renderAll(){renderChrome();renderMap();renderList();renderInspector();}
 function select(id,add=false){
   if(id!==focusedId)detailsOpen=state.view==='list';
   if(add){if(selected.has(id)){selected.delete(id);if(focusedId===id)focusedId=[...selected].at(-1)||null;}else{selected.add(id);focusedId=id;}}
   else{selected=new Set([id]);focusedId=id;}
   renderMap();renderList();renderInspector();
 }
 function clearSelection(){selected.clear();focusedId=null;detailsOpen=false;renderMap();renderList();renderInspector();}
 function renderInspector(){
   const c=state.cards.find(c=>c.id===focusedId);
   $('inspector').hidden=!c||(!detailsOpen&&state.view==='spatial');if(!c)return;
   const html=[
     '<div class="detail-top"><span>OPORTUNIDAD '+(state.cards.indexOf(c)+1).toString().padStart(2,'0')+'</span><button class="icon-button" data-action="close" aria-label="Cerrar detalle">×</button></div>',
     selected.size>1?'<div class="detail-multi">'+selected.size+' tarjetas seleccionadas. Importancia y tamaño se aplican a todas.</div>':'',
     '<p class="detail-type">'+escape(categories[c.category].name.toUpperCase())+'</p><h2>'+escape(c.title)+'</h2>',
     '<p class="detail-benefit">'+escape(c.benefit||'Beneficio por definir')+'</p>',geometryControls(c),
     '<div class="detail-section"><label>IMPORTANCIA</label><div class="priority-buttons">'+[5,4,3,2,1].map(p=>'<button data-set-priority="'+p+'" class="'+(c.priority===p?'active':'')+'" aria-label="Importancia '+priorities[p]+'" aria-pressed="'+(c.priority===p)+'">'+(6-p)+'</button>').join('')+'</div><div class="priority-caption"><span>Muy alta</span><span>'+escape(priorities[c.priority])+'</span><span>Vigilancia</span></div></div>',
     '<p class="detail-description">'+escape(c.description||'Añade una descripción para esta oportunidad.')+'</p>',
     '<div class="detail-verify '+(c.verified?'verified':'')+'">'+(c.verified?'✓ Marcada como verificada por ti.':'* Datos recuperados del chat. Fecha, disponibilidad y condiciones por verificar en la fuente oficial.')+'</div>',
     '<div class="detail-section"><label for="detail-status">ESTADO</label><select id="detail-status">'+statuses.map(s=>'<option '+(s===c.status?'selected':'')+'>'+escape(s)+'</option>').join('')+'</select></div>',
     c.deadline?'<div class="detail-section"><span class="section-title">FECHA '+(c.verified?'VERIFICADA':'DEL CHAT')+'</span><span class="detail-date">'+escape(new Date(c.deadline+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}))+'</span></div>':'',
     '<div class="detail-section"><span class="section-title">PRÓXIMO PASO</span><p class="detail-next">'+escape(c.next||'Define una acción concreta al editar esta tarjeta.')+'</p></div>',
     c.notes?'<div class="detail-section"><span class="section-title">TUS NOTAS</span><p class="detail-notes">'+escape(c.notes)+'</p></div>':'',
     safeUrl(c.url)?'<a class="button primary detail-link" target="_blank" rel="noopener noreferrer" href="'+escape(safeUrl(c.url))+'">'+escape(c.linkLabel||'Abrir fuente oficial')+' ↗</a>':'',
     '<div class="detail-actions"><button data-action="edit">✎ Editar tarjeta</button><button data-action="delete" class="delete">Eliminar</button></div>'
   ];$('inspector').innerHTML=html.join('');
   $('detail-status').onchange=e=>{snapshot();c.status=e.target.value;save();renderAll();};
   let controlSnapshot=false;
   document.querySelectorAll('[data-dimension]').forEach(input=>{
     input.oninput=e=>{if(!controlSnapshot){snapshot();controlSnapshot=true;}const key=e.target.dataset.dimension,value=Number(e.target.value);for(const card of state.cards)if(selected.has(card.id))card[key]=value;$(key+'-value').textContent=value;requestRender();};
     input.onchange=()=>{controlSnapshot=false;save();};
   });
   $('drag-plane').onchange=e=>{state.dragPlane=e.target.value;save();};
   let coordinateSnapshot=false,coordinateTimer;
   document.querySelectorAll('[data-coordinate]').forEach(input=>{
     input.oninput=e=>{if(e.target.value===''||!Number.isFinite(Number(e.target.value)))return;if(!coordinateSnapshot){snapshot();coordinateSnapshot=true;}const key=e.target.dataset.coordinate,limit=key==='z'?2000:10000,value=clamp(Number(e.target.value),-limit,limit),delta=value-c[key];for(const card of state.cards)if(selected.has(card.id))card[key]=clamp(card[key]+delta,-limit,limit);requestRender();clearTimeout(coordinateTimer);coordinateTimer=setTimeout(save,200);};
     input.onchange=e=>{coordinateSnapshot=false;e.target.value=Math.round(c[e.target.dataset.coordinate]);save();};
     input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();save();}};
   });
 }
 function geometryControls(c){
   const dimensions=[['width','Ancho · X',64,520],['height','Alto · Z',40,400],['thickness','Largo · Y',24,300]];
   return '<div class="geometry-controls"><span class="section-title">TAMAÑO DE LA TARJETA</span>'+dimensions.map(([key,label,min,max])=>'<div class="dimension-control"><div class="detail-slider-label"><label for="card-'+key+'">'+label+'</label><span><b id="'+key+'-value">'+Math.round(c[key])+'</b></span></div><input id="card-'+key+'" data-dimension="'+key+'" type="range" min="'+min+'" max="'+max+'" step="1" value="'+c[key]+'"></div>').join('')+'<label class="section-title" for="drag-plane">MOVER EN</label><select id="drag-plane">'+[['free','Espacio libre · sigue al puntero'],['xy','Plano verde XY · altura fija'],['xz','Plano rojo XZ · fondo fijo'],['yz','Plano azul YZ · lateral fijo']].map(([value,label])=>'<option value="'+value+'" '+(state.dragPlane===value?'selected':'')+'>'+label+'</option>').join('')+'</select><div class="coordinate-inputs">'+['x','y','z'].map(key=>'<label>'+key.toUpperCase()+'<input aria-label="Posición '+key.toUpperCase()+'" data-coordinate="'+key+'" type="number" min="'+(key==='z'?-2000:-10000)+'" max="'+(key==='z'?2000:10000)+'" step="1" value="'+Math.round(c[key])+'"></label>').join('')+'</div><p class="geometry-tip">Esquinas: tamaño proporcional · Bordes: ancho, largo y alto. Arrastra los tiradores con el izquierdo.</p></div>';
 }
 function fit(cards=visibleCards(),persist=true){
   if(state.view==='list'){if(persist)save();return;}
   if(!cards.length)return;
   state.camera.zoom=1;state.camera.panX=0;state.camera.panY=0;
   const points=cards.map(c=>project(c,false));
   const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
   const availableW=Math.max(board.clientWidth-110,200),availableH=Math.max(board.clientHeight-160,160);
   state.camera.zoom=clamp(Math.min(availableW/(maxX-minX+Math.max(...cards.map(c=>c.width))),availableH/(maxY-minY+Math.max(...cards.map(c=>c.height)))),.10,1.1);
   state.camera.panX=-(minX+maxX-board.clientWidth)/2*state.camera.zoom;
   state.camera.panY=-(minY+maxY-board.clientHeight)/2*state.camera.zoom-8;
   requestRender();if(persist)save();
 }
 function zoom(factor,x=board.clientWidth/2,y=board.clientHeight/2){
   state.camera=Space.zoomAt(state.camera,factor,x,y,board.clientWidth,board.clientHeight);
   if(drag?.kind==='card')updateCardDrag(drag.lastX,drag.lastY,false);
   if(drag?.kind==='resize')updateResize(drag.lastX,drag.lastY,false);
   requestRender();
 }
 function homeView(persist=true){
   const cards=state.cards.filter(c=>c.priority>=4);fit(cards,false);
   if(state.view==='spatial'&&cards.length){
     if(board.clientWidth<450){state.camera.zoom=.65;const p=project(cards[0],false);state.camera.panX=board.clientWidth/2-p.x;state.camera.panY=board.clientHeight/2-p.y-25;}
     else if(board.clientWidth>740&&state.camera.zoom<.72){const ratio=.72/state.camera.zoom;state.camera.zoom=.72;state.camera.panX*=ratio;state.camera.panY*=ratio;}
   }
   requestRender();if(persist)save();
 }
 function screenDelta(c,dx,dy){
   const p=project(c),normal=Space.basis(state.camera).w,target=Space.intersect(p.x+dx,p.y+dy,state.camera,board.clientWidth,board.clientHeight,c,normal);
   return target?Space.sub(target,c):{x:0,y:0,z:0};
 }
 function localPointer(e){const r=board.getBoundingClientRect();return {x:e.clientX-r.left-board.clientLeft,y:e.clientY-r.top-board.clientTop};}
 function updateCardDrag(x,y,moving=true){
   if(drag?.kind!=='card')return;
   const point=Space.intersect(x,y,state.camera,board.clientWidth,board.clientHeight,drag.planePoint,drag.normal);
   if(!point)return;
   if(moving&&!drag.moved&&Math.hypot(x-drag.startX,y-drag.startY)<3)return;
   if(!drag.moved&&moving){snapshot();drag.moved=true;}
   for(const offset of drag.offsets){const c=state.cards.find(c=>c.id===offset.id);if(!c)continue;const p=Space.add(point,offset);c.x=clamp(p.x,-10000,10000);c.y=clamp(p.y,-10000,10000);c.z=clamp(p.z,-2000,2000);}
 }
 board.addEventListener('contextmenu',e=>e.preventDefault());
 board.addEventListener('pointerdown',e=>{
   if(drag)return;const handle=e.target.closest('[data-resize]');
   if(handle&&e.button===0){startResize(e,handle);return;}
   if(e.target.closest('.map-tools,.resize-controls,button,input,select,textarea,a,.zoom-value'))return;
   const n=e.target.closest('.opportunity')||(e.button===2&&handle?nodes.get(handle.dataset.id):null),isTouch=e.pointerType==='touch';
   if(e.button===2&&!n){clearSelection();e.preventDefault();return;}
   if(e.button===2&&n||isTouch&&n){
     const id=n.dataset.id;
     detailsOpen=false;
     if(e.ctrlKey||e.metaKey||e.shiftKey){select(id,true);if(!selected.has(id))return;}else if(!selected.has(id))select(id);
     focusedId=id;renderInspector();
     const c=state.cards.find(c=>c.id===id),p=localPointer(e),normal=Space.normalFor(state.dragPlane,state.camera);
     const clickedFace=Space.face(c,e.target.closest('[data-face]')?.dataset.face||'front');
     const grab=Space.intersect(p.x,p.y,state.camera,board.clientWidth,board.clientHeight,clickedFace.center,clickedFace.normal)||Space.intersect(p.x,p.y,state.camera,board.clientWidth,board.clientHeight,c,normal);
     if(!grab){toast('Gira un poco la vista para mover en este plano.');return;}
     drag={kind:'card',ids:[...selected],planePoint:clone(grab),normal,offsets:state.cards.filter(c=>selected.has(c.id)).map(c=>({...Space.sub(c,grab),id:c.id})),startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:false,pointerId:e.pointerId};
   }else if(e.button===0){
     if(e.shiftKey&&!n){const p=localPointer(e);drag={kind:'box',startX:p.x,startY:p.y,pointerId:e.pointerId};$('selection-box').hidden=false;}
     else drag={kind:tool==='orbit'||e.altKey?'orbit':'pan',clickedId:n?.dataset.id,add:e.ctrlKey||e.metaKey||e.shiftKey,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,pointerId:e.pointerId};
   }else return;
   board.setPointerCapture(e.pointerId);board.classList.add('dragging');e.preventDefault();requestRender();
 });
 board.addEventListener('pointermove',e=>{
   if(!drag||drag.pointerId!==e.pointerId)return;
   const p=localPointer(e);
   if(drag.kind==='box'){Object.assign($('selection-box').style,{left:Math.min(p.x,drag.startX)+'px',top:Math.min(p.y,drag.startY)+'px',width:Math.abs(p.x-drag.startX)+'px',height:Math.abs(p.y-drag.startY)+'px'});drag.endX=p.x;drag.endY=p.y;return;}
   if(drag.kind==='resize'){drag.lastX=p.x;drag.lastY=p.y;updateResize(p.x,p.y);}
   else if(drag.kind==='card'){drag.lastX=p.x;drag.lastY=p.y;updateCardDrag(p.x,p.y);}
   else{
     if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<4)return;
     const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;drag.lastX=e.clientX;drag.lastY=e.clientY;
     if(!dx&&!dy)return;drag.moved=true;
     if(drag.kind==='pan'){state.camera.panX+=dx;state.camera.panY+=dy;}
     else{state.camera.flat=false;state.camera.yaw=clamp(state.camera.yaw+dx*.18,-180,180);state.camera.pitch=clamp(state.camera.pitch-dy*.14,-82,82);}
   }
   requestRender();
 });
 function endDrag(e){
   if(!drag||drag.pointerId!==e.pointerId)return;
   if(drag.kind==='box'){const x=drag.endX??drag.startX,y=drag.endY??drag.startY,loX=Math.min(x,drag.startX),hiX=Math.max(x,drag.startX),loY=Math.min(y,drag.startY),hiY=Math.max(y,drag.startY);for(const[id,p]of projected)if(p.x>=loX&&p.x<=hiX&&p.y>=loY&&p.y<=hiY)selected.add(id);focusedId=[...selected].at(-1)||null;$('selection-box').hidden=true;}
   if(e.type==='pointercancel'&&drag.kind==='resize')Object.assign(state.cards.find(c=>c.id===drag.id),drag.origin);
   if(e.type==='pointerup'&&!drag.moved&&drag.clickedId)select(drag.clickedId,drag.add);
   else if(e.type==='pointerup'&&!drag.moved&&['pan','orbit'].includes(drag.kind)&&!drag.clickedId)clearSelection();
   drag=null;board.classList.remove('dragging','resizing');save();renderAll();
   if(board.hasPointerCapture(e.pointerId))board.releasePointerCapture(e.pointerId);
 }
 board.addEventListener('pointerup',endDrag);board.addEventListener('pointercancel',endDrag);board.addEventListener('lostpointercapture',endDrag);
 let wheelTimer;
 document.addEventListener('wheel',e=>{if((e.target.closest('.resize-controls')&&!['card','resize'].includes(drag?.kind))||board.hidden||(!board.contains(e.target)&&!['card','resize'].includes(drag?.kind)))return;e.preventDefault();const p=localPointer(e);if(['card','resize'].includes(drag?.kind)){drag.lastX=p.x;drag.lastY=p.y;}const delta=e.deltaMode===1?e.deltaY*16:e.deltaMode===2?e.deltaY*board.clientHeight:e.deltaY;zoom(Math.exp(-delta*.0013),p.x,p.y);clearTimeout(wheelTimer);wheelTimer=setTimeout(save,250);},{passive:false});
 board.addEventListener('keydown',e=>{
   if(e.target.closest('input,textarea,select'))return;
   const handle=e.target.closest('[data-resize]');
   if(handle&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
     e.preventDefault();snapshot();const c=state.cards.find(c=>c.id===handle.dataset.id),h=resizeHandleDefinitions(c).find(h=>h.token===handle.dataset.token),direction=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;
     Object.assign(c,h.mode==='uniform'?Space.resizeUniform(c,h.sx,h.sy,h.sz,1+direction*.05):Space.resizeAxis(c,h.mode,h.sign,c[h.mode]+direction*(e.shiftKey?10:2)));save();syncGeometry(c);requestRender();return;
   }
   const n=e.target.closest('.opportunity');
   if(n&&['Enter',' '].includes(e.key)){e.preventDefault();select(n.dataset.id,e.ctrlKey||e.metaKey||e.shiftKey);return;}
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&selected.size){e.preventDefault();snapshot();const step=e.shiftKey?40:10,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;for(const c of state.cards)if(selected.has(c.id)){const d=screenDelta(c,dx,dy);c.x+=d.x;c.y+=d.y;c.z=clamp(c.z+d.z,-2000,2000);}save();requestRender();}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('editor').open||$('help').open||paletteEditor.dialog.open)return;if(drag?.kind==='resize'){const d=drag;Object.assign(state.cards.find(c=>c.id===d.id),d.origin);drag=null;board.classList.remove('resizing');if(board.hasPointerCapture(d.pointerId))board.releasePointerCapture(d.pointerId);save();renderAll();return;}$('file-menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');clearSelection();}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!paletteEditor.dialog.open&&!e.target.closest('input,textarea,select')){e.preventDefault();undo();}});
 $('priority-filters').innerHTML=[5,4,3,2,1].map(p=>'<button data-priority-filter="'+p+'" aria-pressed="false">'+rankDots(p)+'<span>'+priorities[p]+'</span></button>').join('');
 $('priority-filters').onclick=e=>{const b=e.target.closest('[data-priority-filter]');if(!b)return;const p=Number(b.dataset.priorityFilter);state.priorityFilter=state.priorityFilter===p?0:p;clearSelection();renderAll();fit();};
 $('collections').onclick=e=>{const b=e.target.closest('[data-filter]');if(!b)return;state.filter=b.dataset.filter;state.priorityFilter=0;clearSelection();renderAll();fit();};
 $('clear-filter').onclick=()=>{state.filter='all';state.priorityFilter=0;renderAll();fit();};
 $('list-panel').onclick=e=>{const b=e.target.closest('[data-list-id]');if(b)select(b.dataset.listId,e.ctrlKey||e.metaKey||e.shiftKey);};
 $('inspector').onclick=e=>{
   const priority=e.target.closest('[data-set-priority]');
   if(priority){snapshot();const p=Number(priority.dataset.setPriority);for(const c of state.cards)if(selected.has(c.id)){c.priority=p;}save();renderAll();return;}
   const a=e.target.closest('[data-action]');if(!a)return;
   if(a.dataset.action==='close'){detailsOpen=false;renderInspector();requestRender();}
   if(a.dataset.action==='edit')openEditor(focusedId);
   if(a.dataset.action==='delete')deleteFocusedCard();
 };
 function deleteFocusedCard(){
   const c=state.cards.find(c=>c.id===focusedId);if(!c)return;
   snapshot();state.cards=state.cards.filter(v=>v.id!==c.id);if(!state.deleted.includes(c.id))state.deleted.push(c.id);
   state.links=state.links.filter(l=>l.from!==c.id&&l.to!==c.id);selected.delete(c.id);focusedId=[...selected].at(-1)||null;save();renderAll();toast('Cuadro eliminado. Puedes deshacer el cambio.');
 }
 function setTool(t){tool=t;board.classList.toggle('orbit-mode',t==='orbit');$('pan-tool').classList.toggle('active',t==='pan');$('orbit-tool').classList.toggle('active',t==='orbit');$('pan-tool').setAttribute('aria-pressed',String(t==='pan'));$('orbit-tool').setAttribute('aria-pressed',String(t==='orbit'));$('board-hint').textContent=t==='orbit'?'Izquierdo: girar · Derecho: mover tarjeta · Rueda: zoom al puntero':'Izquierdo: mover vista · Derecho sostenido: mover tarjeta · Rueda: zoom al puntero';}
 $('pan-tool').onclick=()=>setTool('pan');$('orbit-tool').onclick=()=>setTool('orbit');
 $('zoom-in').onclick=()=>{zoom(1.18);save();};$('zoom-out').onclick=()=>{zoom(1/1.18);save();};$('fit').onclick=()=>fit();
 $('flat').onclick=()=>{state.camera.flat=!state.camera.flat;save();renderAll();};
 $('show-links').onclick=()=>{state.showLinks=!state.showLinks;save();renderAll();};
 $('spatial-view').onclick=()=>{state.view='spatial';renderAll();save();};$('list-view').onclick=()=>{state.view='list';renderAll();save();};
 $('organize').onclick=()=>{
   snapshot();const groups={5:[],4:[],3:[],2:[],1:[]};visibleCards().forEach(c=>groups[c.priority].push(c));let y=-250;
   for(const p of[5,4,3,2,1]){const cards=groups[p];if(!cards.length)continue;const cols=Math.min(4,cards.length);cards.forEach((c,i)=>{c.x=(i%cols-(cols-1)/2)*325;c.y=y+Math.floor(i/cols)*290;c.z=depthFor(p);});y+=Math.ceil(cards.length/cols)*290+65;}
   fit(visibleCards(),false);save();renderAll();toast('Tarjetas organizadas. Puedes seguir moviéndolas libremente.');
 };
 function undo(){const s=history.pop();if(!s)return;state.cards=s.cards;state.deleted=s.deleted;state.camera=s.camera;state.theme=normalizeTheme(s.theme);state.palette=s.palette||[...DEFAULT_PALETTE];state.links=Links.normalizeAll(s.links,state.cards);selected=new Set([...selected].filter(id=>state.cards.some(c=>c.id===id)));focusedId=selected.has(focusedId)?focusedId:[...selected].at(-1)||null;save();renderAll();$('undo').disabled=!history.length;toast('Cambio deshecho.');}
 $('undo').onclick=undo;
 function openEditor(id=null){
   editingId=id;const c=state.cards.find(c=>c.id===id),form=$('edit-form');form.reset();$('editor-error').hidden=true;$('editor-title').textContent=c?'Editar oportunidad':'Nueva oportunidad';
   for(const name of['title','category','priority','benefit','description','deadline','status','url','next','notes'])if(c)form.elements.namedItem(name).value=c[name]??'';
   form.elements.namedItem('verified').checked=c?.verified===true;$('editor').showModal();setTimeout(()=>form.elements.namedItem('title').focus(),30);
 }
 $('add').onclick=()=>openEditor();$('add-card').onclick=()=>openEditor();$('editor-close').onclick=()=>$('editor').close();$('editor-cancel').onclick=()=>$('editor').close();
 $('edit-form').onsubmit=e=>{
   e.preventDefault();const fd=new FormData(e.target),old=state.cards.find(c=>c.id===editingId),raw=Object.fromEntries(fd);raw.verified=fd.has('verified');
   if(raw.url&&!safeUrl(raw.url)){$('editor-error').textContent='Usa un enlace que comience con https:// o http://.';$('editor-error').hidden=false;return;}
   if(!old&&state.cards.length>=500){$('editor-error').textContent='El mapa admite hasta 500 oportunidades. Exporta una copia antes de reorganizarlo.';$('editor-error').hidden=false;return;}
   snapshot();
   if(old){const updated=normalize({...old,...raw});Object.assign(old,updated);}
   else{const center=Space.intersect(board.clientWidth/2,board.clientHeight/2,state.camera,board.clientWidth,board.clientHeight,{x:0,y:0,z:0},Space.basis(state.camera).w)||{x:0,y:0,z:0};const c=normalize({...raw,id:'personal-'+(crypto.randomUUID?.()||Date.now().toString(36)),x:center.x+40,y:center.y-30,z:depthFor(Number(raw.priority))});state.cards.push(c);editingId=c.id;state.filter='all';state.priorityFilter=0;}
   $('editor').close();save();renderAll();select(editingId);toast(old?'Oportunidad actualizada.':'Nueva oportunidad añadida a tu mapa.');
 };
 $('menu-button').onclick=e=>{e.stopPropagation();$('file-menu').hidden=!$('file-menu').hidden;$('menu-button').setAttribute('aria-expanded',String(!$('file-menu').hidden));};
 document.addEventListener('click',e=>{if(!e.target.closest('#file-menu,#menu-button')){$('file-menu').hidden=true;$('menu-button').setAttribute('aria-expanded','false');}});
 function download(filename,content){const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
 $('export').onclick=()=>{download('orbita-julian-'+new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mexico_City'})+'.json',JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2));$('file-menu').hidden=true;toast('Copia exportada con posiciones, tamaños, notas y prioridades.');};
 $('import').onclick=()=>$('import-file').click();
 $('import-file').onchange=async e=>{
   const file=e.target.files[0];if(!file)return;
   try{if(file.size>3*1024*1024)throw new Error('El archivo es demasiado grande (máximo 3 MB).');const raw=JSON.parse(await file.text()),cards=Array.isArray(raw)?raw:raw.cards??raw.opportunities??raw.becas;
     if(!Array.isArray(cards)||cards.length>500)throw new Error('Usa un mapa JSON con hasta 500 oportunidades.');
     const normalized=cards.map(normalize);if(raw.sceneVersion===2&&raw.objectVersion!==1)normalized.forEach(compactLegacy);const unique=new Set(normalized.map(c=>c.id));if(unique.size!==normalized.length)throw new Error('Hay identificadores repetidos en el archivo.');
     const byId=new Map(state.cards.map(c=>[c.id,c]));normalized.forEach(c=>byId.set(c.id,c));if(byId.size>500)throw new Error('La combinación supera las 500 oportunidades.');
     snapshot();state.cards=[...byId.values()];if(raw.theme)state.theme=normalizeTheme(raw.theme);if(Array.isArray(raw.palette)&&raw.palette.length===5&&raw.palette.every(c=>Color.hex(c)))state.palette=raw.palette.map(Color.hex);state.deleted=state.deleted.filter(id=>!unique.has(id));state.filter='all';state.priorityFilter=0;
     if(Array.isArray(raw.links))state.links=Links.normalizeAll([...raw.links,...state.links],state.cards);
     clearSelection();renderAll();fit(visibleCards(),false);save();toast(normalized.length+' oportunidades importadas. Se conservaron las demás.');
   }catch(error){toast('No se importó: '+error.message);}finally{e.target.value='';$('file-menu').hidden=true;}
 };
 const openHelp=()=>{$('file-menu').hidden=true;$('help').showModal();};$('help-open').onclick=openHelp;$('help-close').onclick=()=>$('help').close();$('help-done').onclick=()=>$('help').close();
 document.querySelector('.brand').onclick=e=>{e.preventDefault();state.filter='all';state.priorityFilter=0;clearSelection();renderAll();homeView();};
 new ResizeObserver(()=>requestRender()).observe(board);
 renderAll();
 if(!saved){homeView(false);save();}else if(migrated)save();
 requestRender();
 if(!storageAvailable)toast('El guardado local no está disponible. Puedes exportar el mapa para conservarlo.');
})();
