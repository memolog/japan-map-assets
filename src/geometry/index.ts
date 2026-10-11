import mapshaper from 'mapshaper';
import type {Topology} from 'topojson-specification';
import {prefectures} from '../prefectures.js';
export function run(commands: string, input: Record<string, string | Buffer>): Promise<Record<string,string | Buffer>> {
 return new Promise((resolve,reject)=>mapshaper.applyCommands(commands,input,(error,output)=>error?reject(error):resolve(output)));
}
export function validate(topology: Topology) {
 const object = topology.objects.prefectures;
 if (object?.type !== 'GeometryCollection' || object.geometries.length !== 47) throw new Error('Expected exactly 47 prefectures');
 const seen = new Set<string>();
 for (const g of object.geometries) {
  const props = g.properties as Record<string,unknown>|undefined;
  const code = String(props?.code); const p = prefectures.find(p=>p.code===code);
  if (!p || p.name !== props?.name || seen.has(code)) throw new Error(`Invalid prefecture: ${code}`);
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') throw new Error(`Invalid geometry: ${code}`);
  seen.add(code); g.id=code;
 }
 object.geometries.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
}
export async function build(input: Record<string,string | Buffer>, filename: string, retain: string) {
 if (!/^(?:100|[1-9]?\d)(?:\.\d+)?%$/.test(retain) || parseFloat(retain)<=0 || parseFloat(retain)>100) throw new Error('retain must be a percentage greater than 0 and at most 100');
 // Exact source coordinates are used for topology/dissolve; simplification operates on shared arcs.
 const mapping = JSON.stringify(Object.fromEntries(prefectures.map(p=>[p.name,p.code])));
 const output = await run(`-i ${filename} encoding=utf8 -each 'name=N03_001,code=${mapping}[name]; if(!code || (N03_007 && String(N03_007).slice(0,2)!==code)) throw new Error("Invalid N03 attributes")' -dissolve code copy-fields=name -rename-layers prefectures -simplify weighted ${retain} keep-shapes -o format=topojson no-quantization output.topojson`,input);
 const topo = JSON.parse(String(output['output.topojson'])) as Topology;
 validate(topo);
 for(const arc of topo.arcs) for(const c of arc) if(!Number.isFinite(c[0])||!Number.isFinite(c[1])||c[0]<120||c[0]>160||c[1]<20||c[1]>50) throw new Error('Expected geographic N03 coordinates in Japan; projected coordinates are unsupported');
 return topo;
}
