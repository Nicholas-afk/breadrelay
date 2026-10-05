import type { Scenario, PriorAssignments, SolveResult, Route, Plan } from '../domain/types.ts';
import { simulateRoute } from '../domain/simulate.ts';
interface Option { mask:number; route:Route }
interface State { mask:number; grams:number; retained:number; travel:number; routes:Route[]; key:string }
const earlier=(a:string,b:string)=>a<b;
function better(a:State,b:State):boolean {
 return a.grams!==b.grams?a.grams>b.grams:a.retained!==b.retained?a.retained>b.retained:a.travel!==b.travel?a.travel<b.travel:earlier(a.key,b.key);
}
function options(s:Scenario,volunteerId:string):Option[] {
 const v=s.volunteers.find(v=>v.id===volunteerId)!;
 const empty=simulateRoute(s,v,[])!;
 const best=new Map<number,Route>([[0,empty]]);
 function visit(ids:string[],mask:number):void {
  if(ids.length===s.maxStops)return;
  for(let i=0;i<s.pickups.length;i++){
   if(mask&(1<<i))continue;
   const next=[...ids,s.pickups[i].id],nextMask=mask|(1<<i),route=simulateRoute(s,v,next);
   if(route){const old=best.get(nextMask);if(!old||route.travelMinutes<old.travelMinutes||(route.travelMinutes===old.travelMinutes&&earlier(next.join('|'),old.pickupIds.join('|'))))best.set(nextMask,route);}
   // A later stop can shorten a non-metric route's return leg. Explore even if this prefix cannot return in time.
   visit(next,nextMask);
  }
 }
 visit([],0);return [...best].map(([mask,route])=>({mask,route}));
}
export function solve(s:Scenario,prior:PriorAssignments={},required?:string):SolveResult {
 const requiredIndex=required===undefined?-1:s.pickups.findIndex(p=>p.id===required);
 if(required!==undefined&&requiredIndex<0)return {ok:false,reason:'The requested pickup is not in this round.'};
 let states=new Map<number,State>([[0,{mask:0,grams:0,retained:0,travel:0,routes:[],key:''}]]);
 for(const v of s.volunteers.filter(v=>v.available).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)){
  const next=new Map<number,State>(),opts=options(s,v.id);
  for(const state of states.values())for(const {mask,route} of opts){
   if(mask&state.mask)continue;
   const candidate:State={mask:state.mask|mask,grams:state.grams+route.weightGrams,retained:state.retained+route.pickupIds.filter(id=>prior[id]===v.id).length,travel:state.travel+route.travelMinutes,routes:[...state.routes,route],key:state.key+v.id+':'+route.pickupIds.join('|')+';'};
   const old=next.get(candidate.mask);if(!old||better(candidate,old))next.set(candidate.mask,candidate);
  }
  states=next;
 }
 let best:State|undefined;
 for(const state of states.values())if((requiredIndex<0||Boolean(state.mask&(1<<requiredIndex)))&&(!best||better(state,best)))best=state;
 if(!best)return {ok:false,reason:'No route can include this pickup within the current limits.'};
 const plan:Plan={routes:best.routes.filter(r=>r.pickupIds.length),assignedIds:s.pickups.filter((_,i)=>Boolean(best!.mask&(1<<i))).map(p=>p.id).sort(),scheduledGrams:best.grams,retainedCount:best.retained,travelMinutes:best.travel};
 return {ok:true,plan};
}
