import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {basename,resolve,extname,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {feature} from 'topojson-client';
import ts from 'typescript';
import {createLayout} from './rendering/layout.js';
import {args} from './cli.js';
import {build} from './geometry/index.js';
import {render,icon,type MapFeature} from './rendering/index.js';
const options=args();
try {
 const inputPath=resolve(options.input ?? 'data/source/N03-20260101_GML.zip');
 if(!/^[\w.-]+$/.test(basename(inputPath))) throw new Error('Input filename must contain only letters, numbers, underscores, dots or hyphens');
 let geometryPath=inputPath;
 let temporary:string|undefined;
 const archiveHash=extname(inputPath)==='.zip'?createHash('sha256').update(await readFile(inputPath)).digest('hex'):undefined;
 if(extname(inputPath)==='.zip') {
  const entries=execFileSync('unzip',['-Z1',inputPath],{encoding:'utf8'}).trim().split('\n');
  const shp=entries.filter(n=>/^N03-[0-9_]+\.shp$/.test(n));
  if(shp.length!==1) throw new Error('ZIP must contain exactly one municipal N03 shapefile at its root; extract a chosen .shp manually');
  temporary=await mkdtemp(resolve(tmpdir(),'japan-map-'));
  const stem=shp[0].slice(0,-4);
  execFileSync('unzip',['-q',inputPath,...entries.filter(n=>n.startsWith(stem+'.')&&/^N03-[0-9_]+\.(shp|shx|dbf|prj|cpg)$/.test(n)),'-d',temporary]);
  geometryPath=resolve(temporary,shp[0]);
 }
 const inputs:Record<string,Buffer>={[basename(geometryPath)]:await readFile(geometryPath)};
 if(extname(geometryPath)==='.shp') for(const name of await readdir(dirname(geometryPath))) if(name.startsWith(basename(geometryPath,'.shp')+'.')) inputs[name]=await readFile(resolve(dirname(geometryPath),name));
 if(temporary) await rm(temporary,{recursive:true});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(options['source-date']!)) throw new Error('source-date must be YYYY-MM-DD');
 const master=await build(inputs,basename(geometryPath),options.retain!);
 const icons=await build(inputs,basename(geometryPath),options['icon-retain']!);
 const maps=(feature(master,master.objects.prefectures) as unknown as {features:MapFeature[]}).features;
 const silhouettes=(feature(icons,icons.objects.prefectures) as unknown as {features:MapFeature[]}).features;
 const topoText=JSON.stringify(master)+'\n';
 const source={file:'japan.topojson',object:'prefectures',sha256:createHash('sha256').update(topoText).digest('hex')};
 const landscape=createLayout(maps,1600,900,source);
 const portrait=createLayout(maps,900,1600,source);
 const files:Record<string,string>={'japan.topojson':topoText,'japan-video.svg':render(maps,'video',1600,900,landscape),'japan-video-16x9.svg':render(maps,'video',1600,900,landscape),'japan-video-9x16.svg':render(maps,'video',900,1600,portrait),'japan-geographic.svg':render(maps,'geographic',1200,1200)};
 files['japan-video-16x9.layout.json']=JSON.stringify(landscape,null,2)+'\n';
 files['japan-video-9x16.layout.json']=JSON.stringify(portrait,null,2)+'\n';
 files['japan-layout.js']=ts.transpileModule(await readFile(new URL('./rendering/layout.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 for(const f of silhouettes) files[`prefectures/${f.properties.code}.svg`]=icon(f,options['icon-islands']!);
 const hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
 let acquisition:unknown=null;
 try {acquisition=JSON.parse(await readFile(inputPath+'.metadata.json','utf8'));}catch{}
 const manifest={source:{title:'MLIT National Land Numerical Information, Administrative Areas (N03)',page:'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html',license:'CC BY 4.0 (2026 release; verify terms for other releases)',date:options['source-date'],acquiredDate:options['acquired-date']??null,acquisition,archiveSha256:archiveHash,inputs:Object.fromEntries(Object.entries(inputs).sort().map(([name,data])=>[name,hash(data)]))},settings:{retain:options.retain,iconRetain:options['icon-retain'],iconIslands:options['icon-islands'],projection:'Conic conformal, parallels 30/40, central meridian 137',videoInsets:'Okinawa only; frame right aligned to projected Hokkaido east edge; Ogasawara and secondary island components overlapping the frame omitted in video layouts'},files:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,{bytes:Buffer.byteLength(data),sha256:hash(data)}]))};
 files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';
 const out=resolve(options.out!); await mkdir(resolve(out,'prefectures'),{recursive:true});
 for(const [name,data] of Object.entries(files)) await writeFile(resolve(out,name),data);
 console.log(`Generated ${Object.keys(files).length} files in ${out}`);
 console.log(JSON.stringify(manifest.files,null,2));
} catch(error) {console.error(error instanceof Error?error.message:error);process.exitCode=1;}
