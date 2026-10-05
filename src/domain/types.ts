export interface Pickup { id:string; label:string; weightGrams:number; readyMinute:number; closeMinute:number; serviceMinutes:number; hubDeadlineMinute:number }
export interface Volunteer { id:string; label:string; capacityGrams:number; startMinute:number; endMinute:number; available:boolean }
export interface Scenario { schemaVersion:1; title:string; serviceDate:string; timezone:'Asia/Hong_Kong'; dataKind:'synthetic'|'operator'; travelSource:string; hub:{id:'hub';label:string}; pickups:Pickup[]; volunteers:Volunteer[]; travelMinutes:Record<string,Record<string,number>>; maxStops:3 }
export interface Stop { pickupId:string; arrivalMinute:number; waitMinutes:number; collectionStartMinute:number; departMinute:number; loadAfterGrams:number; pickupSlackMinutes:number }
export interface Route { volunteerId:string; pickupIds:string[]; stops:Stop[]; returnMinute:number; weightGrams:number; travelMinutes:number; hubSlackMinutes:number }
export interface Plan { routes:Route[]; assignedIds:string[]; scheduledGrams:number; retainedCount:number; travelMinutes:number }
export type PriorAssignments=Record<string,string>;
export interface FieldError { path:string; message:string }
export type Validation<T>={ok:true;value:T}|{ok:false;errors:FieldError[]};
export type SolveResult={ok:true;plan:Plan}|{ok:false;reason:string};
export interface Baseline { plan:Plan; droppedRoutes:{volunteerId:string;reason:string}[] }
export interface Explanation { pickupId:string; kind:'infeasible'|'tradeoff'|'tie'; lossGrams:number|null; alternative:Plan|null; summary:string }
export interface Calculation { referencePlan:Plan; baseline:Baseline; recovery:Plan; explanations:Explanation[]; elapsedMs:number }
export interface Request { id:number; scenario:Scenario; referenceScenario:Scenario; referencePlan:Plan|null }
export type Response={id:number;ok:true;value:Calculation}|{id:number;ok:false;message:string};
