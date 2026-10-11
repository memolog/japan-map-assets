import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {args} from './cli.js';
const root=resolve('.');const port=Number(args().port);
createServer(async(req,res)=>{
 try {
 const url=new URL(req.url??'/', 'http://localhost');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/preview/index.html':url.pathname));
 if(!path.startsWith(root+sep)||!(path.startsWith(root+sep+'dist'+sep)||path.startsWith(root+sep+'preview'+sep))) {res.writeHead(403).end();return;}
 const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.topojson':'application/json'} as Record<string,string>)[extname(path)]??'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end('Generate maps first: npm run generate:maps');}
}).listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
