(function(){
 'use strict';
 const C=window.OrbitaColor,$=id=>document.getElementById(id),letters=['A','B','C','D','E'];
 class PaletteEditor{
   constructor(api){
     this.api=api;this.active=2;this.points=[];
     const button=document.createElement('button');button.id='palette-open';button.className='button palette-open';button.textContent='◉ Colores';document.querySelector('.top-actions').insertBefore(button,$('add'));button.onclick=()=>this.open();
     const dialog=document.createElement('dialog');dialog.id='palette-editor';dialog.className='palette-dialog';
     dialog.innerHTML='<div class="dialog-heading"><div><div class="eyebrow">DALE COLOR A TU MAPA</div><h2>Tu paleta de colores</h2></div><button id="palette-close" class="icon-button" aria-label="Cerrar paleta">×</button></div><div class="palette-layout"><div class="palette-wheel-column"><div id="palette-wheel" class="palette-wheel" tabindex="0" aria-label="Rueda de color: arrastra los puntos para ajustar las cinco muestras"><canvas id="palette-canvas" width="260" height="260" aria-hidden="true"></canvas><svg id="palette-markers" viewBox="0 0 260 260"></svg></div><p class="palette-wheel-tip">Arrastra los puntos o elige una muestra A–E.</p></div><div class="palette-settings"><label class="palette-label" for="palette-target">¿QUÉ QUIERES COLOREAR?</label><select id="palette-target"></select><div id="palette-preview" class="palette-preview"><span>Vista del color</span><strong id="palette-preview-name"></strong></div><div class="palette-ranges"><label for="palette-hue">Tono <output id="palette-hue-value"></output></label><input id="palette-hue" type="range" min="0" max="359" step="1"><label for="palette-saturation">Saturación <output id="palette-saturation-value"></output></label><input id="palette-saturation" type="range" min="0" max="100" step="1"><label for="palette-brightness">Brillo <output id="palette-brightness-value"></output></label><input id="palette-brightness" type="range" min="0" max="100" step="1"></div><div class="palette-codes"><label>HEX<input id="palette-hex" maxlength="7" spellcheck="false" aria-label="Código HEX"></label><label>R<input data-palette-rgb="0" type="number" min="0" max="255" aria-label="Rojo RGB"></label><label>G<input data-palette-rgb="1" type="number" min="0" max="255" aria-label="Verde RGB"></label><label>B<input data-palette-rgb="2" type="number" min="0" max="255" aria-label="Azul RGB"></label></div><p id="palette-error" class="palette-error" role="alert" hidden>Usa un color HEX como #A994F7.</p></div></div><div id="palette-swatches" class="palette-swatches"></div><div class="palette-harmony"><label for="palette-harmony">Crear combinación</label><select id="palette-harmony"><option value="free">Libre · mueve cada punto</option><option value="analogous">Colores cercanos</option><option value="complementary">Complementarios</option><option value="triad">Tríada</option></select><button id="palette-save" class="palette-text-button">Guardar estas cinco muestras</button></div><div class="palette-bottom"><button id="palette-reset" class="palette-text-button">Restaurar color del destino</button><span id="palette-status" role="status"></span><button id="palette-apply" class="button primary">Aplicar color</button></div>';
     document.body.append(dialog);this.dialog=dialog;this.drawWheel();
     $('palette-close').onclick=()=>dialog.close();$('palette-apply').onclick=()=>this.apply();$('palette-reset').onclick=()=>{api.reset($('palette-target').value);$('palette-status').textContent='Color original restaurado.';this.showTarget();};
     $('palette-save').onclick=()=>{api.savePalette(this.colors());$('palette-status').textContent='Paleta guardada en tu mapa.';};
     $('palette-target').onchange=()=>this.showTarget();
     $('palette-swatches').onclick=e=>{const button=e.target.closest('[data-palette-index]');if(button){this.active=Number(button.dataset.paletteIndex);this.render();}};
     for(const [id,key,scale]of[['palette-hue','h',1],['palette-saturation','s',.01],['palette-brightness','v',.01]])$(id).oninput=e=>{this.points[this.active][key]=Number(e.target.value)*scale;this.render();};
     $('palette-hex').oninput=e=>{const color=C.hex(e.target.value);$('palette-error').hidden=!!color;$('palette-apply').disabled=!color;if(color){this.points[this.active]=C.hsv(color);this.render();}};
     dialog.querySelectorAll('[data-palette-rgb]').forEach(input=>input.oninput=()=>{const fields=[...dialog.querySelectorAll('[data-palette-rgb]')];if(fields.some(f=>f.value===''||!Number.isFinite(Number(f.value))))return;this.points[this.active]=C.hsv(C.fromRGB(...fields.map(f=>f.value)));this.render();});
     $('palette-harmony').onchange=e=>this.harmony(e.target.value);
     const wheel=$('palette-wheel');let dragging=false;
     wheel.onpointerdown=e=>{if(e.button!==0)return;const marker=e.target.closest('[data-wheel-index]');if(marker)this.active=Number(marker.dataset.wheelIndex);dragging=true;wheel.setPointerCapture(e.pointerId);e.preventDefault();if(marker)this.render();else this.move(e);};
     wheel.onpointermove=e=>{if(dragging)this.move(e);};
     const end=e=>{dragging=false;if(wheel.hasPointerCapture(e.pointerId))wheel.releasePointerCapture(e.pointerId);};wheel.onpointerup=end;wheel.onpointercancel=end;
     wheel.onkeydown=e=>{const marker=e.target.closest('[data-wheel-index]');if(marker)this.active=Number(marker.dataset.wheelIndex);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const p=this.points[this.active],step=e.shiftKey?10:1;if(e.key==='ArrowLeft'||e.key==='ArrowRight')p.h=(p.h+(e.key==='ArrowRight'?step:-step)+360)%360;else p.s=Math.max(0,Math.min(1,p.s+(e.key==='ArrowUp'?step:-step)*.01));this.render();}else if(marker&&['Enter',' '].includes(e.key)){e.preventDefault();this.render();}};
   }
   colors(){return this.points.map(C.fromHSV);}
   open(preferred){
     this.points=this.api.getPalette().map(C.hsv);this.active=2;
     const select=$('palette-target');select.replaceChildren();
     for(const group of this.api.targets()){
       const optgroup=document.createElement('optgroup');optgroup.label=group.label;
       for(const item of group.items){const option=document.createElement('option');option.value=item.value;option.textContent=item.label;optgroup.append(option);}select.append(optgroup);
     }
     select.value=preferred||this.api.defaultTarget();if(!select.value)select.selectedIndex=0;
     $('palette-status').textContent='';$('palette-harmony').value='free';this.showTarget();this.dialog.showModal();
   }
   showTarget(){this.points[this.active]=C.hsv(this.api.getColor($('palette-target').value));this.render();}
   move(e){const r=$('palette-wheel').getBoundingClientRect(),dx=(e.clientX-r.left)*260/r.width-130,dy=(e.clientY-r.top)*260/r.height-130;const p=this.points[this.active];p.h=(Math.atan2(-dy,dx)*180/Math.PI+360)%360;p.s=Math.min(1,Math.hypot(dx,dy)/120);$('palette-harmony').value='free';this.render();}
   drawWheel(){
     const ctx=$('palette-canvas').getContext('2d'),pixels=ctx.createImageData(260,260);
     for(let y=0;y<260;y++)for(let x=0;x<260;x++){const dx=x-130,dy=y-130,r=Math.hypot(dx,dy);if(r>120)continue;const color=C.hsvRGB({h:(Math.atan2(-dy,dx)*180/Math.PI+360)%360,s:r/120,v:1}),i=(y*260+x)*4;pixels.data[i]=color[0];pixels.data[i+1]=color[1];pixels.data[i+2]=color[2];pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
   }
   render(){
     const color=this.colors()[this.active],p=this.points[this.active],colors=this.colors();
     const positions=this.points.map(p=>({x:130+Math.cos(p.h*Math.PI/180)*p.s*120,y:130-Math.sin(p.h*Math.PI/180)*p.s*120}));
     const focused=document.activeElement?.dataset.wheelIndex;
     $('palette-markers').innerHTML='<polygon points="'+positions.map(p=>p.x+','+p.y).join(' ')+'"/>'+positions.map((p,i)=>'<g data-wheel-index="'+i+'" tabindex="0" role="button" aria-label="Muestra '+letters[i]+' '+colors[i]+'"><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(i===this.active?10:8)+'" fill="'+colors[i]+'" class="'+(i===this.active?'active':'')+'"/><text x="'+p.x+'" y="'+(p.y+3)+'" fill="'+C.ink(colors[i])+'">'+letters[i]+'</text></g>').join('');
     if(focused!==undefined)$('palette-markers').querySelector('[data-wheel-index="'+focused+'"]')?.focus({preventScroll:true});
     $('palette-swatches').innerHTML=colors.map((c,i)=>'<button data-palette-index="'+i+'" class="palette-swatch '+(i===this.active?'active':'')+'" style="--swatch:'+c+';--swatch-ink:'+C.ink(c)+'" aria-label="Elegir muestra '+letters[i]+' '+c+'" aria-pressed="'+(i===this.active)+'"><strong>'+letters[i]+'</strong><span>'+c.toUpperCase()+'</span></button>').join('');
     for(const [id,value]of[['palette-hue',Math.round(p.h)],['palette-saturation',Math.round(p.s*100)],['palette-brightness',Math.round(p.v*100)],['palette-hex',color.toUpperCase()]]){if($(id)!==document.activeElement)$(id).value=value;}
     $('palette-hue-value').textContent=Math.round(p.h)+'°';$('palette-saturation-value').textContent=Math.round(p.s*100)+'%';$('palette-brightness-value').textContent=Math.round(p.v*100)+'%';
     const rgb=C.rgb(color);this.dialog.querySelectorAll('[data-palette-rgb]').forEach(input=>{if(input!==document.activeElement)input.value=rgb[Number(input.dataset.paletteRgb)];});
     $('palette-preview').style.background=color;$('palette-preview').style.color=C.ink(color);$('palette-preview-name').textContent=$('palette-target').selectedOptions[0]?.textContent||'';
     $('palette-error').hidden=true;$('palette-apply').disabled=false;
   }
   harmony(mode){if(mode==='free')return;const p={...this.points[this.active]},offsets=mode==='analogous'?[-40,-20,0,20,40]:mode==='complementary'?[0,20,180,200,340]:[0,120,240,60,180];this.points=offsets.map(a=>({...p,h:(p.h+a)%360}));this.active=mode==='analogous'?2:0;this.render();}
   apply(){const color=this.colors()[this.active];this.api.apply($('palette-target').value,color,this.colors());$('palette-status').textContent='Color aplicado y guardado.';}
 }
 window.OrbitaPalette=PaletteEditor;
})();
