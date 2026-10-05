import type { Request, Calculation, Response } from '../domain/types.ts';
import { calculate } from '../planner/calculate.ts';
export class WorkerClient {
 private worker:Worker|null=null;
 private timer:ReturnType<typeof setTimeout>|null=null;
 cancel():void {this.worker?.terminate();this.worker=null;if(this.timer)clearTimeout(this.timer);this.timer=null;}
 run(request:Request,done:(c:Calculation)=>void,fail:(message:string)=>void):void {
  this.cancel();
  const fallback=()=>{try{done(calculate(request.scenario,request.referenceScenario,request.referencePlan));}catch(e){fail(e instanceof Error?e.message:'Calculation failed.');}};
  if(typeof Worker==='undefined'){queueMicrotask(fallback);return;}
  try {this.worker=new Worker(new URL('../planner/worker.ts',import.meta.url),{type:'module'});}
  catch {queueMicrotask(fallback);return;}
  this.timer=setTimeout(()=>{this.cancel();fail('The route check took too long. Retry the calculation or reset the sample round.');},5000);
  this.worker.onmessage=(e:MessageEvent<Response>)=>{if(e.data.id!==request.id)return;this.cancel();if(e.data.ok)done(e.data.value);else fail(e.data.message);};
  this.worker.onerror=()=>{this.cancel();queueMicrotask(fallback);};
  this.worker.postMessage(request);
 }
}
