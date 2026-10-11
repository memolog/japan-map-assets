import {createWriteStream} from 'node:fs';
import {mkdir,rename,writeFile,unlink} from 'node:fs/promises';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
const url='https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2026/N03-20260101_GML.zip';
const path='data/source/N03-20260101_GML.zip';
await mkdir('data/source',{recursive:true});
try {
 const response=await fetch(url,{signal:AbortSignal.timeout(30*60*1000)});
 if(!response.ok||!response.body) throw new Error(`Download failed: ${response.status}`);
 const hash=createHash('sha256'); let bytes=0;
 await pipeline(Readable.fromWeb(response.body as never),new Transform({transform(chunk,_,cb){hash.update(chunk);bytes+=chunk.length;cb(null,chunk);}}),createWriteStream(path+'.part'));
 await rename(path+'.part',path);
 await writeFile(path+'.metadata.json',JSON.stringify({url,acquiredDate:new Date().toISOString(),sourceDate:'2026-01-01',bytes,sha256:hash.digest('hex')},null,2)+'\n');
 console.log(`Downloaded ${bytes} bytes to ${path}`);
} catch(e) {await unlink(path+'.part').catch(()=>{});console.error(e);process.exitCode=1;}
