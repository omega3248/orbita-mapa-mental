const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),publicDir=path.join(root,'public'),dist=path.join(root,'dist');
if(path.dirname(dist)!==root||path.basename(dist)!=='dist')throw Error('Invalid output directory');
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(path.join(dist,'server'),{recursive:true});fs.mkdirSync(path.join(dist,'.openai'),{recursive:true});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const assets={};for(const name of fs.readdirSync(publicDir)){const full=path.join(publicDir,name);if(fs.statSync(full).isFile())assets['/'+name]={body:fs.readFileSync(full,'utf8'),type:types[path.extname(name)]||'text/plain; charset=utf-8'};}
const common=['scene-math.js','connection-utils.js','direct-actions.js'].map(name=>fs.readFileSync(path.join(publicDir,name),'utf8')).join('\n');
const worker='const ASSETS='+JSON.stringify(assets)+';\n'+common+'\n'+fs.readFileSync(path.join(root,'worker/pairing.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'worker/service.js'),'utf8');
fs.writeFileSync(path.join(dist,'server/index.js'),worker);fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));
console.log('Built Órbita Worker: '+Object.keys(assets).length+' assets, '+Buffer.byteLength(worker)+' bytes.');
