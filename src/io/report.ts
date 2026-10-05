import type { Scenario, Calculation } from '../domain/types.ts';
export function createReport(referenceScenario:Scenario,scenario:Scenario,calculation:Calculation) {
 return {kind:'breadrelay-report',version:1,appVersion:'0.1.0',referenceScenario,currentScenario:scenario,referencePlan:calculation.referencePlan,baseline:calculation.baseline,recovery:calculation.recovery,explanations:calculation.explanations,claims:{dataKind:scenario.dataKind,metric:'scheduled-grams',actualDeliveryVerified:false,travelSource:scenario.travelSource}};
}
