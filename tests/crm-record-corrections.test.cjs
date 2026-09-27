const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyCrmRecordCorrections:repair,mergeCrmWithCorrections:mergeRepair}=require('../crm-record-corrections');
const {mergeCrmChanges:merge}=require('../crm-merge');
const controls={retiredRecordIds:{inventory:['old-stock'],technicians:['old-tech']},inventoryPriceResets:{stock:{revision:'commercial-v1',dealerPrice:27550}}};
const stale={inventory:[{id:'stock',qty:'3',unitPrice:'26723.5'},{id:'old-stock',qty:8}],technicians:[{id:'tech'},{id:'old-tech'}],customers:[{id:'customer'}]};
test('retired stock and technicians cannot return from a stale browser',()=>{
 const remote=repair({...stale,...controls});
 const combined=mergeRepair({},stale,remote);
 assert.deepEqual(combined.inventory.map(x=>x.id),['stock']);
 assert.deepEqual(combined.technicians.map(x=>x.id),['tech']);
 assert.equal(combined.inventory[0].unitPrice,'27550');
 assert.equal(combined.inventory[0].qty,'3');
 assert.deepEqual(combined.customers,stale.customers);
 assert.equal(stale.inventory[0].unitPrice,'26723.5');
});
test('a queued stale price cannot undo the commercial reset',()=>{
 const remote=repair({...stale,...controls});
 const pending=structuredClone(stale);pending.inventory[0].unitPrice='25000';
 assert.equal(mergeRepair(stale,pending,remote).inventory[0].unitPrice,'27550');
});
test('explicit subsequent discounts and genuine new records are preserved',()=>{
 const state=repair({...stale,...controls});
 state.inventory[0]={...state.inventory[0],priceRate:7,unitPrice:'25621.5'};
 state.inventory.push({id:'new-stock',qty:1,unitPrice:'100'});state.technicians.push({id:'new-tech'});
 const result=repair(state,state);
 assert.equal(result.inventory[0].priceRate,7);assert.equal(result.inventory[0].unitPrice,'25621.5');
 assert.equal(result.inventory.length,2);assert.equal(result.technicians.length,2);
 assert.deepEqual(repair(result),result);
});
