(() => {
 'use strict';
 const Core=window.OrbitaActions,KEY='orbita-julian-map-v1',LINK=KEY+':direct-link-v1',SESSION=KEY+':direct-session-v1',CAP=KEY+':browser-cap-v1';
 window.OrbitaDirect=class{
   constructor(api){this.api=api;this.connected=false;this.pending=false;this.base=null;this.revision=0;this.sending=false;this.polling=false;this.running=false;this.active=false;this.retry=800;this.timer=null;this.flushTimer=null;this.owner=null;this.mapId=null;this.link=this.readLink();
     this.sessionId=sessionStorage.getItem(SESSION)||'view-'+crypto.randomUUID();sessionStorage.setItem(SESSION,this.sessionId);
     this.browserKey=localStorage.getItem(CAP);if(!/^[a-f0-9]{64}$/.test(this.browserKey||'')){this.browserKey=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(CAP,this.browserKey);}
     this.pairingNeeded=false;this.pairTimer=null;
     const box=document.createElement('div');box.className='direct-control';box.innerHTML='<span id="direct-status" role="status">Conectando con el chat…</span><button type="button" id="direct-activate">Usar este mapa en el chat</button><div id="direct-pairing" hidden><p>Copia este código en el chat para vincular sólo este mapa. Caduca en 5 minutos.</p><div><input id="direct-pair-code" aria-label="Código para vincular el mapa" readonly spellcheck="false"><button type="button" id="direct-copy-code">Copiar código</button></div></div>';document.querySelector('.map-subbar').after(box);this.ui=box;
     box.querySelector('#direct-activate').onclick=()=>this.connected?this.activate():this.pairingNeeded?this.beginPair():this.start();
     box.querySelector('#direct-copy-code').onclick=async()=>{const input=box.querySelector('#direct-pair-code');try{await navigator.clipboard.writeText(input.value);this.status('Código copiado · pégalo en este chat');}catch{input.focus();input.select();this.status('Selecciona y copia el código en el chat');}};
     window.addEventListener('online',()=>this.start());document.addEventListener('visibilitychange',()=>{if(!document.hidden)this.pollSoon();});
     document.addEventListener('pointerdown',()=>setTimeout(()=>this.pollSoon(),0),true);
   }
   readLink(){try{return JSON.parse(localStorage.getItem(LINK)||'null');}catch{return null;}}
   stateData(){return Core.data(this.api.getState());}
   getView(){return {...this.api.getView(),busy:this.pending||this.sending||this.api.getView().busy,visible:!document.hidden};}
   status(text){this.ui.querySelector('#direct-status').textContent=text;this.ui.dataset.connected=String(this.connected);this.ui.querySelector('#direct-activate').textContent=this.pairingNeeded?'Conectar con mi chat':'Usar este mapa en el chat';}
   persist(){if(!this.base)return;const record={owner_id:this.owner,map_id:this.mapId,revision:this.revision,base:this.base,pending:this.pending?Core.diff(this.base,this.stateData()):null};this.link=record;try{localStorage.setItem(LINK,JSON.stringify(record));}catch{this.status('Guardado local limitado · conserva una copia');}}
   async request(path,value){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);try{const response=await fetch(path,{method:value===undefined?'GET':'POST',headers:{'X-Orbita-Browser-Key':this.browserKey,...(value===undefined?{}:{'Content-Type':'application/json','X-Orbita-Client':'1'})},body:value===undefined?undefined:JSON.stringify(value),signal:controller.signal,credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok){const e=new Error(result.error||'Sin conexión');e.code=result.code;e.status=response.status;throw e;}return result;}finally{clearTimeout(timeout);}}
   packet(extra={}){return {map_id:this.mapId,session_id:this.sessionId,...extra};}
   async start(){
     if(this.running||this.connected)return;this.running=true;clearTimeout(this.timer);this.status('Conectando con el chat…');
     try{
       const me=await this.request('/api/me');if(!me.authenticated){this.pairingNeeded=true;this.connected=false;this.status('Tu mapa sigue guardado aquí · vincúlalo con un código');return;}
       if(this.link?.owner_id&&this.link.owner_id!==me.user_id){this.pairingNeeded=true;this.status('Vincula este mapa con el chat que quieres usar');return;}
       this.pairingNeeded=false;this.owner=me.user_id;
       if(!localStorage.getItem(KEY+':before-direct-v1'))localStorage.setItem(KEY+':before-direct-v1',JSON.stringify(this.api.getState()));
       const before=this.stateData(),savedPatch=this.link?.pending;
       const result=await this.request('/api/connect',{map_id:me.map_id||this.link?.map_id||null,session_id:this.sessionId,has_local_data:this.api.hasSavedData||this.pending,data:before,view:this.getView()});
       const duringConnection=Core.diff(before,this.stateData());
       this.mapId=result.map_id;this.base=result.data;this.revision=result.revision;this.active=result.active;this.connected=true;this.retry=800;
       const next=Core.patch(savedPatch?Core.patch(result.data,savedPatch):result.data,duringConnection);this.api.applyData(next,result.can_undo);this.pending=!Core.empty(Core.diff(this.base,next));this.persist();
       this.showReady();if(this.pending)await this.flush();await this.poll();
     }catch(e){this.connected=false;this.status('Sin conexión · tu mapa sigue guardado aquí');this.timer=setTimeout(()=>this.start(),this.retry);this.retry=Math.min(15000,this.retry*2);}
     finally{this.running=false;}
   }
   async beginPair(){
     if(this.pairStarting)return;this.pairStarting=true;clearTimeout(this.pairTimer);
     try{if(!localStorage.getItem(KEY+':before-direct-v1'))localStorage.setItem(KEY+':before-direct-v1',JSON.stringify(this.api.getState()));const result=await this.request('/api/pair/start',{session_id:this.sessionId,data:this.stateData(),view:this.getView()});
       if(result.state==='linked'){await this.acceptPair(result);return;}
       this.ui.querySelector('#direct-pair-code').value=result.pairing_code;this.ui.querySelector('#direct-pairing').hidden=false;this.status('Pega el código en este chat · sin iniciar sesión en la web');this.pairTimer=setTimeout(()=>this.pollPair(),1000);
     }catch{this.status('No pude generar el código. Tu mapa sigue guardado aquí.');}finally{this.pairStarting=false;}
   }
   async pollPair(){try{const result=await this.request('/api/pair/status',{data:this.stateData(),view:this.getView()});if(result.state==='linked'){await this.acceptPair(result);return;}if(result.state==='expired'){this.ui.querySelector('#direct-pair-code').value='';this.status('El código caducó. Pulsa Conectar con mi chat para crear otro.');return;}this.pairTimer=setTimeout(()=>this.pollPair(),1000);}catch{this.status('Sin conexión · conservé tu mapa y el código');this.pairTimer=setTimeout(()=>this.pollPair(),3000);}}
   async acceptPair(result){
     if(!result.data)result=await this.request('/api/pair/status',{data:this.stateData(),view:this.getView()});
     clearTimeout(this.pairTimer);this.ui.querySelector('#direct-pairing').hidden=true;this.ui.querySelector('#direct-pair-code').value='';
     if(result.data){this.link={owner_id:result.owner_id,map_id:result.map_id,base:result.data,revision:result.revision,pending:Core.diff(result.data,this.stateData())};localStorage.setItem(LINK,JSON.stringify(this.link));}
     this.pairingNeeded=false;this.status('Mapa vinculado · conectando esta vista…');await this.start();
   }
   showReady(){this.status(this.pending?'Guardando cambios…':this.active?'Conectado al chat · este mapa está activo':'Conectado · otra vista está activa');}
   localChanged(){this.pending=true;if(this.base)this.persist();if(!this.connected)return;this.status('Guardando cambios…');clearTimeout(this.flushTimer);this.flushTimer=setTimeout(()=>this.flush(),180);}
   async flush(){
     if(!this.connected||this.sending||!this.base)return;clearTimeout(this.flushTimer);
     const sent=this.stateData(),change=Core.diff(this.base,sent);if(Core.empty(change)){this.pending=false;this.persist();return;}
     this.sending=true;
     try{
       const response=await this.request('/api/save',this.packet({base_revision:this.revision,request_id:'web-'+crypto.randomUUID(),patch:change}));
       const more=Core.diff(sent,this.stateData());let next;
       if(response.conflict){next=Core.patch(response.data,change);next=Core.patch(next,more);}else next=Core.patch(response.data,more);
       this.base=response.data;this.revision=response.revision;this.api.applyData(next,response.can_undo);this.pending=!Core.empty(Core.diff(this.base,next));this.persist();this.showReady();
     }catch(e){this.connected=false;this.pending=true;this.persist();this.status('Sin conexión · tus cambios siguen guardados aquí');this.timer=setTimeout(()=>this.start(),1200);}
     finally{this.sending=false;if(this.pending&&this.connected)this.flushTimer=setTimeout(()=>this.flush(),80);else this.pollSoon();}
   }
   pollSoon(){if(!this.connected)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.poll(),50);}
   async poll(){
     if(!this.connected||this.polling)return;clearTimeout(this.timer);this.polling=true;
     try{
       const result=await this.request('/api/poll',this.packet({revision:this.revision,applied_revision:this.revision,view:this.getView()}));this.active=result.active;
       if(result.data&&!this.pending&&!this.sending&&!this.api.getView().busy){this.base=result.data;this.revision=result.revision;this.api.applyData(result.data,result.can_undo);this.persist();
         await this.request('/api/poll',this.packet({revision:this.revision,applied_revision:this.revision,view:this.getView()}));}
       this.showReady();
     }catch(e){this.connected=false;this.status('Sin conexión · tu mapa sigue guardado aquí');}
     finally{this.polling=false;this.timer=setTimeout(()=>this.connected?this.poll():this.start(),document.hidden?4500:800);}
   }
   async activate(){try{await this.flush();const result=await this.request('/api/activate',this.packet({revision:this.revision,applied_revision:this.revision,view:this.getView()}));this.active=result.active;this.showReady();}catch{this.status('No pude activar esta vista. Reintenta al conectar.');}}
   async undo(){try{await this.flush();if(!this.connected)throw new Error();const result=await this.request('/api/undo',this.packet({request_id:'undo-'+crypto.randomUUID()}));this.base=result.data;this.revision=result.revision;this.api.applyData(result.data,result.can_undo);this.pending=false;this.persist();this.pollSoon();}catch{this.status('No pude deshacer. Tu edición local está conservada.');}}
 };
})();
