const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {DatabaseSync}=require('node:sqlite');
function database(filename){
 const sql=new DatabaseSync(filename);
 return {sql,prepare(text){return {bind(...args){return {first:async()=>sql.prepare(text).get(...args)||null,run:async()=>({meta:{changes:Number(sql.prepare(text).run(...args).changes)}})};}};},
 async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
async function worker(){const source=fs.readFileSync(path.join(__dirname,'../dist/server/index.js'),'utf8');return (await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;}
function migrate(db){const file=fs.readFileSync(path.join(__dirname,'../drizzle/0000_orbita_direct.sql'),'utf8');db.sql.exec(file);}
module.exports={database,worker,migrate};
if(require.main===module)(async()=>{const db=database(':memory:');migrate(db);const app=await worker();http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const h=new Headers(req.headers);h.set('oai-authenticated-user-id','local_orbita_owner');const request=new Request('http://127.0.0.1:4175'+req.url,{method:req.method,headers:h,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await app.fetch(request,{DB:db});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(e.message);}}).listen(4175,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4175'));})();
