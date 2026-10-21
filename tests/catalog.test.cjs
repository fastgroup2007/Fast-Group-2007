const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const read=f=>JSON.parse(fs.readFileSync(__dirname+'/'+f,'utf8'));
const dataContext={window:{}};vm.runInNewContext(fs.readFileSync(__dirname+'/../catalog-data.js','utf8'),dataContext);const {products:updated,legacy}=dataContext.window.FG_CATALOG_DATA;const h=fs.readFileSync(__dirname+'/../index.html','utf8');const start=h.indexOf('const images ='),end=h.indexOf('const defaultProducts =');const published=JSON.parse(vm.runInNewContext(h.slice(start,h.indexOf(';',end)+1)+';JSON.stringify(defaultProducts)',{structuredClone}));
function create(original=published){const store=new Map();const context={window:{FG_CATALOG_DATA:{products:updated,legacy}},defaultProducts:structuredClone(original),products:[],STORAGE_KEYS:{products:'products'},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console,normalizeProductsList:()=>{},loadProducts:()=>{}};vm.createContext(context);const src=fs.readFileSync(__dirname+'/../catalog-runtime.js','utf8').split('  const brands=')[0]+'})();';vm.runInContext(src,context);return {api:context.window.FGCatalog,context,store};}
const {api,context,store}=create();
assert.equal(api.defaults.length,published.length+updated.length);
const a=updated.find(p=>p.model==='AH-A12ZSE'),old=legacy.find(p=>p.id===a.id);
const saved=structuredClone(legacy);saved.find(p=>p.id===a.id).price=12345;saved.find(p=>p.id===a.id).img='https://example.com/custom.jpg';
saved.push({id:'custom',brand:'Custom',model:'custom model',price:444,hp:2});
const merged=api.merge(saved),corrected=merged.find(p=>p.id===a.id);
assert.equal(corrected.price,12345);assert.equal(corrected.img,'https://example.com/custom.jpg');assert.deepEqual(Array.from(corrected.gallery),['https://example.com/custom.jpg']);assert.equal(corrected.color,a.color);assert.ok(merged.find(p=>p.id==='custom'));
assert.equal(new Set(merged.map(p=>p.id)).size,merged.length);
assert.equal(JSON.stringify(api.merge(merged)),JSON.stringify(merged),'second migration must be stable');
const customModel=structuredClone(old);customModel.model='OWNER-REPLACEMENT';customModel.img='https://example.com/owner-model.jpg';const customResult=api.merge([customModel]);assert.equal(customResult.find(p=>p.id===old.id).img,customModel.img);assert.equal(customResult.filter(p=>p.id===old.id).length,1);
api.recordDelete(corrected);assert.ok(!api.merge(merged.filter(p=>p.id!==a.id)).find(p=>p.id===a.id),'deleted catalog models stay deleted');
store.set('products','broken JSON');api.load();assert.equal(store.get('products'),'broken JSON','invalid storage retained');
store.set('products','{}');api.load();assert.equal(store.get('products'),'{}','invalid shape retained');
store.set('products',JSON.stringify(saved));api.load();assert.equal(store.get('fg_products_before_catalog_20261021'),JSON.stringify(saved));
const newGas=updated.filter(p=>!p.refrigerant||p.refrigerant.includes('غير مذكور'));assert.equal(newGas.length,0);
for(const p of updated){if(p.img){assert.ok(p.photoSource&&p.photoModel,p.model);assert.ok(fs.existsSync(__dirname+'/../'+p.img),p.model);}if(p.color==='أحمر')assert.match(p.photoModel,/YHER$/);}
const colorModels=updated.filter(p=>p.priceKind==='request');assert.equal(colorModels.length,8);assert.ok(colorModels.every(p=>p.price===null&&p.img));
const ambiguous=updated.find(p=>p.modelNeedsConfirmation);assert.equal(ambiguous.img,'');
const freshDuplicates=updated.filter(p=>p.model.startsWith('SFW24H'));assert.equal(freshDuplicates.length,2);assert.notEqual(freshDuplicates[0].hp,freshDuplicates[1].hp);
console.log('PASS: legacy/custom edits, image edits, duplicate protection, repeat migration, tombstones, corrupt storage, backup, source linkage and exact Sharp colors.');
