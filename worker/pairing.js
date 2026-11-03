const Pairing=(()=>{
 const Core=globalThis.OrbitaActions;
 const sql=(db,text,...values)=>db.prepare(text).bind(...values),get=(db,text,...values)=>sql(db,text,...values).first();
 const random=bytes=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 async function browserHash(request){const key=request.headers.get('x-orbita-browser-key');return /^[a-f0-9]{64}$/i.test(key||'')?hash(key.toLowerCase()):null;}
 async function context(request,db){const browser_hash=await browserHash(request);if(browser_hash){const row=await get(db,'SELECT owner_id,map_id FROM orbita_browser_links WHERE browser_hash=? AND owner_id IS NOT NULL',browser_hash);if(row)return {owner:row.owner_id,bound_map:row.map_id,browser_hash};}const owner=request.headers.get('oai-authenticated-user-id');return owner?{owner,bound_map:null,browser_hash}:null;}
 async function attach(request,db,owner,map,session,view){const bh=await browserHash(request);if(!bh)return;const existing=await get(db,'SELECT owner_id,map_id FROM orbita_browser_links WHERE browser_hash=?',bh);if(existing?.owner_id)return;await sql(db,'INSERT INTO orbita_browser_links(browser_hash,code_hash,session_id,document,view,expires_at,owner_id,map_id) VALUES(?,NULL,?,?,?,?,?,?) ON CONFLICT(browser_hash) DO UPDATE SET code_hash=NULL,owner_id=excluded.owner_id,map_id=excluded.map_id',bh,session,'{}',JSON.stringify(view),0,owner,map).run();}
 async function route(request,db,path,b){
   const bh=await browserHash(request);if(!bh)throw new Problem('No se pudo identificar este navegador. Vuelve a pulsar Vincular mapa.',403,'pairing_required');
   const old=await get(db,'SELECT * FROM orbita_browser_links WHERE browser_hash=?',bh);
   if(path==='/api/pair/start'){
     if(old?.owner_id)return {state:'linked',map_id:old.map_id,owner_id:old.owner_id};
     if(!/^[a-zA-Z0-9_-]{4,160}$/.test(b.session_id||''))throw new Problem('Sesión no válida.');
     const document=Core.data(b.data),view=Core.view(b.view);if(JSON.stringify(document).length>700000)throw new Problem('El mapa es demasiado grande para vincularlo.',413);
     await sql(db,'DELETE FROM orbita_browser_links WHERE owner_id IS NULL AND expires_at<?',Date.now()).run();
     const count=await get(db,'SELECT COUNT(*) AS n FROM orbita_browser_links WHERE owner_id IS NULL');if(count.n>=200&&!old)throw new Problem('Hay demasiadas vinculaciones pendientes. Intenta más tarde.',429);
     const raw=random(10).toUpperCase(),code='ORBITA-'+raw.match(/.{4}/g).join('-'),expires=Date.now()+300000;
     await sql(db,'INSERT INTO orbita_browser_links(browser_hash,code_hash,session_id,document,view,expires_at,owner_id,map_id) VALUES(?,?,?,?,?,?,NULL,NULL) ON CONFLICT(browser_hash) DO UPDATE SET code_hash=excluded.code_hash,session_id=excluded.session_id,document=excluded.document,view=excluded.view,expires_at=excluded.expires_at WHERE orbita_browser_links.owner_id IS NULL',bh,await hash(code.replaceAll('-','')),b.session_id,JSON.stringify(document),JSON.stringify(view),expires).run();
     return {state:'waiting',pairing_code:code,expires_at:expires};
   }
   if(!old)throw new Problem('No hay una vinculación pendiente.',404,'pairing_required');
   if(old.owner_id){const map=await get(db,'SELECT document,revision FROM orbita_maps WHERE owner_id=? AND map_id=?',old.owner_id,old.map_id);return {state:'linked',owner_id:old.owner_id,map_id:old.map_id,data:JSON.parse(map.document),revision:map.revision};}
   if(old.expires_at<Date.now())return {state:'expired'};
   const document=Core.data(b.data);if(JSON.stringify(document).length>700000)throw new Problem('El mapa es demasiado grande.',413);
   await sql(db,'UPDATE orbita_browser_links SET document=?,view=? WHERE browser_hash=? AND owner_id IS NULL AND expires_at>?',JSON.stringify(document),JSON.stringify(Core.view(b.view)),bh,Date.now()).run();return {state:'waiting',expires_at:old.expires_at};
 }
 async function claim(db,owner,code){
   const normalized=String(code||'').replace(/[\s-]/g,'').toUpperCase();if(!/^ORBITA[A-F0-9]{20}$/.test(normalized))throw new Problem('El código de vinculación no es válido.');
   const digest=await hash(normalized),row=await get(db,'SELECT * FROM orbita_browser_links WHERE code_hash=? AND owner_id IS NULL AND expires_at>?',digest,Date.now());if(!row)throw new Problem('El código caducó o ya se utilizó. Genera otro en el mapa.',409,'pairing_expired');
   const count=await get(db,'SELECT COUNT(*) AS n FROM orbita_maps WHERE owner_id=?',owner);if(count.n>=20)throw new Problem('Esta cuenta ya tiene 20 mapas compartidos.',409);
   const map='map-'+crypto.randomUUID(),now=Date.now(),document=Core.data(JSON.parse(row.document));
   const results=await db.batch([
     sql(db,'UPDATE orbita_browser_links SET owner_id=?,map_id=?,code_hash=NULL WHERE browser_hash=? AND code_hash=? AND owner_id IS NULL AND expires_at>?',owner,map,row.browser_hash,digest,now),
     sql(db,'INSERT INTO orbita_maps(owner_id,map_id,label,document,revision,history,last_op,updated_at) SELECT ?,?,?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM orbita_browser_links WHERE browser_hash=? AND owner_id=? AND map_id=?)',owner,map,'Mi mapa de Órbita',JSON.stringify(document),'[]','pair-'+row.session_id,now,row.browser_hash,owner,map),
     sql(db,'INSERT INTO orbita_sessions(owner_id,session_id,map_id,view,last_seen,applied_revision) SELECT ?,?,?,?,?,0 WHERE EXISTS(SELECT 1 FROM orbita_browser_links WHERE browser_hash=? AND owner_id=? AND map_id=?) ON CONFLICT(owner_id,session_id) DO UPDATE SET map_id=excluded.map_id,view=excluded.view,last_seen=excluded.last_seen,applied_revision=0',owner,row.session_id,map,row.view,now,row.browser_hash,owner,map),
     sql(db,'INSERT INTO orbita_active(owner_id,map_id,session_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM orbita_browser_links WHERE browser_hash=? AND owner_id=? AND map_id=?) ON CONFLICT(owner_id) DO UPDATE SET map_id=excluded.map_id,session_id=excluded.session_id',owner,map,row.session_id,row.browser_hash,owner,map)
   ]);if(!results[0].meta.changes)throw new Problem('El código ya fue utilizado.',409,'pairing_expired');
   return {paired:true,map_id:map,session_id:row.session_id,connected:false,message:'Mapa vinculado. Esperando confirmación de esta vista.'};
 }
 // Only authenticated MCP may issue these capabilities. They grant no map access.
 async function prepare(db,owner,origin,request){
   const token=random(32),expires=Date.now()+300000;
   let name=request.headers.get('oai-authenticated-user-full-name')||'';try{name=decodeURIComponent(name);}catch{}
   const email=request.headers.get('oai-authenticated-user-email')||'',label=(name&&email?name+' · '+email:name||email||'Cuenta del chat · '+owner).slice(0,300);
   await db.batch([
     sql(db,'DELETE FROM orbita_connection_requests WHERE expires_at<? OR (owner_id=? AND used_at IS NULL)',Date.now(),owner),
     sql(db,'INSERT INTO orbita_connection_requests(token_hash,owner_id,target_label,expires_at) VALUES(?,?,?,?)',await hash(token),owner,label,expires)
   ]);
   return {connection_url:origin+'/#orbita-connect='+token,connection_expires_at:expires,connection_instruction:'Abre connection_url internamente en el mismo sitio y pide pulsar Conectar. No muestres ni copies el permiso. Conserva el mapa local. Consulta esta herramienta después del clic para confirmar connected=true.'};
 }
 async function info(request,db,b){
   if(!/^[a-f0-9]{64}$/.test(b.connection_token||''))throw new Problem('Prepara un nuevo enlace desde el chat.',409,'connection_expired');
   const ticket=await get(db,'SELECT * FROM orbita_connection_requests WHERE token_hash=? AND used_at IS NULL AND expires_at>?',await hash(b.connection_token),Date.now());
   if(!ticket)throw new Problem('El enlace caducó o ya se utilizó. Prepara uno nuevo desde el chat.',409,'connection_expired');
   return {target_label:ticket.target_label,expires_at:ticket.expires_at};
 }
 async function connect(request,db,b){
   const bh=await browserHash(request);if(!bh)throw new Problem('No se pudo identificar este navegador.',403,'pairing_required');
   if(!/^[a-f0-9]{64}$/.test(b.connection_token||''))throw new Problem('Prepara un nuevo enlace desde el chat.',409,'connection_expired');
   const digest=await hash(b.connection_token),now=Date.now(),ticket=await get(db,'SELECT * FROM orbita_connection_requests WHERE token_hash=? AND expires_at>?',digest,now);
   if(!ticket)throw new Problem('El enlace caducó o ya se utilizó. Prepara uno nuevo desde el chat.',409,'connection_expired');
   if(ticket.used_at){
     if(ticket.browser_hash!==bh||ticket.session_id!==b.session_id)throw new Problem('El enlace ya se utilizó. Prepara uno nuevo desde el chat.',409,'connection_expired');
     const row=await get(db,'SELECT document,revision FROM orbita_maps WHERE owner_id=? AND map_id=?',ticket.owner_id,ticket.map_id);
     return {state:'linked',owner_id:ticket.owner_id,map_id:ticket.map_id,data:JSON.parse(row.document),revision:row.revision};
   }
   if(b.has_local_data!==true)throw new Problem('No encontré tu mapa guardado en este navegador. Abre el enlace en la vista donde está tu mapa.',409,'local_map_missing');
   if(!/^[a-zA-Z0-9_-]{4,160}$/.test(b.session_id||''))throw new Problem('Sesión no válida.');
   const old=await get(db,'SELECT * FROM orbita_browser_links WHERE browser_hash=?',bh),owner=ticket.owner_id;
   if(old?.owner_id&&old.owner_id!==owner)throw new Problem('Este navegador ya está vinculado a otra cuenta. Conservé tu mapa.',409,'connection_owner_conflict');
   const document=Core.data(b.data),view=Core.view(b.view);if(JSON.stringify(document).length>700000)throw new Problem('El mapa es demasiado grande. Tu copia local se conserva.',413);
   const previous=old?.owner_id?await get(db,'SELECT document FROM orbita_maps WHERE owner_id=? AND map_id=?',owner,old.map_id):null;
   // An older linked map must never replace the current local map, or be overwritten by it.
   // Reuse only an identical snapshot; otherwise preserve the older map and bind a new snapshot.
   const reuse=previous&&JSON.stringify(Core.data(JSON.parse(previous.document)))===JSON.stringify(document),map=reuse?old.map_id:'map-'+crypto.randomUUID();
   if(!reuse){const count=await get(db,'SELECT COUNT(*) AS n FROM orbita_maps WHERE owner_id=?',owner);if(count.n>=20)throw new Problem('Esta cuenta ya tiene 20 mapas compartidos.',409);}
   // D1 batch is atomic. Every write is gated by the consumed request and browser binding.
   const guard='EXISTS(SELECT 1 FROM orbita_connection_requests WHERE token_hash=? AND browser_hash=? AND map_id=? AND session_id=?)';
   const bound='EXISTS(SELECT 1 FROM orbita_browser_links WHERE browser_hash=? AND owner_id=? AND map_id=?)';
   const results=await db.batch([
     sql(db,'UPDATE orbita_connection_requests SET used_at=?,browser_hash=?,map_id=?,session_id=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND NOT EXISTS(SELECT 1 FROM orbita_browser_links WHERE browser_hash=? AND owner_id IS NOT NULL AND (owner_id<>? OR map_id<>?))',now,bh,map,b.session_id,digest,now,bh,owner,old?.map_id||''),
     sql(db,'INSERT INTO orbita_browser_links(browser_hash,code_hash,session_id,document,view,expires_at,owner_id,map_id) SELECT ?,NULL,?,?,?,?,?,? WHERE '+guard+' ON CONFLICT(browser_hash) DO UPDATE SET code_hash=NULL,owner_id=excluded.owner_id,map_id=excluded.map_id WHERE orbita_browser_links.owner_id IS NULL OR (orbita_browser_links.owner_id=excluded.owner_id AND orbita_browser_links.map_id=?)',bh,b.session_id,JSON.stringify(document),JSON.stringify(view),0,owner,map,digest,bh,map,b.session_id,old?.map_id||''),
     sql(db,'INSERT OR IGNORE INTO orbita_maps(owner_id,map_id,label,document,revision,history,last_op,updated_at) SELECT ?,?,?,?,1,?,?,? WHERE '+guard+' AND '+bound,owner,map,'Mi mapa de Órbita',JSON.stringify(document),'[]','connect-'+b.session_id,now,digest,bh,map,b.session_id,bh,owner,map),
     sql(db,'INSERT INTO orbita_sessions(owner_id,session_id,map_id,view,last_seen,applied_revision) SELECT ?,?,?,?,?,0 WHERE '+guard+' AND '+bound+' ON CONFLICT(owner_id,session_id) DO UPDATE SET map_id=excluded.map_id,view=excluded.view,last_seen=excluded.last_seen,applied_revision=0',owner,b.session_id,map,JSON.stringify(view),now,digest,bh,map,b.session_id,bh,owner,map),
     sql(db,'INSERT INTO orbita_active(owner_id,map_id,session_id) SELECT ?,?,? WHERE '+guard+' AND '+bound+' ON CONFLICT(owner_id) DO UPDATE SET map_id=excluded.map_id,session_id=excluded.session_id',owner,map,b.session_id,digest,bh,map,b.session_id,bh,owner,map)
   ]);
   if(!results[0].meta.changes)throw new Problem('El enlace caducó o ya se utilizó. Prepara uno nuevo desde el chat.',409,'connection_expired');
   const row=await get(db,'SELECT document,revision FROM orbita_maps WHERE owner_id=? AND map_id=?',owner,map);
   return {state:'linked',owner_id:owner,map_id:map,data:JSON.parse(row.document),revision:row.revision};
 }
 return {context,attach,route,claim,prepare,connect,info};
})();
