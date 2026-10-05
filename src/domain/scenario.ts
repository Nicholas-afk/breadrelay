import type { Scenario, Validation, FieldError } from './types.ts';
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
export function validateScenario(input:unknown):Validation<Scenario> {
 const errors:FieldError[]=[];
 const fail=(path:string,message:string)=>errors.push({path,message});
 if(!object(input)) return {ok:false,errors:[{path:'round',message:'Choose a JSON round file containing an object.'}]};
 const number=(x:unknown,path:string,min:number,max:number)=>{if(typeof x!=='number'||!Number.isInteger(x)||x<min||x>max)fail(path,`Enter a whole number from ${min} to ${max}.`);};
 const text=(x:unknown,path:string,max:number)=>{if(typeof x!=='string'||!x.trim()||x.length>max)fail(path,`Enter 1–${max} characters.`);};
 if(input.schemaVersion!==1)fail('schemaVersion','Use round schema version 1.');
 if(input.timezone!=='Asia/Hong_Kong')fail('timezone','Use Asia/Hong_Kong time for this version.');
 if(!['synthetic','operator'].includes(String(input.dataKind)))fail('dataKind','Label the data as synthetic or operator supplied.');
 if(input.maxStops!==3)fail('maxStops','This version allows up to 3 stops per volunteer.');
 text(input.title,'title',80);text(input.travelSource,'travelSource',240);
 const date=input.serviceDate;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('serviceDate','Enter a real date in YYYY-MM-DD format.');
 if(!object(input.hub)||input.hub.id!=='hub')fail('hub','Include the collection hub with ID hub.');
 else text(input.hub.label,'hub.label',80);
 const ids=new Set(['hub']);
 const id=(x:unknown,path:string)=>{if(typeof x!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(x)||ids.has(x))fail(path,'Use a unique lowercase ID, up to 32 letters, digits or hyphens.');else ids.add(x);};
 const pickups=Array.isArray(input.pickups)?input.pickups:[];
 if(!Array.isArray(input.pickups)||pickups.length>10)fail('pickups','Include a list of at most 10 pickups.');
 pickups.forEach((x,i)=>{
  const base=`pickups.${i}`;if(!object(x)){fail(base,'Include a pickup object.');return;}
  id(x.id,`${base}.id`);text(x.label,`${base}.label`,80);number(x.weightGrams,`${base}.weightGrams`,1,100000);
  for(const k of ['readyMinute','closeMinute','hubDeadlineMinute'])number(x[k],`${base}.${k}`,0,1439);
  number(x.serviceMinutes,`${base}.serviceMinutes`,0,120);
  if(typeof x.readyMinute==='number'&&typeof x.serviceMinutes==='number'&&typeof x.closeMinute==='number'&&x.readyMinute+x.serviceMinutes>x.closeMinute)fail(`${base}.closeMinute`,'Allow enough time to finish collection before closing.');
 });
 const volunteers=Array.isArray(input.volunteers)?input.volunteers:[];
 if(!Array.isArray(input.volunteers)||volunteers.length>3)fail('volunteers','Include a list of at most 3 volunteers.');
 volunteers.forEach((x,i)=>{
  const base=`volunteers.${i}`;if(!object(x)){fail(base,'Include a volunteer object.');return;}
  id(x.id,`${base}.id`);text(x.label,`${base}.label`,80);number(x.capacityGrams,`${base}.capacityGrams`,0,200000);
  number(x.startMinute,`${base}.startMinute`,0,1439);number(x.endMinute,`${base}.endMinute`,0,1439);
  if(typeof x.available!=='boolean')fail(`${base}.available`,'Set availability to true or false.');
  if(typeof x.startMinute==='number'&&typeof x.endMinute==='number'&&x.startMinute>x.endMinute)fail(`${base}.endMinute`,'End the shift after it starts, on the same day.');
 });
 const locations=['hub',...pickups.filter(object).map(x=>x.id).filter((x):x is string=>typeof x==='string')];
 const matrix=input.travelMinutes;
 if(!object(matrix))fail('travelMinutes','Include a complete directed travel-time table.');
 else {
  if(Object.keys(matrix).some(k=>!locations.includes(k)))fail('travelMinutes','Remove unknown locations from the travel-time table.');
  for(const a of locations){const row=matrix[a];if(!object(row)){fail(`travelMinutes.${a}`,'Include all travel times from this location.');continue;}
   if(Object.keys(row).some(k=>!locations.includes(k)))fail(`travelMinutes.${a}`,'Remove unknown destinations from this row.');
   for(const b of locations){number(row[b],`travelMinutes.${a}.${b}`,0,180);if(a===b&&typeof row[b]==='number'&&row[b]!==0)fail(`travelMinutes.${a}.${b}`,'Travel to the same location must take 0 minutes.');}
  }
 }
 return errors.length?{ok:false,errors}:{ok:true,value:structuredClone(input) as unknown as Scenario};
}
