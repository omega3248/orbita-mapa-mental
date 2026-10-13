(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
 function hex(value){const s=String(value??'').trim();if(/^#[\da-f]{6}$/i.test(s))return s.toLowerCase();if(/^#[\da-f]{3}$/i.test(s))return '#'+s.slice(1).split('').map(c=>c+c).join('').toLowerCase();return '';}
 function rgb(value){const s=hex(value)||'#000000';return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16));}
 function fromRGB(r,g,b){return '#'+[r,g,b].map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');}
 function hsv(value){const [r,g,b]=rgb(value).map(v=>v/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}return {h,s:max?d/max:0,v:max};}
 function hsvRGB({h=0,s=0,v=1}){h=((Number(h)||0)%360+360)%360;s=clamp(s,0,1);v=clamp(v,0,1);const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const a=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return a.map(n=>Math.round((n+m)*255));}
 const fromHSV=value=>fromRGB(...hsvRGB(value));
 function mix(a,b,ratio){const x=rgb(a),y=rgb(b),t=clamp(ratio,0,1);return fromRGB(...x.map((n,i)=>n*(1-t)+y[i]*t));}
 function luminance(value){const [r,g,b]=rgb(value).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;}
 const ink=value=>luminance(value)>.179?'#000000':'#ffffff';
 const api={hex,rgb,fromRGB,hsv,hsvRGB,fromHSV,mix,luminance,ink};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OrbitaColor=api;
})(typeof window==='undefined'?globalThis:window);
