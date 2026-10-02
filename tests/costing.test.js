import test from "node:test";
import assert from "node:assert/strict";
import {calculateCostEstimate,financeSyncKey,inventoryStatus,rollCostPerGram} from "../src/costing.js";

test("calcula costos, costo unitario y precio por margen",()=>{
  const result=calculateCostEstimate({quantity:10,filamentLines:[{grams:100,unitCost:.8}],wastePercent:5,printMinutes:120,printerWatts:100,electricityRate:10,machineHourlyRate:20,laborMinutes:30,laborHourlyRate:200,targetMarginPercent:40});
  assert.equal(result.materialCost,84);
  assert.equal(result.electricityCost,2);
  assert.equal(result.machineCost,40);
  assert.equal(result.laborCost,100);
  assert.equal(result.totalCost,226);
  assert.equal(result.unitCost,22.6);
  assert.equal(result.suggestedPrice,376.67);
});

test("calcula costo por gramo y disponibilidad neta",()=>{
  assert.equal(rollCostPerGram({initial_grams:1000,total_cost:850}),.85);
  assert.deepEqual(inventoryStatus({current_grams:200,low_stock_threshold:100},120),{id:"low",label:"Stock bajo",available:80});
});

test("crea una clave estable para sincronización",()=>assert.equal(financeSyncKey("SOL-24"),"ATRY:SOL-24"));
