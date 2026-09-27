/* Resolve legacy NET stock prices against the verified 2026-09-08 dealer list.
 * This is a read-only interpretation: it never changes quantities or stored costs.
 */
(function(root){
  const rates=[0,3,4,7,8];
  const number=value=>value===null||value===undefined||value===''?NaN:Number(value);
  const net=(base,rate)=>Math.round(base*(1-rate/100)*100)/100;
  function resolveInventoryPricing(item,priceMap){
    const stored=number(item?.unitPrice??item?.unitCost??item?.cost);
    const unitPrice=Number.isFinite(stored)?stored:0;
    const dealer=number(item?.dealerPrice),rate=number(item?.priceRate);
    if(Number.isFinite(dealer)&&dealer>=0&&rates.includes(rate)&&Math.abs(net(dealer,rate)-unitPrice)<.011)
      return {dealerPrice:dealer,priceRate:rate,unitPrice,basis:'saved'};
    // Only exact model matches and exact cent-level price matches are inferred.
    for(const candidate of [item?.model,item?.name,item?.sku]){
      const model=String(candidate||'').replace(/\s+/g,'').toUpperCase();
      const reference=priceMap[model];
      if(!(reference>0))continue;
      const matched=rates.find(r=>Math.abs(net(reference,r)-unitPrice)<.011);
      if(matched!==undefined)return {dealerPrice:reference,priceRate:matched,unitPrice,basis:'price-list',model};
    }
    return {dealerPrice:unitPrice,priceRate:0,unitPrice,basis:'unverified'};
  }
  root.resolveInventoryPricing=resolveInventoryPricing;
  if(typeof module!=='undefined')module.exports={resolveInventoryPricing};
})(globalThis);
