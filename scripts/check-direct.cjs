const assert=require('node:assert/strict'),fs=require('node:fs');
const {database,worker,migrate}=require('./local-worker.cjs'),Core=require('../public/direct-actions.js'),Space=require('../public/scene-math.js');
(async()=>{
 const db=database(':memory:');migrate(db);const app=await worker(),url='http://127.0.0.1:4175',owner='test_owner',session='view_test_current';
 const seed={cards:[{id:'beca_actual',title:'Beca Santander',description:'',x:375,y:440,z:23,width:480,height:260,thickness:120,notes:'ajuste manual más reciente'}],links:[],deleted:['old_card'],theme:{},palette:[]};
 const camera={zoom:.7,panX:14,panY:-20,yaw:-25,pitch:-35,flat:false},view={camera,width:900,height:500,busy:false,visible:true};
 async function call(path,value,user=owner){const request=new Request(url+path,{method:value===undefined?'GET':'POST',headers:{...(user?{'oai-authenticated-user-id':user}:{}),'content-type':'application/json','x-orbita-client':'1',origin:url},body:value===undefined?undefined:JSON.stringify(value)});const response=await app.fetch(request,{DB:db});return {status:response.status,data:await response.json()};}
 const joined=await call('/api/connect',{session_id:session,has_local_data:true,data:seed,view});assert.equal(joined.status,200);assert.equal(joined.data.data.cards[0].x,375);assert.equal(joined.data.data.cards[0].notes,seed.cards[0].notes);
 const map=joined.data.map_id;let rev=joined.data.revision;
 const poll=async revision=>call('/api/poll',{map_id:map,session_id:session,revision,applied_revision:revision,view});await poll(rev);
 const command={map_id:map,session_id:session,request_id:'move_one_time',actions:[{type:'move',target:'Santander',screen_dx:0,screen_dy:-100}]};
 const pending=call('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'orbita_apply_actions',arguments:command}});
 await new Promise(resolve=>setTimeout(resolve,40));const pulled=await poll(rev);assert(pulled.data.data);const before=seed.cards[0],after=pulled.data.data.cards[0];const a=Space.project(before,camera,900,500),b=Space.project(after,camera,900,500);assert(Math.abs(b.x-a.x)<1e-7);assert(Math.abs(b.y-a.y+100)<1e-7);assert.equal(after.width,before.width);assert.equal(after.notes,before.notes);rev=pulled.data.revision;await poll(rev);
 const done=await pending;assert.equal(done.data.result.structuredContent.applied,true);
 const again=await call('/mcp',{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'orbita_apply_actions',arguments:command}});assert.equal(again.data.result.structuredContent.revision,rev);
 const anonymous=await call('/api/poll',{map_id:map,session_id:session,revision:rev,applied_revision:rev,view},null);assert.equal(anonymous.status,401);
 const other=await call('/api/poll',{map_id:map,session_id:session,revision:rev,applied_revision:rev,view},'another_owner');assert.equal(other.status,403);
 const patch=Core.diff(pulled.data.data,{...pulled.data.data,cards:pulled.data.data.cards.map(c=>({...c,notes:'nota manual conservada'}))});const saved=await call('/api/save',{map_id:map,session_id:session,base_revision:rev,request_id:'manual_note',patch});assert.equal(saved.data.data.cards[0].notes,'nota manual conservada');
 const undone=await call('/api/undo',{map_id:map,session_id:session,request_id:'undo_note'});assert.equal(undone.data.data.cards[0].notes,before.notes);
 const conflict=await call('/api/save',{map_id:map,session_id:session,base_revision:1,request_id:'stale_write',patch});assert.equal(conflict.data.conflict,true);
 const persisted=await call('/api/connect',{map_id:map,session_id:'view_reconnected',has_local_data:true,data:{cards:[]},view});assert.equal(persisted.data.data.cards.length,1);assert.equal(persisted.data.data.cards[0].title,'Beca Santander');
 const tools=await call('/mcp',{jsonrpc:'2.0',id:9,method:'tools/list'},null);assert.equal(tools.data.result.tools.length,5);
 console.log('PASS: one end-to-end command + view acknowledgement, exact screen-relative movement, idempotency, identity isolation, manual save/undo, conflict protection and persistence.');
})().catch(e=>{console.error(e);process.exitCode=1;});
