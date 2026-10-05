import { calculate } from './calculate.ts';
import type { Request, Response } from '../domain/types.ts';
self.onmessage=(event:MessageEvent<Request>)=>{
 const {id,scenario,referenceScenario,referencePlan}=event.data;
 let response:Response;
 try {response={id,ok:true,value:calculate(scenario,referenceScenario,referencePlan)};}
 catch(e){response={id,ok:false,message:e instanceof Error?e.message:'Calculation failed.'};}
 self.postMessage(response);
};
