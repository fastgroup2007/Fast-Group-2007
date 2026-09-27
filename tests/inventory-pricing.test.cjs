const {test}=require('node:test');
const assert=require('node:assert/strict');
const {resolveInventoryPricing:resolve}=require('../inventory-pricing.js');
const prices={'53KHEFT12DN8-708F':27550,'M1SEFT-24CRN8F-Q8':39660};
test('legacy Carrier cost is dealer minus 3%, not dealer price',()=>{
 const item={name:'53KHEFT12DN8-708F',qty:'2',unitPrice:'26723.5'};
 const before=JSON.stringify(item),result=resolve(item,prices);
 assert.equal(result.dealerPrice,27550);assert.equal(result.priceRate,3);
 assert.equal(JSON.stringify(item),before);
});
test('legacy Midea cost resolves to 4% without changing net cost',()=>{
 const result=resolve({name:'M1SEFT-24CRN8F-Q8',unitPrice:'38073.6'},prices);
 assert.equal(result.dealerPrice,39660);assert.equal(result.priceRate,4);assert.equal(result.unitPrice,38073.6);
});
test('all supported discounts use the same commercial base',()=>{
 for(const rate of [0,3,4,7,8]){
  const amount=Math.round(39660*(1-rate/100)*100)/100;
  assert.equal(resolve({name:'M1SEFT-24CRN8F-Q8',unitPrice:amount},prices).priceRate,rate);
 }
});
test('explicit custom prices are retained; unknown prices are not guessed',()=>{
 assert.equal(resolve({name:'M1SEFT-24CRN8F-Q8',dealerPrice:1000,priceRate:4,unitPrice:960},prices).dealerPrice,1000);
 assert.equal(resolve({name:'M1SEFT-24CRN8F-Q8',unitPrice:12345},prices).basis,'unverified');
 assert.equal(resolve({name:'Unlisted',unitPrice:10},prices).unitPrice,10);
});
