import test from 'node:test';
import assert from 'node:assert/strict';
import {solve} from '../src/planner/solve.ts';
import {validatePlan} from '../src/planner/validate-plan.ts';
import type {Scenario,PriorAssignments,Plan} from '../src/domain/types.ts';
let seed=31239;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
function scenario(directed=false):Scenario {
 const nodes=['hub',...Array.from({length:6},(_,i)=>'p-'+i)];
 const points=nodes.map((_,i)=>i?[Math.floor(random()*12),Math.floor(random()*12)]:[0,0]);
 const travelMinutes=Object.fromEntries(nodes.map((a,i)=>[a,Object.fromEntries(nodes.map((b,j)=>[b,i===j?0:Math.ceil(Math.hypot(points[i][0]-points[j][0],points[i][1]-points[j][1]))+(directed?Math.floor(random()*8):0)]))]));
 return {schemaVersion:1,title:'Oracle fixture',serviceDate:'2026-10-06',timezone:'Asia/Hong_Kong',dataKind:'synthetic',travelSource:'Seeded synthetic matrix',hub:{id:'hub',label:'Hub'},maxStops:3,travelMinutes,
 pickups:nodes.slice(1).map(id=>({id,label:id,weightGrams:(4+Math.floor(random()*12))*1000,readyMinute:Math.floor(random()*12),closeMinute:22+Math.floor(random()*28),hubDeadlineMinute:40+Math.floor(random()*28),serviceMinutes:3})),
 volunteers:Array.from({length:2},(_,i)=>({id:'v-'+i,label:'Crew '+i,capacityGrams:(20+Math.floor(random()*15))*1000,startMinute:Math.floor(random()*10),endMinute:70,available:true}))};
}
type Objective=[number,number,number];
const objective=(p:Plan):Objective=>[p.scheduledGrams,p.retainedCount,p.travelMinutes];
const better=(a:Objective,b:Objective)=>a[0]!==b[0]?a[0]>b[0]:a[1]!==b[1]?a[1]>b[1]:a[2]<b[2];
// Independent exhaustive assignment followed by every permutation; no production route helper is called.
function oracle(s:Scenario,prior:PriorAssignments={},required?:string):Objective|null {
 const crew=s.volunteers.filter(v=>v.available),bins: number[][]=crew.map(()=>[]);let best:Objective|null=null;
 function assign(index:number):void {
  if(index<s.pickups.length){assign(index+1);for(const bin of bins)if(bin.length<3){bin.push(index);assign(index+1);bin.pop();}return;}
  const chosen=bins.flat();if(required&&!chosen.some(i=>s.pickups[i].id===required))return;
  let weight=0,retained=0,travel=0;
  for(let d=0;d<crew.length;d++){
   const v=crew[d],bag=bins[d],load=bag.reduce((n,i)=>n+s.pickups[i].weightGrams,0);if(load>v.capacityGrams)return;
   let least=Infinity;
   function permute(todo:number[],order:number[]):void {
    if(todo.length){todo.forEach((i,j)=>permute(todo.filter((_,k)=>k!==j),[...order,i]));return;}
    let clock=v.startMinute,place='hub',minutes=0;
    for(const i of order){const p=s.pickups[i],leg=s.travelMinutes[place][p.id];minutes+=leg;clock=Math.max(clock+leg,p.readyMinute)+p.serviceMinutes;if(clock>p.closeMinute)return;place=p.id;}
    clock+=s.travelMinutes[place].hub;minutes+=s.travelMinutes[place].hub;
    if(clock>v.endMinute||bag.some(i=>clock>s.pickups[i].hubDeadlineMinute))return;least=Math.min(least,minutes);
   }
   permute(bag,[]);if(!Number.isFinite(least))return;weight+=load;travel+=least;retained+=bag.filter(i=>prior[s.pickups[i].id]===v.id).length;
  }
  const value:Objective=[weight,retained,travel];if(!best||better(value,best))best=value;
 }
 assign(0);return best;
}
test('350 production optimizer objectives match independent exhaustive oracle',()=>{
 let comparisons=0;
 function compare(s:Scenario,prior:PriorAssignments={},required?:string):Plan|null {
  const actual=solve(s,prior,required),expected=oracle(s,prior,required);comparisons++;
  assert.equal(actual.ok,expected!==null);if(!actual.ok)return null;
  assert.deepEqual(objective(actual.plan),expected);assert.equal(validatePlan(s,actual.plan,prior).ok,true);return actual.plan;
 }
 for(let i=0;i<100;i++){const s=scenario(),original=compare(s)!;const prior=Object.fromEntries(original.routes.flatMap(r=>r.pickupIds.map(id=>[id,r.volunteerId])));s.volunteers[0].available=false;compare(s,prior);}
 for(let i=0;i<50;i++){const s=scenario(true);compare(s);compare(s,{},s.pickups[i%6].id);compare(s,{},s.pickups[(i+3)%6].id);}
 assert.equal(comparisons,350);
});
