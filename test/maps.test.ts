import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {feature,neighbors} from 'topojson-client';
import {prefectures} from '../src/prefectures.js';
import {build,validate} from '../src/geometry/index.js';
import {render,icon,type MapFeature} from '../src/rendering/index.js';
import type {GeometryCollection,Topology} from 'topojson-specification';
const fixtures={type:'FeatureCollection',features:prefectures.flatMap((p,i)=>[0,1].map(j=>({type:'Feature',properties:{N03_001:p.name,N03_007:p.code+'001'},geometry:{type:'Polygon',coordinates:[[[130+i*.02+j*.01,35],[130+i*.02+(j+1)*.01,35],[130+i*.02+(j+1)*.01,35.02],[130+i*.02+j*.01,35.02],[130+i*.02+j*.01,35]]]}})))};
const input={'fixture.geojson':JSON.stringify(fixtures)};
function checkSvg(svg:string,expected:number){assert.equal(XMLValidator.validate(svg),true);const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',isArray:name=>name==='path'}).parse(svg).svg;const box=parsed.viewBox.split(' ').map(Number);assert.equal(box.length,4);assert.ok(box.every(Number.isFinite)&&box[2]>0&&box[3]>0);const paths=parsed.g?.path??parsed.path;assert.equal(paths.length,expected);assert.equal(new Set(paths.map((p:{id:string})=>p.id)).size,expected);for(const p of paths){assert.match(p.id,/^pref-\d{2}$/);assert.ok(p.d&&!/NaN|Infinity/.test(p.d));assert.equal(prefectures.find(f=>f.code===p['data-code'])?.name,p['data-name']);}return paths;}
test('municipal dissolve, shared topology, canonical properties and reproducibility',async()=>{const a=await build(input,'fixture.geojson','100%');const b=await build(input,'fixture.geojson','100%');assert.deepEqual(a,b);validate(a);const object=a.objects.prefectures as GeometryCollection;const fs=(feature(a,object) as unknown as {features:MapFeature[]}).features;assert.deepEqual(fs.map(f=>f.properties.code),prefectures.map(p=>p.code));assert.equal(fs.length,47);assert.ok(neighbors(object.geometries).some(n=>n.length>0));for(const layout of ['video','geographic'] as const){const svg=render(fs,layout,1600,900);const paths=checkSvg(svg,47);assert.ok(svg.includes('.prefectures'));assert.ok(paths.every((p:Record<string,string>)=>!p.fill));assert.equal(svg,render(fs,layout,1600,900));}checkSvg(render(fs,'video',900,1600),47);for(const f of fs){assert.equal(checkSvg(icon(f,'all'),1)[0].fill,'currentColor');checkSvg(icon(f,'largest'),1);}});
test('reject invalid code/name and incomplete coverage',async()=>{const bad=structuredClone(fixtures);bad.features[0].properties.N03_007='99001';await assert.rejects(build({'bad.geojson':JSON.stringify(bad)},'bad.geojson','5%'));await assert.rejects(build({'bad.geojson':JSON.stringify({...fixtures,features:fixtures.features.slice(2)})},'bad.geojson','5%'));await assert.rejects(build(input,'fixture.geojson','0%'));});
test('generated real assets, XML, 47 silhouettes and recorded hashes',async(t)=>{let manifest;try{manifest=JSON.parse(await readFile('dist/manifest.json','utf8'));}catch{t.skip('Run generate:maps to verify real assets');return;}const topo=JSON.parse(await readFile('dist/japan.topojson','utf8')) as Topology;validate(topo);assert.equal((feature(topo,topo.objects.prefectures) as unknown as {features:unknown[]}).features.length,47);assert.equal((await readdir('dist/prefectures')).filter(n=>n.endsWith('.svg')).length,47);for(const [name,meta] of Object.entries(manifest.files) as [string,{bytes:number;sha256:string}][]){const data=await readFile('dist/'+name);assert.equal(data.length,meta.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),meta.sha256);if(name.endsWith('.svg'))checkSvg(data.toString(),name.startsWith('prefectures/')?1:47);}});

test('explicit island partition and exported D3 projection reproduce SVG paths',async()=>{
 const {createLayout,layoutPaths,polygons,selectRegion}=await import('../src/rendering/layout.js');
 const polygon=(x:number,y:number)=>[[[x,y],[x+.1,y],[x+.1,y+.1],[x,y+.1],[x,y]]];
 const fs:MapFeature[]=[{type:'Feature',properties:{code:'13',name:'東京都'},geometry:{type:'MultiPolygon',coordinates:[polygon(139,35),polygon(139,33),polygon(142,27),polygon(153,24)]}},{type:'Feature',properties:{code:'47',name:'沖縄県'},geometry:{type:'MultiPolygon',coordinates:[polygon(127,26),polygon(124,24)]}},{type:'Feature',properties:{code:'46',name:'鹿児島県'},geometry:{type:'MultiPolygon',coordinates:[polygon(130,31),polygon(129,28)]}}];
 const before=JSON.stringify(fs);
 for(const [w,h] of [[1600,900],[900,1600]]){
  const layout=createLayout(fs,w,h,{file:'japan.topojson',object:'prefectures',sha256:'fixture'});
  assert.deepEqual(layout.regions.find(r=>r.id==='okinawa')!.members,[{code:'47',polygonIndices:[0,1]}]);
  assert.equal(layout.regions.some(r=>String(r.id)==='ogasawara'),false);
  assert.deepEqual(layout.omitted.filter(m=>m.reason==='ogasawara').map(m=>m.polygonIndex),[2,3]);
  assert.ok(layout.regions[0].members.some(m=>m.code==='46'));
  assert.equal(layout.regions.flatMap(r=>selectRegion(fs,r)).reduce((sum,f)=>sum+polygons(f).length,0)+layout.omitted.length,8);
  const paths=layoutPaths(fs,JSON.parse(JSON.stringify(layout)));
  const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',isArray:n=>n==='path'}).parse(render(fs,'video',w,h,layout));
  for(const p of parsed.svg.g.path) assert.equal(p.d,paths[p['data-code']]);
  assert.equal(JSON.stringify(fs),before);
 }
});

test('distributed JavaScript helper matches actual SVGs using master TopoJSON',async(t)=>{
 let layout;try{layout=JSON.parse(await readFile('dist/japan-video-16x9.layout.json','utf8'));}catch{t.skip('Generate layout assets first');return;}
 const {layoutPaths,createLayout}=await import('../dist/japan-layout.js' as string);
 const topo=JSON.parse(await readFile('dist/japan.topojson','utf8')) as Topology;
 const fs=(feature(topo,topo.objects.prefectures) as unknown as {features:MapFeature[]}).features;
 const hash=createHash('sha256').update(await readFile('dist/japan.topojson')).digest('hex');
 for(const aspect of ['16x9','9x16']){
  layout=JSON.parse(await readFile(`dist/japan-video-${aspect}.layout.json`,'utf8'));
  assert.equal(layout.source.sha256,hash);
  assert.deepEqual(createLayout(fs,layout.width,layout.height,layout.source),layout);
  assert.equal(render(fs,'video',layout.width,layout.height,layout),await readFile(`dist/japan-video-${aspect}.svg`,'utf8'));
  const assigned=layout.regions.flatMap((r:{members:{code:string;polygonIndices:number[]}[]})=>r.members.flatMap(m=>m.polygonIndices.map(i=>`${m.code}/${i}`)));
  assert.equal(assigned.length,new Set(assigned).size);
  const excluded=layout.omitted.map((m:{code:string;polygonIndex:number})=>`${m.code}/${m.polygonIndex}`);
  assert.equal(new Set([...assigned,...excluded]).size,assigned.length+excluded.length);
  assert.equal(assigned.length+excluded.length,fs.reduce((n,f)=>n+(f.geometry.type==='Polygon'?1:f.geometry.coordinates.length),0));
  const paths=layoutPaths(fs,layout);const svg=await readFile(`dist/japan-video-${aspect}.svg`,'utf8');
  const parsed=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',isArray:n=>n==='path'}).parse(svg);
  for(const p of parsed.svg.g.path) assert.equal(p.d,paths[p['data-code']]);
  const label=layout.regions[1].textLabel;
  assert.equal(parsed.svg.text['#text'],'沖縄地方');
  assert.equal(Number(parsed.svg.text.x),label.x);
  assert.equal(Number(parsed.svg.text.y),label.y);
  const {geoPath}=await import('d3-geo');
  const {restoreProjection,selectRegion}=await import('../src/rendering/layout.js');
  const islandBounds=geoPath(restoreProjection(layout.regions[1].projection)).bounds({type:'FeatureCollection',features:selectRegion(fs,layout.regions[1])});
  assert.ok(islandBounds[0][1]>label.y);
 }
});

test('Okinawa frame aligns with Hokkaido including its eastern islands',async()=>{
 const {geoPath}=await import('d3-geo');
 const {createLayout,restoreProjection,selectRegion,orient}=await import('../src/rendering/layout.js');
 const polygon=(x:number,y:number)=>[[[x,y],[x+.05,y],[x+.05,y+.05],[x,y+.05],[x,y]]];
 const fs:MapFeature[]=[{type:'Feature',properties:{code:'01',name:'北海道'},geometry:{type:'MultiPolygon',coordinates:[polygon(142,43),polygon(156,45)]}},{type:'Feature',properties:{code:'13',name:'東京都'},geometry:{type:'MultiPolygon',coordinates:[polygon(139,35),polygon(142,27)]}},{type:'Feature',properties:{code:'46',name:'鹿児島県'},geometry:{type:'Polygon',coordinates:polygon(130,29)}},{type:'Feature',properties:{code:'47',name:'沖縄県'},geometry:{type:'Polygon',coordinates:polygon(127,26)}}];
 for(const [w,h] of [[1600,900],[900,1600]]){
  const source={file:'japan.topojson',object:'prefectures',sha256:'fixture'};
  const layout=createLayout(fs,w,h,source);
  const path=geoPath(restoreProjection(layout.regions[0].projection));
  const hokkaido=selectRegion(fs,layout.regions[0]).find(f=>f.properties.code==='01')!;
  assert.equal(layout.regions[1].frame!.bounds[1][0],path.bounds(hokkaido)[1][0]);
 }
});

 test('real landscape suppresses islands intersecting the Okinawa frame',async()=>{
 const {geoPath}=await import('d3-geo');const {restoreProjection,polygons,orient}=await import('../src/rendering/layout.js');
 const layout=JSON.parse(await readFile('dist/japan-video-16x9.layout.json','utf8'));
 const topo=JSON.parse(await readFile('dist/japan.topojson','utf8')) as Topology;
 const fs=(feature(topo,topo.objects.prefectures) as unknown as {features:MapFeature[]}).features;
 const omitted=layout.omitted.filter((m:{reason:string})=>m.reason==='okinawa-frame-overlap');assert.ok(omitted.length>0);
 const [[x0,y0],[x1,y1]]=layout.regions[1].frame.bounds;const path=geoPath(restoreProjection(layout.regions[0].projection));
 for(const m of omitted){const f=fs.find(f=>f.properties.code===m.code)!;const p=polygons(f)[m.polygonIndex];
  const [[a,b],[c,d]]=path.bounds(orient({...f,geometry:{type:'Polygon',coordinates:p}}));
  assert.ok(c>=x0-2&&a<=x1+2&&d>=y0-2&&b<=y1+2);
  assert.ok(!layout.regions[0].members.find((member:{code:string})=>member.code===m.code)?.polygonIndices.includes(m.polygonIndex));
 }
 });
