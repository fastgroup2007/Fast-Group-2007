/* Additive CRM workflows; existing keys, IDs, prices and attachment formats remain valid. */
const selectedAssetFiles=new WeakMap();
function assetList(value){return (Array.isArray(value)?value:value?[value]:[]).filter(Boolean);}
async function storedAssetsFromInput(input,existing){
  const assets=assetList(existing).slice();
  const files=selectedAssetFiles.get(input)||Array.from(input?.files||[]);
  for(const file of files){
    const asset=await storedAssetFromFile(file);
    if(asset && !assets.some(x=>x.data===asset.data)) assets.push(asset);
  }
  return assets;
}
function clearSelectedAssets(...ids){
  for(const id of ids){const el=document.getElementById(id);if(el){el.value='';selectedAssetFiles.delete(el);el.parentElement.querySelector('.attachment-count')?.remove();}}
}
const renderSingleStoredAsset=renderStoredAsset;
renderStoredAsset=function(asset,label){return assetList(asset).map((a,i)=>renderSingleStoredAsset(a,`${label} ${i+1}`)).join('');};
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.type!=='file'||!input.multiple||!input.closest('#adminPanel')) return;
  const files=selectedAssetFiles.get(input)||[];
  for(const file of input.files) if(!files.some(x=>x.name===file.name && x.size===file.size && x.lastModified===file.lastModified)) files.push(file);
  selectedAssetFiles.set(input,files);
  let count=input.parentElement.querySelector('.attachment-count');
  if(!count){count=document.createElement('span');count.className='attachment-count';input.after(count);}
  count.textContent=` — ${files.length} ملف للإضافة (يمكن اختيار المزيد)`;
});
for(const name of ['Customer','Job']){
  const ids=name==='Customer'?['crmCustomerIdCard','crmCustomerTaxInvoice']:['crmJobBeforePhoto','crmJobAfterPhoto'];
  const reset=window[`reset${name}Form`],fill=window[`fill${name}Form`];
  window[`reset${name}Form`]=function(...args){clearSelectedAssets(...ids);return reset(...args);};
  window[`fill${name}Form`]=function(...args){clearSelectedAssets(...ids);return fill(...args);};
}
// Keep forms available on failures, and prevent double taps from making duplicate records.
for(const name of ['saveCustomer','saveJob','savePurchase','saveInventoryItem','saveExpense','deleteExpense','deleteInventoryItem','clearInventory','deleteStockMove','saveProject','deleteProject','saveTechnician','deleteCustomer','deleteTechnician','seedCrmDemo']){
  const original=window[name];let busy=false;
  window[name]=async function(...args){
    if(busy) return;
    busy=true;const before=cloneForCloud(crmData);
    const buttons=[...document.querySelectorAll(`[onclick="${name}()"]`)];buttons.forEach(b=>b.disabled=true);
    try{return await original(...args);}catch(error){
      crmData=before;
      toast(error?.message||'تعذر الحفظ؛ البيانات في النموذج، أعد المحاولة');
      showSyncState('لم يكتمل الحفظ — احتفظ بالنموذج وأعد المحاولة');
    }finally{busy=false;buttons.forEach(b=>b.disabled=false);}
  };
}
const previousCanAccessAdmin=canAccessAdmin;
canAccessAdmin=function(permission){return previousCanAccessAdmin(({completed:'jobs',receipts:'inventory'})[permission]||permission);};
function installCrmView(key,title,permission,content){
  const tab=document.querySelector(`[data-admin-view-tab="${permission}"]`);
  const button=document.createElement('button');button.className=tab.className;button.dataset.adminViewTab=key;button.textContent=title;button.onclick=()=>switchAdminView(key);tab.after(button);
  const view=document.createElement('section');view.className='admin-view hidden flex-1 overflow-y-auto admin-scroll p-5 fg-upgrade';view.dataset.adminView=key;view.innerHTML=content;
  document.querySelector('[data-admin-view="inventory"]').after(view);
}
const rangeFields=prefix=>`<div class="fg-filters"><label>من تاريخ <input type="date" id="${prefix}From" onchange="renderCrm()"></label><label>إلى تاريخ <input type="date" id="${prefix}To" onchange="renderCrm()"></label><label>بحث <input id="${prefix}Search" type="search" oninput="renderCrm()" placeholder="اسم العميل / الشغل / الفني"></label><button type="button" onclick="clearCrmRange('${prefix}')">كل التواريخ</button></div>`;
installCrmView('completed','الشغل المنفذ','jobs',`<h2>الشغل المنفذ</h2><p>سجل الشغل المكتمل حسب تاريخ التنفيذ، مع الاحتفاظ بملف العميل والفني.</p>${rangeFields('completed')}<div id="completedJobsList" class="fg-records"></div>`);
function clearCrmRange(prefix){['From','To','Search'].forEach(s=>document.getElementById(prefix+s).value='');renderCrm();}
function inCrmRange(date,prefix){
  const from=document.getElementById(prefix+'From')?.value,to=document.getElementById(prefix+'To')?.value;
  return (!from||date>=from)&&(!to||date<=to);
}
function jobCard(job,done){
  const customer=crmCustomerById(job.customerId);
  return `<article class="fg-record"><h3>${escapeHtml(job.title||'شغل')}</h3><p>${escapeHtml(customer?.name||'عميل غير محدد')} — ${escapeHtml(crmTeamNames(job).join('، ')||'الفني يُحدد لاحقًا')}</p><p>${escapeHtml(job.status)} · ${escapeHtml(done?jobAccountingDate(job):job.dueDate||'بدون موعد')}</p><p>${escapeHtml(job.report||job.description||'')}</p><div class="fg-actions"><button onclick="fillJobForm('${escapeJs(job.id)}')">فتح / تعديل الشغل</button>${done?`<button onclick="reopenJob('${escapeJs(job.id)}')">إرجاع للشغل المطلوب</button>`:`<button class="fg-primary" onclick="completeJob('${escapeJs(job.id)}')">✓ تم التنفيذ</button>`}</div></article>`;
}
function jobMatches(job,query){return [job.title,job.type,crmCustomerById(job.customerId)?.name,crmCustomerById(job.customerId)?.phone,...crmTeamNames(job)].join(' ').toLowerCase().includes(query);}
renderJobs=function(){
  const q=document.getElementById('crmJobSearch')?.value.trim().toLowerCase()||'';
  const filter=document.getElementById('crmJobFilter')?.value||'all';
  const list=crmData.jobs.filter(j=>j.status!=='تم التنفيذ'&&canAccessJobRecord(j)&&jobMatches(j,q)&&(filter==='all'||j.status===filter)&&(!todayFilterActive||j.dueDate===crmDate()||j.status==='جاري التنفيذ')&&inCrmRange(j.dueDate||'','required'));
  document.getElementById('crmJobsList').innerHTML=list.map(j=>jobCard(j,false)).join('')||'<p>لا يوجد شغل مطلوب مطابق.</p>';
};
function renderCompletedJobs(){
  if(!canAccessAdmin('jobs')) return;
  const q=document.getElementById('completedSearch').value.trim().toLowerCase();
  const list=crmData.jobs.filter(j=>j.status==='تم التنفيذ'&&canAccessJobRecord(j)&&jobMatches(j,q)&&inCrmRange(jobAccountingDate(j),'completed')).sort((a,b)=>jobAccountingDate(b).localeCompare(jobAccountingDate(a)));
  document.getElementById('completedJobsList').innerHTML=`<p>${list.length} شغلانة منفذة</p>`+list.map(j=>jobCard(j,true)).join('');
}
async function completeJob(id){
  if(!requireAdminAccess('jobs')) return;
  const job=crmJobById(id);if(!job||!canAccessJobRecord(job)||job.status==='تم التنفيذ') return;
  if(!job.technicianId&&!job.technicianName){fillJobForm(id);toast('حدد الفني الذي نفذ الشغل ثم اختر حالة تم التنفيذ واحفظ');return;}
  const before={...job};job.status='تم التنفيذ';job.completedAt=new Date().toISOString();job.updatedAt=job.completedAt;
  try{await saveCrmData();renderCrm();toast('تم النقل إلى الشغل المنفذ');}catch{Object.assign(job,before);toast('تعذر حفظ التنفيذ؛ حاول مرة أخرى');}
}
async function reopenJob(id){
  if(!requireAdminAccess('jobs')) return;
  const job=crmJobById(id);if(!job||!canAccessJobRecord(job)) return;
  const before={...job};job.lastCompletedAt=job.completedAt;job.completedAt='';job.status='مطلوب';job.updatedAt=new Date().toISOString();
  try{await saveCrmData();renderCrm();toast('تم إرجاع الشغل للمطلوب');}catch{Object.assign(job,before);toast('تعذر الحفظ');}
}
const requiredRange=document.createElement('div');requiredRange.className='fg-upgrade';requiredRange.innerHTML='<div class="fg-filters"><label>موعد الشغل من <input id="requiredFrom" type="date" onchange="renderJobs()"></label><label>إلى <input id="requiredTo" type="date" onchange="renderJobs()"></label></div>';
document.getElementById('crmJobsList').before(requiredRange);
document.querySelector('#crmJobFilter option[value="تم التنفيذ"]')?.remove();

const priceOptions='<option value="0">السعر التجاري</option>'+[3,4,7,8].map(x=>`<option value="${x}">خصم ${x}% من التجاري</option>`).join('');
const priceField=document.getElementById('inventoryItemUnitPrice');
const priceMode=document.createElement('label');priceMode.className='fg-upgrade';priceMode.innerHTML=`طريقة حساب السعر<select id="inventoryPriceRate" onchange="updateInventoryLineTotalPreview()">${priceOptions}</select><small>الخانة أعلاه هي السعر التجاري. الأصناف القديمة تحتفظ بسعرها حتى تعدّلها.</small>`;priceField.after(priceMode);
priceField.placeholder='السعر التجاري للوحدة';
function discountedInventoryPrice(base,rate){return Math.round(Number(base)*(1-Number(rate)/100)*100)/100;}
updateInventoryLineTotalPreview=function(){
  const qty=moneyValue(document.getElementById('inventoryItemQty')?.value),base=moneyValue(priceField.value),rate=Number(document.getElementById('inventoryPriceRate').value);
  const price=discountedInventoryPrice(base,rate);setText('inventoryLineTotalPreview',`سعر الوحدة: ${formatMoney(price)} | الإجمالي: ${formatMoney(qty*price)}`);
};
const beforeFillInventory=fillInventoryItemForm,beforeResetInventory=resetInventoryItemForm;
fillInventoryItemForm=function(id){beforeFillInventory(id);const item=inventoryItemById(id);if(!item||!canAccessAdmin('inventory'))return;priceField.value=item.dealerPrice??inventoryUnitPrice(item);document.getElementById('inventoryPriceRate').value=String(item.priceRate||0);updateInventoryLineTotalPreview();};
resetInventoryItemForm=function(){document.getElementById('inventoryPriceRate').value='0';beforeResetInventory();};
// Calculate at the source form save, leaving all untouched stock prices intact.
const beforeInventoryPriceSave=saveInventoryItem;
saveInventoryItem=async function(){
  const base=Number(priceField.value),rate=Number(document.getElementById('inventoryPriceRate').value);
  if(!Number.isFinite(base)||base<0||![0,3,4,7,8].includes(rate)){toast('اكتب سعرًا صحيحًا');return;}
  inventoryPriceDraft={dealerPrice:base,priceRate:rate};
  try{return await beforeInventoryPriceSave();}finally{inventoryPriceDraft=null;}
};
let inventoryPriceDraft=null;
const beforeUpgradeCatalogChoice=applyCatalogChoice;
applyCatalogChoice=function(input,product){
  beforeUpgradeCatalogChoice(input,product);
  if(input.id==='inventoryItemName'){
    priceField.value=product?product.dealerPrice:'';
    updateInventoryLineTotalPreview();
  }
  if(input.id==='receiptModel'&&product){document.getElementById('receiptPrice').value=product.dealerPrice||0;}
};

installCrmView('receipts','وارد الأجهزة','inventory',`<h2>وارد الأجهزة</h2><p>سجّل كل جهاز وارد بالسيريال وتاريخ الاستلام. الحفظ يضيف جهازًا واحدًا لرصيد الصنف مرة واحدة.</p><form id="receiptForm" class="fg-receipt-form"><label>تاريخ الاستلام<input id="receiptDate" type="date" required></label><label>الصنف في المخزن<select id="receiptItem"><option value="">صنف جديد</option></select></label><label>اسم الجهاز / الموديل<input id="receiptModel" required></label><label>السيريال<input id="receiptSerial" required dir="ltr" autocomplete="off"></label><label>السعر التجاري للوحدة<input id="receiptPrice" type="number" min="0" step=".01" value="0" required></label><label>طريقة التسعير<select id="receiptRate">${priceOptions}</select></label><label>صور الجهاز / السيريال<input id="receiptPhotos" type="file" accept="image/*" multiple></label><button id="receiptReadSerial" type="button" onclick="readReceiptSerial()">قراءة السيريال من الصورة</button><p id="receiptOcrStatus" role="status">راجع السيريال والموديل قبل الحفظ.</p><label>ملاحظات<textarea id="receiptNotes"></textarea></label><button id="receiptSave" type="submit" class="fg-primary">حفظ الوارد وإضافته للمخزن</button></form>${rangeFields('receipts')}<div id="receiptList" class="fg-records"></div>`);
document.getElementById('receiptDate').value=crmDate();
enhanceModelInput(document.getElementById('receiptModel'));
document.getElementById('receiptForm').addEventListener('submit',e=>{e.preventDefault();saveReceipt();});
document.getElementById('receiptItem').addEventListener('change',e=>{
  const item=inventoryItemById(e.target.value);if(!item)return;
  document.getElementById('receiptModel').value=item.name;document.getElementById('receiptPrice').value=item.dealerPrice??inventoryUnitPrice(item);document.getElementById('receiptRate').value=String(item.priceRate||0);
});
function renderReceipts(){
  if(!canAccessAdmin('inventory'))return;
  const select=document.getElementById('receiptItem'),selected=select.value;
  select.innerHTML='<option value="">صنف جديد</option>'+(crmData.inventory||[]).map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`).join('');if([...select.options].some(o=>o.value===selected))select.value=selected;
  const q=document.getElementById('receiptsSearch').value.trim().toLowerCase();
  const list=(crmData.receipts||[]).filter(r=>inCrmRange(r.date,'receipts')&&[r.model,r.serial,r.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('receiptList').innerHTML=`<p>${list.length} جهاز وارد</p>`+list.map(r=>`<article class="fg-record"><h3>${escapeHtml(r.model)}</h3><p>${escapeHtml(r.date)}</p><p dir="ltr">${escapeHtml(r.serial)}</p><p>${escapeHtml(r.notes||'')}</p><div class="fg-photos">${renderStoredAsset(r.photos,'الجهاز / السيريال')}</div></article>`).join('');
}
let receiptBusy=false;
async function saveReceipt(){
  if(receiptBusy||!requireAdminAccess('inventory'))return;
  const get=id=>document.getElementById(id).value.trim();
  const serial=get('receiptSerial').toUpperCase(),model=get('receiptModel'),date=get('receiptDate'),base=Number(get('receiptPrice')),rate=Number(get('receiptRate'));
  if(!serial||!model||!date||!Number.isFinite(base)||base<0){toast('أكمل التاريخ والموديل والسيريال والسعر الصحيح');return;}
  if((crmData.receipts||[]).some(r=>r.serial.toUpperCase()===serial)){toast('السيريال مسجل بالفعل؛ لم تتم زيادة المخزن');return;}
  receiptBusy=true;document.getElementById('receiptSave').disabled=true;const before=cloneForCloud(crmData);
  try{
    const photos=await storedAssetsFromInput(document.getElementById('receiptPhotos'));
    const now=new Date().toISOString();let item=inventoryItemById(get('receiptItem'));
    if(!item){
      const price=discountedInventoryPrice(base,rate);
      item={id:'item_receipt_'+encodeURIComponent(serial),name:model,qty:'0',quantity:'0',unit:'قطعة',unitPrice:String(price),unitCost:String(price),cost:String(price),dealerPrice:base,priceRate:rate,createdAt:now,updatedAt:now};
      crmData.inventory.push(item);
    }
    // The receipt is the stock increment, avoiding a lost counter increment across devices.
    crmData.receipts=crmData.receipts||[];
    crmData.receipts.push({id:'receipt_'+encodeURIComponent(serial),itemId:item.id,serial,model,date,photos,notes:get('receiptNotes'),dealerPrice:base,priceRate:rate,unitPrice:discountedInventoryPrice(base,rate),createdAt:now,updatedAt:now});
    await saveCrmData();document.getElementById('receiptForm').reset();document.getElementById('receiptDate').value=crmDate();clearSelectedAssets('receiptPhotos');renderCrm();toast('تم حفظ الوارد وإضافته للمخزن');
  }catch(error){crmData=before;toast(error.message||'تعذر حفظ الوارد؛ أعد المحاولة');}
  finally{receiptBusy=false;document.getElementById('receiptSave').disabled=false;}
}
const beforeReceiptBalance=inventoryBalance;
inventoryBalance=function(id){return beforeReceiptBalance(id)+(crmData.receipts||[]).filter(r=>r.itemId===id).length;};
async function readReceiptSerial(){
  const input=document.getElementById('receiptPhotos'),file=(selectedAssetFiles.get(input)||Array.from(input.files))[0];
  if(!file){toast('اختار صورة السيريال أولًا');return;}
  const button=document.getElementById('receiptReadSerial'),status=document.getElementById('receiptOcrStatus');button.disabled=true;let worker;
  try{
    status.textContent='جارٍ قراءة الصورة على جهازك…';
    if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
    worker=await Tesseract.createWorker('eng');
    const {data}=await worker.recognize(file);
    const match=data.text.match(/(?:S\/?N|SERIAL(?:\s*(?:NO|NUMBER))?)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i);
    if(match){document.getElementById('receiptSerial').value=match[1].toUpperCase();status.textContent='تم اقتراح السيريال. طابقه مع الصورة قبل الحفظ.';}
    else{status.textContent='لم يتم تحديد السيريال بثقة؛ اكتبه يدويًا. النص المقروء: '+data.text.slice(0,800);}
  }catch{status.textContent='تعذرت القراءة الآلية. يمكنك كتابة السيريال يدويًا والاحتفاظ بالصورة.';}
  finally{if(worker)await worker.terminate();button.disabled=false;}
}
const beforeUpgradeRenderCrm=renderCrm;
renderCrm=function(){beforeUpgradeRenderCrm();renderCompletedJobs();renderReceipts();};
const backup=document.createElement('div');backup.className='fg-upgrade fg-backup';backup.innerHTML='<p>الصور والمستندات محفوظة على هذا الجهاز. احتفظ بنسخة احتياطية قبل تغيير الجهاز أو مسح بيانات المتصفح. لا يوجد حد لعدد الصور؛ المساحة المتاحة وحجم الملف هما الحد.</p><button type="button" onclick="exportFullCrmBackup()">تنزيل نسخة احتياطية بالصور</button>';
document.getElementById('crmCustomerNotes').after(backup);
