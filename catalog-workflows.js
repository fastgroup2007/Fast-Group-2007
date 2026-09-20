/* Shared catalog search and dated customer history. */
function unifiedCatalog(){
  const map = new Map(defaultProducts.map(p => [p.model.toUpperCase(), {...p}]));
  products.forEach(p => { if(p.model) map.set(p.model.toUpperCase(), {...map.get(p.model.toUpperCase()), ...p, dealerPrice:p.dealerPrice || DEALER_PRICE_MAP[p.model] || 0}); });
  return [...map.values()];
}
function searchCatalog(query){
  const q = String(query || '').trim().toLowerCase();
  return unifiedCatalog().filter(p => [p.model,p.name,p.brand].join(' ').toLowerCase().includes(q));
}
function deviceCost(p){ return Math.round(Number(p.dealerPrice) * (p.brand === 'Midea' ? .96 : .97) * 100) / 100; }
function yearDeviceCost(p){ return Math.round(Number(p.dealerPrice) * (p.brand === 'Midea' ? .92 : .93) * 100) / 100; }
function deviceCostLabel(p){ return `التجاري: ${formatMoney(p.dealerPrice)} | بعد خصم ${p.brand === 'Midea' ? 4 : 3}%: ${formatMoney(deviceCost(p))} | بعد خصم ${p.brand === 'Midea' ? 8 : 7}%: ${formatMoney(yearDeviceCost(p))}`; }
function enhanceModelInput(input){
  if(input.dataset.catalogReady) return;
  input.dataset.catalogReady = 'true';
  input.autocomplete = 'off';
  input.placeholder = 'ابحث بالموديل مثل KH أو اختر أخرى';
  const box = document.createElement('div');
  box.style.cssText = 'min-width:0;grid-column:1/-1';
  input.replaceWith(box); box.append(input);
  input.style.width = '100%';
  const list = document.createElement('div');
  list.style.cssText = 'max-height:220px;overflow:auto;border:1px solid #64748b;border-radius:12px;background:#0f172a;color:white;margin-top:4px';
  list.hidden = true; box.append(list);
  const show = () => {
    list.replaceChildren(); list.hidden = false;
    const matches = searchCatalog(input.value);
    matches.forEach(p => {
      const b = document.createElement('button'); b.type = 'button';
      b.style.cssText = 'display:block;width:100%;text-align:right;padding:10px;border-bottom:1px solid #334155;overflow-wrap:anywhere';
      b.textContent = `${p.model} — ${p.name} — ${deviceCostLabel(p)}`;
      b.onclick = () => { input.value = p.model; delete input.dataset.custom; applyCatalogChoice(input,p); list.hidden = true; };
      list.append(b);
    });
    const other = document.createElement('button'); other.type = 'button';
    other.textContent = 'أخرى — اكتب صنفًا أو خدمة غير موجودة';
    other.style.cssText = 'padding:12px;width:100%;text-align:right;color:#7dd3fc';
    other.onclick = () => { input.value = ''; input.dataset.custom = 'true'; list.hidden = true; input.placeholder = 'اكتب الصنف أو الخدمة'; input.focus(); list.hidden = true; applyCatalogChoice(input,null); };
    list.append(other);
  };
  input.addEventListener('focus', () => { if(!input.dataset.custom) show(); });
  input.addEventListener('input', () => { delete input.dataset.custom; show(); });
  const reopen=document.createElement('button'); reopen.type='button'; reopen.textContent='اختيار من القائمة'; reopen.style.cssText='padding:4px;color:#0284c7;font-size:12px';
  reopen.onclick=()=>{delete input.dataset.custom;input.value='';show();};box.append(reopen);
  input.addEventListener('keydown', e => { if(e.key === 'Escape') list.hidden = true; if(e.key === 'ArrowDown'){ e.preventDefault(); list.querySelector('button')?.focus(); } });
  box.addEventListener('focusout', () => setTimeout(() => { if(!box.contains(document.activeElement)) list.hidden = true; },0));
}
function applyCatalogChoice(input,p){
  const row = input.closest('.job-line-row,.project-line-row,.prior-job');
  if(row){
    if(p){ row.dataset.dealer = p.dealerPrice; row.dataset.brand = p.brand; row.dataset.model = p.model; }
    else { delete row.dataset.dealer; delete row.dataset.brand; delete row.dataset.model; }
    const price = row.querySelector('.job-line-price,.project-line-price,.prior-sale');
    if(price) price.value = p ? p.price : '';
    let hint = row.querySelector('.device-cost-hint');
    if(!hint){ hint = document.createElement('div'); hint.className = 'device-cost-hint'; row.append(hint); }
    hint.textContent = p ? deviceCostLabel(p) : '';
    if(input.classList.contains('job-line-title')) updateJobLinesTotal();
    if(input.classList.contains('project-line-title')) updateProjectLinesTotal();
  }
  if(input.id === 'inventoryItemName'){
    document.getElementById('inventoryItemUnitPrice').value = p ? deviceCost(p) : '';
    document.getElementById('inventoryItemUnitPrice').dispatchEvent(new Event('input',{bubbles:true}));
    updateInventoryLineTotalPreview();
    let hint = document.getElementById('inventoryCatalogHint');
    if(!hint){ hint = document.createElement('div'); hint.id='inventoryCatalogHint'; input.parentElement.after(hint); }
    hint.textContent = p ? deviceCostLabel(p) : '';
  }
  if(input.id === 'apModel' && p){
    document.getElementById('apBrand').value=p.brand;
    document.getElementById('apName').value=p.name;
    document.getElementById('apPrice').value=p.price;
    ['Hp','Type','Category','Cooling','Refrigerant','Area','Img'].forEach(k => { const el=document.getElementById('ap'+k); if(el) el.value=p[k[0].toLowerCase()+k.slice(1)] || ''; });
  }
  if(input.id === 'crmPurchaseItem'){
    document.getElementById('crmPurchaseModel').value = p ? p.model : '';
    document.getElementById('crmPurchaseDealerPrice').value = p ? p.dealerPrice : '';
    document.getElementById('crmPurchaseAmount').value = p ? p.price : '';
    updatePurchaseProfitPreview();
  }
}
const baseCollectJobLines = collectJobLines;
collectJobLines = function(){
  return baseCollectJobLines().map((line,i) => {
    const row=document.querySelectorAll('#jobLinesBuilder .job-line-row')[i];
    if(row?.dataset.model === line.title){
      return {...line, model:line.title, brand:row.dataset.brand, dealerPrice:Number(row.dataset.dealer), deviceCost:deviceCost({brand:row.dataset.brand,dealerPrice:row.dataset.dealer})};
    }
    return line;
  });
};
const baseJobCost = jobDirectCost;
jobDirectCost = job => baseJobCost(job) + (job?.lines || []).reduce((s,l)=>s+moneyValue(l.deviceCost)*moneyValue(l.qty),0);
const baseProfitPreview = updateJobProfitPreview;
updateJobProfitPreview = function(){
  baseProfitPreview();
  const deviceTotal=collectJobLines().reduce((s,l)=>s+moneyValue(l.deviceCost)*moneyValue(l.qty),0);
  const el=document.getElementById('crmJobProfitPreview');
  if(el) el.textContent=`تكلفة الأجهزة: ${formatMoney(deviceTotal)} | صافي الشغلانة: ${formatMoney(moneyValue(document.getElementById('crmJobRevenue').value)-deviceTotal-moneyValue(document.getElementById('crmJobMaterialCost').value)-moneyValue(document.getElementById('crmJobLaborCost').value)-moneyValue(document.getElementById('crmJobOtherCost').value))}`;
};
const baseAddJobLine=addJobLine;
addJobLine=function(line={}){
  baseAddJobLine(line);
  const row=document.querySelector('#jobLinesBuilder .job-line-row:last-child');
  if(row && line.model){
    row.dataset.model=line.model; row.dataset.brand=line.brand; row.dataset.dealer=line.dealerPrice;
    const hint=document.createElement('div');hint.className='device-cost-hint';hint.textContent=deviceCostLabel(line);row.append(hint);
  }
  enhanceAllCatalogFields(); updateJobProfitPreview();
};
function addPriorJob(){
  const row=document.createElement('div'); row.className='prior-job';
  row.style.cssText='display:grid;gap:10px;padding:12px;border:1px solid #64748b;border-radius:14px;margin-top:10px';
  row.innerHTML=`<label>تاريخ التنفيذ <input class="prior-date" type="date" required></label><select class="prior-type"><option>تركيب</option><option>صيانة</option><option>معاينة</option><option>بيع جهاز</option><option>أخرى</option></select><input class="prior-custom" placeholder="اكتب نوع الخدمة" hidden><input class="prior-model" placeholder="الجهاز / الخدمة"><label>العدد <input class="prior-qty" type="number" min="1" value="1"></label><label>سعر البيع للوحدة <input class="prior-sale" type="number" min="0" step="0.01" value="0"></label><textarea class="prior-report" placeholder="الفني الذي زار العميل وتفاصيل الشغل السابق"></textarea><button type="button">حذف هذا السجل</button>`;
  row.querySelector('button').onclick=()=>row.remove();
  row.querySelector('select').onchange=e=>{ row.querySelector('.prior-custom').hidden=e.target.value!=='أخرى'; };
  row.querySelectorAll('input,select,textarea').forEach(el=>{ el.style.cssText='width:100%;padding:10px;border-radius:10px;background:#0f172a;color:white;border:1px solid #64748b'; });
  document.getElementById('priorJobsBuilder').append(row); enhanceModelInput(row.querySelector('.prior-model'));
}
function collectPriorJobs(customerId){
  return [...document.querySelectorAll('.prior-job')].map(row=>{
    const get=s=>row.querySelector(s).value.trim();
    const date=get('.prior-date'), title=get('.prior-model');
    const type=get('.prior-type')==='أخرى'?get('.prior-custom'):get('.prior-type');
    const qty=Number(get('.prior-qty')), price=Number(get('.prior-sale'));
    if(!date || !title || !type || !(qty>=1) || !(price>=0)) throw new Error('أكمل تاريخ ونوع وتفاصيل الشغل السابق والعدد والسعر');
    const isDevice=row.dataset.model===title;
    const line={title,qty,unitPrice:price,total:qty*price};
    if(isDevice) Object.assign(line,{model:title,brand:row.dataset.brand,dealerPrice:Number(row.dataset.dealer),deviceCost:deviceCost({brand:row.dataset.brand,dealerPrice:row.dataset.dealer})});
    return {id:crmId('job'),customerId,title,type,dueDate:date,completedAt:date+'T12:00:00',historical:true,status:'تم التنفيذ',technicianId:'',assistants:[],lines:[line],revenue:qty*price,materialCost:0,laborCost:0,otherCost:0,report:get('.prior-report'),createdAt:new Date().toISOString()};
  });
}
function enhanceAllCatalogFields(){
  document.querySelectorAll('#inventoryItemName,#apModel,#crmPurchaseItem,.job-line-title,.project-line-title').forEach(enhanceModelInput);
  const select=document.getElementById('crmPurchaseModel'); if(select) select.hidden=false;
}
const historyBox=document.createElement('div');
historyBox.innerHTML='<details><summary style="cursor:pointer;padding:12px">إضافة شغل سابق للعميل (اختياري)</summary><div id="priorJobsBuilder"></div><button type="button" onclick="addPriorJob()" style="padding:12px;color:#38bdf8">+ إضافة زيارة / جهاز / خدمة سابقة</button></details>';
document.getElementById('crmCustomerNotes').after(historyBox);
const baseResetCustomer=resetCustomerForm;
resetCustomerForm=function(){baseResetCustomer(); document.getElementById('priorJobsBuilder').replaceChildren();};
const baseFillCustomer=fillCustomerForm;
fillCustomerForm=function(id){document.getElementById('priorJobsBuilder').replaceChildren();baseFillCustomer(id);};
const typeSelect=document.getElementById('crmJobType'), customType=document.getElementById('crmJobCustomType');
typeSelect.addEventListener('change',()=>{customType.hidden=typeSelect.value!=='أخرى';if(customType.hidden) customType.value='';});
customType.hidden=typeSelect.value!=='أخرى';
const baseFillJob=fillJobForm;
fillJobForm=function(id){baseFillJob(id);const j=crmJobById(id);if(j && canAccessJobRecord(j)){if(customType.value) typeSelect.value='أخرى';customType.hidden=typeSelect.value!=='أخرى';}};
const style=document.createElement('style');style.textContent='.job-line-row>div:first-child,.project-line-row>div:first-child{grid-template-columns:minmax(0,1fr) 72px 110px 36px}.device-cost-hint{font-size:13px;color:#0284c7}@media(max-width:600px){.job-line-row>div:first-child,.project-line-row>div:first-child{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 36px}}';document.head.append(style);
new MutationObserver(()=>enhanceAllCatalogFields()).observe(document.getElementById('adminPanel'),{childList:true,subtree:true});
enhanceAllCatalogFields();

function collectExtraJobCosts(){
  return [...document.querySelectorAll('.extra-job-cost')].map(row=>({name:row.querySelector('input[type=text]').value.trim(),amount:Number(row.querySelector('input[type=number]').value)})).filter(x=>x.name || x.amount);
}
function addExtraJobCost(value={}){
  const row=document.createElement('div');row.className='extra-job-cost';row.style.cssText='display:flex;gap:8px;margin:8px 0;flex-wrap:wrap';
  const name=document.createElement('input');name.type='text';name.placeholder='اسم المصروف: ونش، نقل، مواسير…';name.value=value.name||'';
  const amount=document.createElement('input');amount.type='number';amount.min='0';amount.step='.01';amount.placeholder='القيمة';amount.value=value.amount??'';
  for(const el of [name,amount]){el.style.cssText='flex:1;min-width:100px;padding:10px;border:1px solid #64748b;border-radius:10px;background:transparent';el.oninput=()=>updateJobProfitPreview();row.append(el);}
  const remove=document.createElement('button');remove.type='button';remove.textContent='حذف';remove.onclick=()=>{row.remove();updateJobProfitPreview();};row.append(remove);
  document.getElementById('extraJobCosts').append(row);
}
const extraBox=document.createElement('div');extraBox.innerHTML='<div id="extraJobCosts"></div><button type="button" onclick="addExtraJobCost()" style="padding:10px;color:#0284c7">+ إضافة خانة مصروف</button>';
document.getElementById('crmJobProfitPreview').before(extraBox);
const beforeExtraCost=jobDirectCost;
jobDirectCost=job=>beforeExtraCost(job)+(job?.extraCosts||[]).reduce((sum,c)=>sum+moneyValue(c.amount),0);
const beforeExtraPreview=updateJobProfitPreview;
updateJobProfitPreview=function(){
  beforeExtraPreview();
  const extra=collectExtraJobCosts().reduce((s,x)=>s+moneyValue(x.amount),0);
  const lines=collectJobLines();
  const cost=lines.reduce((s,l)=>s+moneyValue(l.deviceCost)*moneyValue(l.qty),0);
  const yearly=lines.reduce((s,l)=>s+(l.model?yearDeviceCost(l):0)*moneyValue(l.qty),0);
  const overhead=extra+moneyValue(document.getElementById('crmJobMaterialCost').value)+moneyValue(document.getElementById('crmJobLaborCost').value)+moneyValue(document.getElementById('crmJobOtherCost').value);
  const revenue=moneyValue(document.getElementById('crmJobRevenue').value);
  document.getElementById('crmJobProfitPreview').textContent=`تكلفة الأجهزة الحالية: ${formatMoney(cost)} | تكلفة آخر السنة: ${formatMoney(yearly)} | المصروفات: ${formatMoney(overhead)} | صافي حالي: ${formatMoney(revenue-cost-overhead)} | صافي آخر السنة: ${formatMoney(revenue-yearly-overhead)}`;
};
const beforeExtraReset=resetJobForm;
resetJobForm=function(){document.getElementById('extraJobCosts').replaceChildren();beforeExtraReset();};
const beforeExtraFill=fillJobForm;
fillJobForm=function(id){
  if(!canAccessAdmin('jobs') || !canAccessJobRecord(crmJobById(id))) return;
  document.getElementById('extraJobCosts').replaceChildren();
  (crmJobById(id)?.extraCosts||[]).forEach(addExtraJobCost);beforeExtraFill(id);updateJobProfitPreview();
};
const beforeExtraSave=saveJob;
saveJob=async function(){
  if(collectExtraJobCosts().some(x=>!x.name || !Number.isFinite(x.amount) || x.amount<0)){toast('اكتب اسم كل مصروف وقيمة صحيحة غير سالبة');return;}
  return beforeExtraSave();
};

function installOtherChoice(select){
  if(select.dataset.openChoice) return;
  select.dataset.openChoice='true';
  let option=[...select.options].find(o=>o.value==='أخرى');
  if(!option){option=new Option('أخرى — كتابة حرة','أخرى');select.add(option);}
  const input=document.createElement('input');input.placeholder='اكتب الاختيار الآخر';input.className=select.className;input.hidden=true;select.after(input);
  let freeOption=null;
  select.addEventListener('change',()=>{input.hidden=select.value!=='أخرى' && select.selectedOptions[0]!==freeOption;if(!input.hidden)input.focus();});
  input.addEventListener('input',()=>{
    if(!freeOption){freeOption=new Option();select.add(freeOption);}
    freeOption.textContent=input.value.trim()||'أخرى';freeOption.value=input.value.trim()||'أخرى';select.value=freeOption.value;
  });
}
function enhanceOtherChoices(){
  document.querySelectorAll('#apBrand,#apType,#apCategory,#crmCustomerStatus,#crmJobStatus,#crmTechRole,#crmTechStatus,#projectStatus,#crmPurchasePayment').forEach(installOtherChoice);
}
enhanceOtherChoices();
new MutationObserver(enhanceOtherChoices).observe(document.getElementById('adminPanel'),{childList:true,subtree:true});

function restoreOpenChoices(record, fields){
  if(!record) return;
  Object.entries(fields).forEach(([id,key])=>{
    const select=document.getElementById(id), value=record[key];
    if(select && value && ![...select.options].some(o=>o.value===value)) select.add(new Option(value,value));
  });
}
const openFillAdmin=fillAdminForm;
fillAdminForm=function(id){restoreOpenChoices(products.find(p=>p.id===id),{apBrand:'brand',apType:'type',apCategory:'category'});openFillAdmin(id);};
const openFillCustomer=fillCustomerForm;
fillCustomerForm=function(id){restoreOpenChoices(crmCustomerById(id),{crmCustomerStatus:'status'});openFillCustomer(id);};
const openFillJob=fillJobForm;
fillJobForm=function(id){restoreOpenChoices(crmJobById(id),{crmJobStatus:'status'});openFillJob(id);};
const openFillTech=fillTechForm;
fillTechForm=function(id){restoreOpenChoices(crmTechById(id),{crmTechRole:'role',crmTechStatus:'status'});openFillTech(id);};
const openFillProject=fillProjectForm;
fillProjectForm=function(id){restoreOpenChoices(crmProjectById(id),{projectStatus:'status'});openFillProject(id);};
