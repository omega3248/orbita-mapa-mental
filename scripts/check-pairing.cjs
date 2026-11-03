const assert=require('node:assert/strict'),fs=require('node:fs');const {database,worker,migrate}=require('./local-worker.cjs');
(async()=>{
 const db=database(':memory:');migrate(db);const app=await worker(),origin='http://127.0.0.1:4175',view={camera:{zoom:.7,panX:12,panY:18,yaw:-25,pitch:-35,flat:false},width:900,height:500,visible:true,busy:false};
 const data={cards:[{id:'existing_beca',title:'Beca Santander',description:'',x:421,y:467,z:19,width:480,height:260,thickness:120,notes:'Último ajuste manual'}],links:[],deleted:['old_card']};
 const keyA=crypto.randomBytes?crypto.randomBytes(32).toString('hex'):Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
 const keyB='b'.repeat(64),keyC='c'.repeat(64);
 async function call(path,body,{key,user}={}){const r=await app.fetch(new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json','x-orbita-client':'1',origin,...(key?{'x-orbita-browser-key':key}:{}),...(user?{'oai-authenticated-user-id':user}:{})},body:body===undefined?undefined:JSON.stringify(body)}),{DB:db});return {status:r.status,location:r.headers.get('location'),data:await r.json()};}
 const rpc=(name,args,user)=>call('/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},{user});
 const anon=await call('/api/me');assert.equal(anon.status,200);assert.equal(anon.location,null);assert.equal(anon.data.authenticated,false);
 const start=await call('/api/pair/start',{session_id:'view_browser_a',data,view},{key:keyA});assert.equal(start.status,200);assert.equal(start.location,null);assert(start.data.pairing_code.startsWith('ORBITA-'));
 const withoutChatAuth=await rpc('orbita_pair_map',{pairing_code:start.data.pairing_code});assert.equal(withoutChatAuth.data.result.isError,true);
 const newer={...data,cards:data.cards.map(c=>({...c,x:432,notes:'Cambios hechos mientras se vinculaba'}))};await call('/api/pair/status',{data:newer,view},{key:keyA});
 const claim=await rpc('orbita_pair_map',{pairing_code:start.data.pairing_code},'chat_owner_a');assert.equal(claim.data.result.structuredContent.paired,true);
 const linked=await call('/api/pair/status',{data:newer,view},{key:keyA});assert.equal(linked.data.data.cards[0].x,432);assert.equal(linked.data.data.cards[0].notes,newer.cards[0].notes);assert.equal(linked.data.data.cards.length,1);
 const me=await call('/api/me',undefined,{key:keyA});assert.equal(me.data.authenticated,true);assert.equal(me.data.user_id,'chat_owner_a');
 const connected=await call('/api/connect',{session_id:'view_browser_a',has_local_data:true,data:newer,view},{key:keyA});assert.equal(connected.status,200);assert.equal(connected.data.map_id,linked.data.map_id);
 const map=linked.data.map_id;const noKey=await call('/api/poll',{map_id:map,session_id:'view_browser_a',revision:1,applied_revision:1,view});assert.equal(noKey.status,401);
 const wrongKey=await call('/api/poll',{map_id:map,session_id:'view_browser_a',revision:1,applied_revision:1,view},{key:keyB});assert.equal(wrongKey.status,401);
 const replay=await rpc('orbita_pair_map',{pairing_code:start.data.pairing_code},'chat_owner_b');assert.equal(replay.data.result.isError,true);
 const second=await call('/api/pair/start',{session_id:'view_browser_b',data:{cards:[]},view},{key:keyB});await rpc('orbita_pair_map',{pairing_code:second.data.pairing_code},'chat_owner_b');
 const escapedScope=await call('/api/poll',{map_id:map,session_id:'view_browser_a',revision:1,applied_revision:1,view},{key:keyB});assert.equal(escapedScope.status,403);
 const mine=await call('/api/poll',{map_id:map,session_id:'view_browser_a',revision:0,applied_revision:1,view},{key:keyA});assert.equal(mine.status,200);assert.equal(mine.data.data.cards[0].title,'Beca Santander');
 const expiring=await call('/api/pair/start',{session_id:'view_expiring',data,view},{key:keyC});db.sql.exec('UPDATE orbita_browser_links SET expires_at=0 WHERE owner_id IS NULL');const expired=await rpc('orbita_pair_map',{pairing_code:expiring.data.pairing_code},'chat_owner_a');assert.equal(expired.data.result.isError,true);
 const front=fs.readFileSync(require('node:path').join(__dirname,'../public/direct-sync.js'),'utf8');assert(!front.includes('signin-with-chatgpt'));assert(!front.includes('auth.openai.com'));assert(!front.includes('location.href'));
 console.log('PASS: anonymous web needs no login/redirect; authenticated chat claims one-use expiring code; latest local edits preserved; browser capability confined to its map; guessed IDs, wrong keys and replay rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
