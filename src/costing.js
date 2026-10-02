const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const rounded = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;

export function rollCostPerGram(roll){
  const grams=number(roll?.initial_grams),cost=number(roll?.total_cost);
  return grams>0?cost/grams:0;
}

export function calculateCostEstimate(input={}){
  const quantity=Math.max(number(input.quantity),1);
  const filamentLines=(input.filamentLines||[]).map(line=>{
    const grams=Math.max(number(line.grams??line.quantity),0);
    const unitCost=Math.max(number(line.unitCost??line.unit_cost),0);
    return {...line,grams,unitCost,subtotal:rounded(grams*unitCost)};
  });
  const consumableLines=(input.consumableLines||[]).map(line=>{
    const lineQuantity=Math.max(number(line.quantity),0),unitCost=Math.max(number(line.unitCost??line.unit_cost),0);
    return {...line,quantity:lineQuantity,unitCost,subtotal:rounded(lineQuantity*unitCost)};
  });
  const rawMaterialCost=filamentLines.reduce((sum,line)=>sum+line.subtotal,0);
  const wastePercent=Math.min(Math.max(number(input.wastePercent),0),100);
  const materialCost=rounded(rawMaterialCost*(1+wastePercent/100));
  const printHours=Math.max(number(input.printMinutes),0)/60;
  const electricityCost=rounded(number(input.printerWatts)/1000*printHours*Math.max(number(input.electricityRate),0));
  const machineCost=rounded(printHours*Math.max(number(input.machineHourlyRate),0));
  const laborCost=rounded(Math.max(number(input.laborMinutes),0)/60*Math.max(number(input.laborHourlyRate),0));
  const designCost=rounded(Math.max(number(input.designMinutes),0)/60*Math.max(number(input.designHourlyRate),0));
  const consumablesCost=rounded(consumableLines.reduce((sum,line)=>sum+line.subtotal,0));
  const packagingCost=rounded(Math.max(number(input.packagingCost),0));
  const otherCost=rounded(Math.max(number(input.otherCost),0));
  const totalCost=rounded(materialCost+electricityCost+machineCost+laborCost+designCost+consumablesCost+packagingCost+otherCost);
  const unitCost=rounded(totalCost/quantity);
  const targetMarginPercent=Math.min(Math.max(number(input.targetMarginPercent),0),95);
  const suggestedPrice=rounded(targetMarginPercent<100?totalCost/(1-targetMarginPercent/100):totalCost);
  return {filamentLines,consumableLines,rawMaterialCost,materialCost,electricityCost,machineCost,laborCost,designCost,consumablesCost,packagingCost,otherCost,totalCost,unitCost,suggestedPrice,targetMarginPercent,wastePercent};
}

export function inventoryStatus(roll,reserved=0){
  const current=Math.max(number(roll?.current_grams),0),available=Math.max(0,current-Math.max(number(reserved),0));
  if(roll?.status==="archived")return {id:"archived",label:"Archivado",available};
  if(current<=0)return {id:"exhausted",label:"Agotado",available:0};
  if(available<=number(roll?.low_stock_threshold))return {id:"low",label:"Stock bajo",available};
  return {id:"available",label:"Disponible",available};
}

export function financeSyncKey(requestId){
  return `ATRY:${String(requestId||"").trim()}`;
}
