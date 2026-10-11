import {geoConicConformal, geoPath, geoArea, type GeoProjection} from 'd3-geo';
import type {FeatureCollection, Position} from 'geojson';
import type {MapFeature} from './index.js';
export type RegionId = 'mainland' | 'okinawa';
export interface LayoutRegion {
 id: RegionId; label: string;
 textLabel: {text:string; x:number; y:number; fontSize:number; fontFamily:string} | null;
 members: {code: string; polygonIndices: number[]}[];
 projection: {type: 'conicConformal'; parallels: [number,number]; rotate: [number,number]; center: [number,number]; scale: number; translate: [number,number]};
 frame: {path: string; bounds: [[number,number],[number,number]]} | null;
}
export interface MapLayout {
 schemaVersion: 2;
 omitted: {code:string; polygonIndex:number; reason:'ogasawara'|'okinawa-frame-overlap'}[]; width: number; height: number; digits: number;
 source: {file: string; object: string; sha256: string};
 regions: LayoutRegion[];
}
export function polygons(f:MapFeature): Position[][][] {return f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;}
export function orient(f:MapFeature):MapFeature {return {...f,geometry:{type:'MultiPolygon',coordinates:polygons(f).map(p=>p.map((ring,i)=>{let sum=0;for(let j=0;j<ring.length-1;j++) sum+=ring[j][0]*ring[j+1][1]-ring[j+1][0]*ring[j][1];return (i===0?sum>0:sum<0)?[...ring].reverse():ring;}))}};}
export function restoreProjection(p:LayoutRegion['projection']):GeoProjection {
 return geoConicConformal().parallels(p.parallels).rotate(p.rotate).center(p.center).scale(p.scale).translate(p.translate);
}
export function selectRegion(features:MapFeature[],region:LayoutRegion):MapFeature[] {
 const byCode=new Map(features.map(f=>[f.properties.code,f]));
 return region.members.map(member=>{
  const f=byCode.get(member.code);if(!f) throw new Error(`Missing prefecture ${member.code}`);
  const ps=polygons(f);
  const coordinates=member.polygonIndices.map(i=>{if(!ps[i])throw new Error(`Invalid polygon ${member.code}/${i}`);return ps[i];});
  return orient({...f,geometry:{type:'MultiPolygon',coordinates}});
 });
}
export function layoutPaths(features:MapFeature[],layout:MapLayout):Record<string,string> {
 const result:Record<string,string>=Object.fromEntries(features.map(f=>[f.properties.code,'']));
 for(const region of layout.regions){const path=geoPath(restoreProjection(region.projection)).digits(layout.digits);for(const f of selectRegion(features,region)) result[f.properties.code]+=path(f)??'';}
 return result;
}
export function createLayout(features:MapFeature[],width:number,height:number,source:MapLayout['source']):MapLayout {
 const portrait=height>width;const pad=Math.min(width,height)*.035;
 const regions:LayoutRegion[]=['mainland','okinawa'].map(id=>({id:id as RegionId,label:id==='okinawa'?'沖縄地方':'Mainland and other islands',textLabel:null,members:[],projection:{type:'conicConformal',parallels:[30,40],rotate:[-137,0],center:[0,36],scale:1,translate:[0,0]},frame:null}));
 const omitted:MapLayout['omitted']=[];
 for(const f of features) polygons(f).forEach((p,index)=>{
  if(f.properties.code==='13'&&p[0].every(c=>c[1]<28)) {omitted.push({code:f.properties.code,polygonIndex:index,reason:'ogasawara'});return;}
  const region=regions[f.properties.code==='47'?1:0];let member=region.members.find(m=>m.code===f.properties.code);
  if(!member){member={code:f.properties.code,polygonIndices:[]};region.members.push(member);}member.polygonIndices.push(index);
 });
 const main=regions[0];const mainFeatures=selectRegion(features,main);
 if(mainFeatures.length){
  const proj=restoreProjection(main.projection).fitExtent([[pad,pad],[width-pad,height*(portrait?.76:.96)]],{type:'FeatureCollection',features:mainFeatures});
  main.projection.scale=proj.scale();main.projection.translate=proj.translate() as [number,number];
 }
 const mainPath=geoPath(restoreProjection(main.projection));
 const hokkaido=mainFeatures.find(f=>f.properties.code==='01');
 // Include every source Hokkaido component, including the easternmost islands.
 const right=mainPath.bounds(hokkaido??{type:'FeatureCollection',features:mainFeatures})[1][0];
 const insetWidth=width*(portrait?.50:.30);
 const bounds:[[number,number],[number,number]]=[[Math.max(pad,right-insetWidth),height*(portrait?.80:.69)],[right,height*.965]];
 const [[x0,y0],[x1,y1]]=bounds;const inset=regions[1];
 if(inset.members.length){
  const margin=Math.min(x1-x0,y1-y0)*.12;
  const cut=Math.min(x1-x0,y1-y0)*.18;
  const fontSize=Math.min(width,height)*.018;
  const labelPadding=fontSize*.7;
  inset.textLabel={text:inset.label,x:x0+cut+labelPadding,y:y0+labelPadding+fontSize,fontSize,fontFamily:'sans-serif'};
  const proj=restoreProjection(inset.projection).fitExtent([[x0+margin,inset.textLabel.y+labelPadding],[x1-margin,y1-margin]],{type:'FeatureCollection',features:selectRegion(features,inset)});
  inset.projection.scale=proj.scale();inset.projection.translate=proj.translate() as [number,number];
  inset.frame={path:`M${x0+cut},${y0}H${x1}V${y1}H${x0}V${y0+cut}Z`,bounds};
  const byCode=new Map(features.map(f=>[f.properties.code,f]));
  for(const member of main.members){
   const f=byCode.get(member.code)!;const ps=polygons(f);
   const areas=ps.map(p=>geoArea(orient({...f,geometry:{type:'Polygon',coordinates:p}})));
   const largest=areas.indexOf(Math.max(...areas));
   member.polygonIndices=member.polygonIndices.filter(index=>{
    // Preserve each prefecture's principal landmass; omit complete island components,
    // never clip or modify source coordinates. A 2px clearance protects the frame stroke.
    if(index===largest)return true;
    const [[a,b],[c,d]]=mainPath.bounds(orient({...f,geometry:{type:'Polygon',coordinates:ps[index]}}));
    if(c>=x0-2&&a<=x1+2&&d>=y0-2&&b<=y1+2){omitted.push({code:member.code,polygonIndex:index,reason:'okinawa-frame-overlap'});return false;}
    return true;
   });
  }
  main.members=main.members.filter(m=>m.polygonIndices.length);
 }
 return {schemaVersion:2,width,height,digits:2,source,regions,omitted};
}
