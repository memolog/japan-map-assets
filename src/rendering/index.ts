import {createLayout,layoutPaths,polygons,orient,type MapLayout} from './layout.js';
import {geoConicConformal, geoPath, geoArea} from 'd3-geo';
import type {Feature, FeatureCollection, MultiPolygon, Polygon, Position} from 'geojson';
export type MapFeature = Feature<Polygon | MultiPolygon, {code:string;name:string}>;
const esc = (s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function projection() {return geoConicConformal().parallels([30,40]).rotate([-137,0]).center([0,36]);}
export function render(features:MapFeature[], layout:'video'|'geographic', width:number,height:number, config?:MapLayout) {
 let pieces:Record<string,string>;let frames='';let labels='';
 if(layout==='video') {
  const settings=config??createLayout(features,width,height,{file:'japan.topojson',object:'prefectures',sha256:''});
  pieces=layoutPaths(features,settings);
  frames=settings.regions.filter(r=>r.frame).map(r=>`<path class="inset" data-region="${r.id}" d="${r.frame!.path}"/>`).join('');
  labels=settings.regions.filter(r=>r.textLabel).map(r=>{const l=r.textLabel!;return `<text class="inset-label" data-region-label="${r.id}" x="${l.x}" y="${l.y}" font-size="${l.fontSize}" font-family="${esc(l.fontFamily)}">${esc(l.text)}</text>`;}).join('');
 }else{
  const fs=features.map(orient);const padding=Math.min(width,height)*.035;
  const proj=projection().fitExtent([[padding,padding],[width-padding,height-padding]],{type:'FeatureCollection',features:fs});
  const path=geoPath(proj).digits(2);pieces=Object.fromEntries(fs.map(f=>[f.properties.code,path(f)??'']));
 }
 const paths=features.map(f=>`<path id="pref-${f.properties.code}" data-code="${f.properties.code}" data-name="${esc(f.properties.name)}" d="${pieces[f.properties.code]}"/>`).join('\n');
 return svg(width,height,`<style>.prefectures{fill:var(--map-fill,#a8cbbd);stroke:var(--map-stroke,#263a36);stroke-width:var(--map-stroke-width,1);stroke-linejoin:round}.prefectures path{vector-effect:non-scaling-stroke}.inset-label{fill:var(--inset-label-color,#263a36);pointer-events:none}.inset{fill:none;stroke:var(--inset-stroke,#879b94);stroke-width:1;vector-effect:non-scaling-stroke}</style><g class="prefectures">${paths}</g>${frames}${labels}`);
}
function svg(width:number,height:number,body:string) {return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">${body}</svg>\n`;}
export function icon(feature:MapFeature, islands:string) {
 let f=orient(feature);
 if(islands==='largest') {const ps=polygons(f); ps.sort((a,b)=>geoArea({type:'Polygon',coordinates:b})-geoArea({type:'Polygon',coordinates:a}));f={...f,geometry:{type:'Polygon',coordinates:ps[0]}};}
 else if(islands!=='all') throw new Error('icon-islands must be all or largest');
 const proj=projection().scale(1).translate([0,0]); const path=geoPath(proj).digits(3);
 const [[x0,y0],[x1,y1]]=path.bounds(f); const w=x1-x0,h=y1-y0;
 if(!(w>0&&h>0)) throw new Error(`Empty icon ${f.properties.code}`);
 proj.scale(240/Math.max(w,h)).translate([2-x0*240/Math.max(w,h),2-y0*240/Math.max(w,h)]);
 return svg(w*240/Math.max(w,h)+4,h*240/Math.max(w,h)+4,`<path id="pref-${f.properties.code}" data-code="${f.properties.code}" data-name="${esc(f.properties.name)}" fill="currentColor" d="${path(f)}"/>`);
}
