import { parseArgs } from 'node:util';
export function args() {
 return parseArgs({options:{input:{type:'string'},out:{type:'string',default:'dist'},retain:{type:'string',default:'0.5%'},'icon-retain':{type:'string',default:'0.2%'},'icon-islands':{type:'string',default:'largest'},'source-date':{type:'string',default:'2026-01-01'},'acquired-date':{type:'string'},port:{type:'string',default:'4173'}},strict:true}).values;
}
