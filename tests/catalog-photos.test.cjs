const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),box={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'catalog-data.js'),'utf8'),box);
const data=box.window.FG_CATALOG_DATA;
const ctx={window:{FG_CATALOG_DATA:data},defaultProducts:[],products:[],STORAGE_KEYS:{products:'p'},localStorage:{getItem:()=>null,setItem:()=>{}},console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'catalog-runtime.js'),'utf8').split('  const brands=')[0]+'})();',ctx);
assert.equal(data.history.length,19);
const migrated=ctx.window.FGCatalog.merge(data.history);
for(const old of data.history){const current=data.products.find(p=>p.id===old.id),next=migrated.find(p=>p.id===old.id);assert.notEqual(old.img,current.img);assert.ok(current.img);assert.equal(next.img,current.img);assert.equal(next.gallery[0],current.img);assert.equal(next.price,old.price);assert.equal(next.model,old.model);assert.ok(fs.existsSync(path.join(root,current.img)));}
const custom=JSON.parse(JSON.stringify(data.history[0]));custom.img='https://example.com/owner.jpg';custom.gallery=[custom.img];custom.price=123;
const preserved=ctx.window.FGCatalog.merge([custom]).find(p=>p.id===custom.id);
assert.equal(preserved.img,custom.img);assert.equal(preserved.gallery[0],custom.img);assert.equal(preserved.price,123);
const withBaseline=data.history.map(p=>({...p,_catalogBaseline:p}));
for(const next of ctx.window.FGCatalog.merge(withBaseline).filter(p=>data.history.some(h=>h.id===p.id)))assert.ok(next.img);
assert.equal(data.products.filter(p=>!p.img).length,13);
assert.equal(data.products.find(p=>p.modelNeedsConfirmation).img,'');
console.log('PASS: 16 empty photos and 3 promotional photos upgrade with/without baseline; owner photos/prices preserved; unresolved variants remain explicit.');
