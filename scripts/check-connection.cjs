const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {database,worker,migrate}=require('./local-worker.cjs'),Core=require('../public/direct-actions.js');
(async()=>{
 const db=database(':memory:');migrate(db);const app=await worker(),origin='https://orbita.example';
 const view={camera:{zoom:.73,panX:19,panY:-28,yaw:-25,pitch:-35,flat:false},width:900,height:500,visible:true,busy:false};
 let state={cards:[{id:'real_local_card',title:'Beca Santander',x:432,y:467,z:19,width:480,height:260,thickness:120,notes:'Última edición local'}],links:[],deleted:['old_card']};
 const original=structuredClone(state),camera=structuredClone(view.camera),owner='isolated_chat_owner';
 const key='a'.repeat(64),session='view_current_browser';
 async function call(path,b,{user,browser}={}){const response=await app.fetch(new Request(origin+path,{method:b===undefined?'GET':'POST',headers:{'content-type':'application/json','x-orbita-client':'1',origin,...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-full-name':'Juli%C3%A1n de prueba'}:{}),...(browser?{'x-orbita-browser-key':browser}:{})},body:b===undefined?undefined:JSON.stringify(b)}),{DB:db});return {status:response.status,data:await response.json()};}
 const rpc=async(user=owner)=>{const r=await call('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'orbita_get_active_map',arguments:{}}},{user});return r.data.result;};
 assert.equal((await rpc(null)).isError,true);
 const prepared=(await rpc()).structuredContent;assert.equal(prepared.connected,false);assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM orbita_maps').get().n,0);
 const token=new URL(prepared.connection_url).hash.slice(16);assert.match(token,/^[a-f0-9]{64}$/);assert(!prepared.connection_url.includes('?'));
 const claims={connection_token:token,session_id:session,has_local_data:true,data:state,view};
 const missing=await call('/api/connection/claim',{...claims,has_local_data:false},{browser:key});assert.equal(missing.data.code,'local_map_missing');
 const info=await call('/api/connection/info',{connection_token:token},{browser:key});assert.equal(info.data.target_label,'Julián de prueba');
 // Exercise the shipped browser controller against the actual Worker, with isolated storage.
 const memory=new Map([['orbita-julian-map-v1:browser-cap-v1',key]]),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const nodes=new Map();const node=()=>({textContent:'',disabled:false,dataset:{},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);},after(){}});
 const root=node(),doc={hidden:false,createElement:()=>root,querySelector:()=>node(),addEventListener(){}};
 const win={OrbitaActions:Core,OrbitaConnectionToken:token,addEventListener(){}};let capture;
 const sandbox={window:win,document:doc,crypto,localStorage:storage,sessionStorage:{getItem:()=>session,setItem(){}},AbortController,setTimeout:()=>1,clearTimeout(){},fetch:async(path,options)=>{
   if(path==='/api/connection/claim'){
     capture=JSON.parse(options.body);
     const response=await app.fetch(new Request(origin+path,options),{DB:db});
     state.cards[0].notes='Cambio manual mientras llegaba la respuesta';state.cards[0].x+=11;
     return response;
   }
   if(path==='/api/me'&&capture)state.cards[0].y+=17;
   return app.fetch(new Request(origin+path,options),{DB:db});
 }};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../public/direct-sync.js'),'utf8'),sandbox);
 const direct=new win.OrbitaDirect({hasSavedData:true,getState:()=>state,getView:()=>view,applyData:data=>{state=structuredClone(data);}});
 await direct.start();assert.equal(nodes.get('#direct-target').textContent,'Conectar con: Julián de prueba');assert.equal(direct.connected,false);
 await direct.connectFromChat();assert.equal(direct.connected,true);assert.equal(direct.active,true);assert.match(nodes.get('#direct-status').textContent,/Conectado/);
 assert.equal(state.cards.length,1);assert.equal(state.links.length,0);assert.equal(state.cards[0].x,original.cards[0].x+11);assert.equal(state.cards[0].y,original.cards[0].y+17);assert.equal(state.cards[0].notes,'Cambio manual mientras llegaba la respuesta');assert.equal(state.cards[0].width,480);assert.deepEqual(view.camera,camera);
 const active=(await rpc()).structuredContent;assert.equal(active.connected,true);assert.equal(active.cards[0].x,state.cards[0].x);assert.equal(active.session_id,session);assert.equal(active.connection_url,undefined);
 const recovered=await call('/api/connection/claim',capture,{browser:key});assert.equal(recovered.status,200);assert.equal(recovered.data.map_id,active.map_id);
 const replay=await call('/api/connection/claim',capture,{browser:'b'.repeat(64)});assert.equal(replay.data.code,'connection_expired');
 const stranger=(await rpc('other_chat_owner')).structuredContent,other=new URL(stranger.connection_url).hash.slice(16);
 const conflict=await call('/api/connection/claim',{...claims,connection_token:other},{browser:key});assert.equal(conflict.data.code,'connection_owner_conflict');
 const expired=(await rpc('expiry_owner')).structuredContent;db.sql.exec("UPDATE orbita_connection_requests SET expires_at=0 WHERE owner_id='expiry_owner'");const timeout=await call('/api/connection/claim',{...claims,connection_token:new URL(expired.connection_url).hash.slice(16)},{browser:'c'.repeat(64)});assert.equal(timeout.data.code,'connection_expired');
 const revoked=(await rpc('revoke_owner')).structuredContent;await rpc('revoke_owner');assert.equal((await call('/api/connection/claim',{...claims,connection_token:new URL(revoked.connection_url).hash.slice(16)},{browser:'d'.repeat(64)})).data.code,'connection_expired');
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM orbita_maps').get().n,1);
 // Fragment is erased before the app and assets run; never persisted in browser storage.
 let replaced;const page=fs.readFileSync(require('node:path').join(__dirname,'../public/index.html'),'utf8'),head=page.match(/<script>(.*?)<\/script>/s)[1],tokenWindow={};
 vm.runInNewContext(head,{location:{hash:'#orbita-connect='+token,pathname:'/',search:''},history:{replaceState:(a,b,url)=>{replaced=url;}},window:tokenWindow});assert.equal(replaced,'/');assert.equal(tokenWindow.OrbitaConnectionToken,token);assert(![...memory.values()].some(x=>x.includes(token)));
 console.log('PASS: MCP identity → one-use URL → browser Conectar → preserved latest map/camera → real active acknowledgement; lost-response recovery, other-browser replay, owner conflict, missing local map, expiry and revocation. Isolated in-memory data only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
