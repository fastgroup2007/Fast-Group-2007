const {test}=require('node:test');const assert=require('node:assert/strict');
const {actualVisitDate,customerVisits,inventoryHorsepower,filterInventoryCapacity}=require('../crm-history.js');
test('visit history never substitutes scheduled or modified dates',()=>{
 const jobs=[{id:1,customerId:'c',status:'تم التنفيذ',completedAt:'2026-08-12T12:00:00',updatedAt:'2026-10-16'}, {id:2,customerId:'c',status:'مطلوب',dueDate:'2027-01-01'}, {id:3,customerId:'c',status:'تم التنفيذ',visitDate:'2026-09-05',completedAt:'2026-10-16T12:00:00'}, {id:4,customerId:'c',status:'تم التنفيذ',dueDate:'2027-01-01'}];
 assert.deepEqual(customerVisits(jobs,'c').map(j=>j.id),[3,1,4]);assert.equal(actualVisitDate(jobs[1]),'');assert.equal(actualVisitDate(jobs[3]),'');assert.equal(actualVisitDate(jobs[2]),'2026-09-05');
});
test('capacity filter groups model codes, sorts a copy, combines search, keeps unknown last',()=>{
 const rows=[{name:'M1SEFT-24CRN8F-Q8'}, {name:'53KHEFT12DN8-708F'}, {name:'MSAF-18HRN'}, {name:'unknown',sku:'123456'}, {name:'53KHCT60'}];const original=JSON.stringify(rows);
 assert.deepEqual(filterInventoryCapacity(rows).map(inventoryHorsepower),[1.5,2.25,3,7.5,null]);assert.equal(filterInventoryCapacity(rows,'','1.5').length,1);assert.equal(filterInventoryCapacity(rows,'M1','1.5').length,0);assert.equal(filterInventoryCapacity(rows,'','unknown').length,1);assert.equal(JSON.stringify(rows),original);
});
