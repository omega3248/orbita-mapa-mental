const Core=globalThis.OrbitaActions;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
class Problem extends Error{constructor(message,status=400,code='invalid_request'){super(message);this.status=status;this.code=code;}}
const id=value=>{if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{4,160}$/.test(value))throw new Problem('Identificador no válido.');return value;};
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const one=(db,sql,...args)=>stmt(db,sql,...args).first();
const decode=row=>row?{map_id:row.map_id,label:row.label,revision:row.revision,data:JSON.parse(row.document),can_undo:JSON.parse(row.history).length>0}:null;
const getMap=(db,owner,map)=>one(db,'SELECT * FROM orbita_maps WHERE owner_id=? AND map_id=?',owner,id(map));
function identity(request){const user=request.headers.get('oai-authenticated-user-id');if(!user)throw new Problem('Conecta Órbita con tu cuenta de ChatGPT para usar el chat.',401,'auth_required');return user;}
async function body(request){const size=Number(request.headers.get('content-length')||0);if(size>3*1024*1024)throw new Problem('El mapa supera el límite de 3 MB.',413);const text=await request.text();if(text.length>3*1024*1024)throw new Problem('El mapa supera el límite de 3 MB.',413);try{return JSON.parse(text);}catch{throw new Problem('El JSON no es válido.');}}
async function active(db,owner){const binding=await one(db,'SELECT * FROM orbita_active WHERE owner_id=?',owner);if(!binding)return {connected:false,reason:'Abre Órbita y pulsa Usar este mapa en el chat.'};const session=await one(db,'SELECT * FROM orbita_sessions WHERE owner_id=? AND session_id=? AND map_id=?',owner,binding.session_id,binding.map_id),map=await getMap(db,owner,binding.map_id);if(!session||!map)return {connected:false,reason:'No hay una sesión activa.'};const view=JSON.parse(session.view),age=Date.now()-session.last_seen;return {map_id:map.map_id,map_name:map.label,session_id:session.session_id,revision:map.revision,connected:age<10000&&view.visible!==false&&view.width>=50&&view.height>=50,busy:view.busy===true,last_seen_ms:age,reason:age>=10000?'La vista está desconectada. Abre el mapa.':view.visible===false?'La vista activa está oculta. Muestra el mapa.':view.width<50||view.height<50?'La vista activa no está disponible.':'',cards:JSON.parse(map.document).cards.map(c=>({id:c.id,title:c.title,x:c.x,y:c.y,z:c.z,width:c.width,height:c.height,thickness:c.thickness})),connection_count:JSON.parse(map.document).links.length,can_undo:JSON.parse(map.history).length>0};}
async function requireSession(db,owner,mapId,sessionId){const a=await active(db,owner);if(!a.connected)throw new Problem(a.reason,409,'disconnected');if(a.map_id!==mapId||a.session_id!==sessionId)throw new Problem('La sesión activa cambió. Consulta orbita_get_active_map y usa sus identificadores.',409,'wrong_session');if(a.busy)throw new Problem('Estás editando el mapa. Espera a terminar ese gesto.',409,'busy');return one(db,'SELECT * FROM orbita_sessions WHERE owner_id=? AND session_id=?',owner,sessionId);}
async function operationStatus(db,owner,requestId){const op=await one(db,'SELECT * FROM orbita_operations WHERE owner_id=? AND request_id=?',owner,id(requestId));if(!op)throw new Problem('No encontré esa operación.',404);const s=await one(db,'SELECT applied_revision,last_seen FROM orbita_sessions WHERE owner_id=? AND session_id=?',owner,op.session_id);const applied=!!s&&s.applied_revision>=op.revision;return {request_id:op.request_id,map_id:op.map_id,session_id:op.session_id,revision:op.revision,applied,status:applied?'aplicado':'guardado_pendiente_de_vista',message:applied?op.summary:'El cambio está guardado; la vista todavía no confirmó su recepción.'};}
async function mutate(db,owner,args,{source='chat',allowDelete=false,patch=null,undo=false}={}){
 const mapId=id(args.map_id),sessionId=id(args.session_id),requestId=id(args.request_id);
 const previous=await one(db,'SELECT * FROM orbita_operations WHERE owner_id=? AND request_id=?',owner,requestId);if(previous){if(previous.map_id!==mapId||previous.session_id!==sessionId)throw new Problem('Este request_id pertenece a otra operación.',409);return operationStatus(db,owner,requestId);}
 for(let attempt=0;attempt<3;attempt++){
   const session=source==='chat'?await requireSession(db,owner,mapId,sessionId):await one(db,'SELECT * FROM orbita_sessions WHERE owner_id=? AND session_id=? AND map_id=?',owner,sessionId,mapId);if(!session)throw new Problem('La sesión no pertenece a este mapa.',403);
   const row=await getMap(db,owner,mapId);if(!row)throw new Problem('No encontré tu mapa.',404);if(patch&&args.base_revision!==row.revision)return {conflict:true,...decode(row)};
   const old=JSON.parse(row.document),history=JSON.parse(row.history);let next,summary;
   if(undo){if(!history.length)throw new Problem('No hay cambios que deshacer.',409);next=history.pop();summary='Último cambio deshecho.';}
   else{const result=patch?{data:Core.patch(old,patch),summary:'Edición manual guardada.'}:Core.actions(old,args.actions,JSON.parse(session.view),{allowDelete});next=result.data;summary=result.summary;history.push(old);if(history.length>30)history.shift();}
   if(JSON.stringify(next).length>700000)throw new Problem('El mapa compartido supera el límite de tamaño. Tu copia local se conserva.',413);
   while(history.length&&JSON.stringify(history).length>650000)history.shift();
   const revision=row.revision+1,now=Date.now();
   const result=await db.batch([
     stmt(db,'UPDATE orbita_maps SET document=?,history=?,revision=?,last_op=?,updated_at=? WHERE owner_id=? AND map_id=? AND revision=? AND NOT EXISTS(SELECT 1 FROM orbita_operations WHERE owner_id=? AND request_id=?)',JSON.stringify(next),JSON.stringify(history),revision,requestId,now,owner,mapId,row.revision,owner,requestId),
     stmt(db,'INSERT OR IGNORE INTO orbita_operations(owner_id,request_id,map_id,session_id,revision,summary,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM orbita_maps WHERE owner_id=? AND map_id=? AND revision=? AND last_op=?)',owner,requestId,mapId,sessionId,revision,summary,now,owner,mapId,revision,requestId)
   ]);
   if(result[0].meta.changes){if(source==='web')return {...decode(await getMap(db,owner,mapId)),request_id:requestId};return operationStatus(db,owner,requestId);}
   if(await one(db,'SELECT request_id FROM orbita_operations WHERE owner_id=? AND request_id=?',owner,requestId))return operationStatus(db,owner,requestId);
 }throw new Problem('Hubo cambios simultáneos. Vuelve a intentarlo con el mismo request_id.',409,'conflict');
}
const str={type:'string'},targetSchema={type:'string',description:'Identificador o título único del cuadro. No adivines si hay varios.'};
const actionSchema={type:'object',additionalProperties:false,required:['type'],properties:{type:{type:'string',enum:['create','edit','move','resize','connect','line']},target:targetSchema,from:targetSchema,to:targetSchema,line_id:str,fields:{type:'object',description:'Campos del cuadro o de la conexión. Se aceptan sólo campos conocidos.'},screen_dx:{type:'number',description:'Desplazamiento horizontal en píxeles en la vista activa.'},screen_dy:{type:'number',description:'Desplazamiento vertical en píxeles: negativo sube, positivo baja. Mueve el cuadro, no la cámara.'},x:{type:'number'},y:{type:'number'},z:{type:'number'},dx:{type:'number'},dy:{type:'number'},dz:{type:'number'},width:{type:'number'},height:{type:'number'},thickness:{type:'number'},factor:{type:'number'}}};
const common={map_id:str,session_id:str,request_id:{type:'string',description:'Identificador único de esta intención. Reutilízalo al reintentar para no duplicar el movimiento.'}};
const input=(extra={},required=[])=>({type:'object',additionalProperties:false,properties:{...common,...extra},required:['map_id','session_id','request_id',...required]});
const TOOLS=[
 {name:'orbita_get_active_map',description:'Consulta el mapa y la sesión de Órbita que el usuario ha activado, su conexión y sus cuadros. Úsala antes de editar. No controles el navegador ni pidas capturas para cambios rutinarios.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false}},
 {name:'orbita_apply_actions',description:'Aplica una o varias ediciones como una única acción deshacible al mapa activo. Crear, editar, mover, cambiar tamaño, conectar y modificar conexiones. Para «sube Santander» usa type=move,target=Santander,screen_dx=0,screen_dy=-100. Conserva cámara y demás ajustes. Devuelve applied=true sólo cuando la vista confirma recepción; si queda pendiente consulta el estado con el mismo request_id.',inputSchema:input({actions:{type:'array',minItems:1,maxItems:100,items:actionSchema}},['actions']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'orbita_delete_cards',description:'Elimina del mapa activo los cuadros indicados y sus conexiones. Es una sola acción recuperable con orbita_undo. Úsala sólo si el usuario pide eliminar esos cuadros.',inputSchema:input({targets:{type:'array',minItems:1,maxItems:500,items:targetSchema}},['targets']),annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false}},
 {name:'orbita_undo',description:'Deshace la última acción del mapa activo, también cambios hechos a mano o en lote. No mueve la cámara.',inputSchema:input(),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
 {name:'orbita_command_status',description:'Consulta una operación ya enviada. No la repitas con otro identificador si está pendiente de confirmación.',inputSchema:{type:'object',properties:{request_id:str},required:['request_id'],additionalProperties:false},annotations:{readOnlyHint:true,openWorldHint:false}}
];
async function mcp(request,env){
 const rpc=await body(request);let result;
 try{
   if(rpc.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'orbita-direct',version:'1.0.0'}};
   else if(rpc.method==='initialize')result={protocolVersion:rpc.params?.protocolVersion||'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'orbita-direct',version:'1.0.0'},instructions:'Edita únicamente el mapa y la sesión activos. Usa órdenes relativas a la vista para subir o bajar cuadros. Confirma sólo las operaciones aplicadas; no uses capturas, recargas o automatización del navegador para ajustes rutinarios.'};
   else if(rpc.method==='notifications/initialized'||rpc.method==='ping')result={};
   else if(rpc.method==='tools/list')result={tools:TOOLS};
   else if(rpc.method==='tools/call'){
     const owner=identity(request),args=rpc.params?.arguments||{},name=rpc.params?.name;let value;
     if(name==='orbita_get_active_map')value=await active(env.DB,owner);
     else if(name==='orbita_command_status')value=await operationStatus(env.DB,owner,args.request_id);
     else if(['orbita_apply_actions','orbita_delete_cards','orbita_undo'].includes(name)){
       const started=Date.now();if(name==='orbita_delete_cards'){if(!Array.isArray(args.targets)||!args.targets.length||args.targets.length>500)throw new Problem('Indica los cuadros que quieres eliminar.');args.actions=args.targets.map(target=>({type:'delete',target}));}
       value=await mutate(env.DB,owner,args,{allowDelete:name==='orbita_delete_cards',undo:name==='orbita_undo'});
       while(!value.applied&&Date.now()-started<2600){await new Promise(resolve=>setTimeout(resolve,180));value=await operationStatus(env.DB,owner,args.request_id);}value.elapsed_ms=Date.now()-started;
     }else throw new Problem('Herramienta no disponible.',404);
     result={content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};
   }else return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Método no disponible.'}});
 }catch(error){result={isError:true,content:[{type:'text',text:JSON.stringify({error:error.message,code:error.code||'operation_failed'})}]};}
 if(rpc.id===undefined)return new Response(null,{status:204});return json({jsonrpc:'2.0',id:rpc.id,result});
}
async function api(request,env,path){
 if(path==='/api/me')return json({authenticated:!!request.headers.get('oai-authenticated-user-id'),user_id:request.headers.get('oai-authenticated-user-id')||null});
 const owner=identity(request);if(request.method!=='POST')throw new Problem('Método no permitido.',405);
 if(request.headers.get('x-orbita-client')!=='1')throw new Problem('Solicitud no válida.',403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&origin!=='https://orbita-julian-oportunidades.jorgeortizguerra33.chatgpt.site')throw new Problem('Origen no permitido.',403);
 const b=await body(request),db=env.DB;
 if(path==='/api/connect'){
   const sessionId=id(b.session_id),v=Core.view(b.view);let map=b.map_id?await getMap(db,owner,b.map_id):null;
   const a=await one(db,'SELECT * FROM orbita_active WHERE owner_id=?',owner);if(!map&&!b.has_local_data&&a)map=await getMap(db,owner,a.map_id);
   if(!map){const count=await one(db,'SELECT COUNT(*) AS n FROM orbita_maps WHERE owner_id=?',owner);if(count.n>=20)throw new Problem('Esta cuenta ya tiene 20 mapas compartidos.',409);const mapId='map-'+crypto.randomUUID(),document=Core.data(b.data);if(JSON.stringify(document).length>700000)throw new Problem('El mapa es demasiado grande para sincronizar. Conserva tu copia local.',413);await stmt(db,'INSERT INTO orbita_maps(owner_id,map_id,label,document,revision,history,last_op,updated_at) VALUES(?,?,?,?,1,?,?,?)',owner,mapId,'Mi mapa de Órbita',JSON.stringify(document),'[]','migration-'+sessionId,Date.now()).run();map=await getMap(db,owner,mapId);}
   await stmt(db,'INSERT INTO orbita_sessions(owner_id,session_id,map_id,view,last_seen,applied_revision) VALUES(?,?,?,?,?,0) ON CONFLICT(owner_id,session_id) DO UPDATE SET map_id=excluded.map_id,view=excluded.view,last_seen=excluded.last_seen',owner,sessionId,map.map_id,JSON.stringify(v),Date.now()).run();
   let choose=!a;if(a){const old=await one(db,'SELECT last_seen FROM orbita_sessions WHERE owner_id=? AND session_id=?',owner,a.session_id);choose=!old||Date.now()-old.last_seen>15000||a.session_id===sessionId;}
   if(choose)await stmt(db,'INSERT INTO orbita_active(owner_id,map_id,session_id) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET map_id=excluded.map_id,session_id=excluded.session_id',owner,map.map_id,sessionId).run();
   return json({...decode(map),owner_id:owner,active:choose,session_id:sessionId});
 }
 const mapId=id(b.map_id),sessionId=id(b.session_id),session=await one(db,'SELECT * FROM orbita_sessions WHERE owner_id=? AND session_id=? AND map_id=?',owner,sessionId,mapId);if(!session)throw new Problem('La sesión no pertenece a este mapa.',403);
 if(path==='/api/poll'||path==='/api/activate'){
   await stmt(db,'UPDATE orbita_sessions SET view=?,last_seen=?,applied_revision=? WHERE owner_id=? AND session_id=?',JSON.stringify(Core.view(b.view)),Date.now(),Math.max(0,Number(b.applied_revision)||0),owner,sessionId).run();
   if(path==='/api/activate')await stmt(db,'INSERT INTO orbita_active(owner_id,map_id,session_id) VALUES(?,?,?) ON CONFLICT(owner_id) DO UPDATE SET map_id=excluded.map_id,session_id=excluded.session_id',owner,mapId,sessionId).run();
   const row=await getMap(db,owner,mapId),a=await one(db,'SELECT * FROM orbita_active WHERE owner_id=?',owner),response={map_id:mapId,revision:row.revision,active:a?.session_id===sessionId,can_undo:JSON.parse(row.history).length>0};if(row.revision!==b.revision)response.data=JSON.parse(row.document);return json(response);
 }
 if(path==='/api/save')return json(await mutate(db,owner,b,{source:'web',patch:b.patch}));
 if(path==='/api/undo')return json(await mutate(db,owner,b,{source:'web',undo:true}));
 throw new Problem('Ruta no disponible.',404);
}
export default {async fetch(request,env){
 try{const url=new URL(request.url);if(url.pathname==='/mcp'){if(request.method==='POST')return mcp(request,env);return json({server:'orbita-direct',transport:'stateless-json-rpc',protocol:'2026-07-28'});}
   if(url.pathname==='/api/health')return json({service:'orbita-direct',version:1});if(url.pathname.startsWith('/api/'))return await api(request,env,url.pathname);
   const name=url.pathname==='/'?'/index.html':url.pathname,asset=ASSETS[name];if(!asset)return new Response('No encontrado',{status:404});return new Response(asset.body,{headers:{'content-type':asset.type,'cache-control':name.endsWith('.html')?'no-store':'public, max-age=3600','x-content-type-options':'nosniff','referrer-policy':'same-origin'}});
 }catch(error){return json({error:error.message,code:error.code||'server_error'},error.status||500);}
}};
