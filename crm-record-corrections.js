/* Server-recorded repairs survive old browser snapshots and queued writes.
 * Price resets apply once per record; later explicit discount choices remain valid.
 */
(function(root){
  function applyCrmRecordCorrections(input={},authority=input){
    const state={...input};
    const retired={...input.retiredRecordIds,...authority.retiredRecordIds};
    for(const collection of ['inventory','technicians']){
      const ids=new Set([...(input.retiredRecordIds?.[collection]||[]),...(authority.retiredRecordIds?.[collection]||[])]);
      if(ids.size){retired[collection]=[...ids];state[collection]=(state[collection]||[]).filter(x=>!ids.has(x.id));}
    }
    if(Object.keys(retired).length)state.retiredRecordIds=retired;
    const resets={...input.inventoryPriceResets,...authority.inventoryPriceResets};
    if(Object.keys(resets).length){
      state.inventoryPriceResets=resets;
      state.inventory=(state.inventory||[]).map(item=>{
        const reset=resets[item.id];
        if(!reset||item.pricingRevision===reset.revision)return item;
        return {...item,dealerPrice:reset.dealerPrice,priceRate:0,
          unitPrice:String(reset.dealerPrice),unitCost:String(reset.dealerPrice),cost:String(reset.dealerPrice),pricingRevision:reset.revision};
      });
    }
    return state;
  }
  root.applyCrmRecordCorrections=applyCrmRecordCorrections;
  function mergeCrmWithCorrections(base,local,remote){
    // Repair BEFORE merging: otherwise a stale price can inherit the remote
    // revision marker and look like a deliberate post-repair edit.
    return applyCrmRecordCorrections(root.mergeCrmChanges(
      applyCrmRecordCorrections(base,remote),applyCrmRecordCorrections(local,remote),remote),remote);
  }
  root.mergeCrmWithCorrections=mergeCrmWithCorrections;
  if(typeof module!=='undefined')module.exports={applyCrmRecordCorrections,mergeCrmWithCorrections};
})(globalThis);
