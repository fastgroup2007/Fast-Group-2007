const {chromium}=require('playwright');
const assert=require('node:assert/strict');const fs=require('node:fs');
const {mergeCrmChanges}=require('../crm-merge.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const results=[];const ok=s=>{results.push(s);console.log('PASS',s);};
async function main(){
 const base={customers:[{id:'c',name:'Old',phone:'1'}],inventory:[{id:'stock',name:'Stock',qty:'77',unitPrice:'1000'}],jobs:[],technicians:[{id:'t',name:'Test Tech',role:'فني'}],purchases:[],expenses:[],stockMoves:[],projects:[],futureField:{keep:true}};
 const a=clone(base),b=clone(base);a.customers[0].name='New';b.customers[0].phone='2';b.inventory.push({id:'new',qty:'4'});
 const m=mergeCrmChanges(base,a,b);assert.equal(m.customers[0].name,'New');assert.equal(m.customers[0].phone,'2');assert.equal(m.inventory.length,2);ok('Three-way field merge preserves other device edits and stock');
 let timestamp=1,conflict=false,offline=false;
 const stamp=()=>new Date(Date.UTC(2026,8,27,0,0,timestamp++)).toISOString();
 const accounts=[{username:'mustafa259',role:'owner',permissions:['all'],passwordHash:'hash',passwordSalt:'salt'}, {username:'employee',role:'user',permissions:['customers','jobs','inventory'],passwordHash:'hash',passwordSalt:'salt'}];
 const cloud={crm:{value:clone(base),updated_at:stamp()},adminCreds:{value:accounts,updated_at:stamp()},products:{value:[],updated_at:stamp()},reviews:{value:[],updated_at:stamp()},auditLog:{value:[],updated_at:stamp()}};
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const errors=[];
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
 await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='127.0.0.1')return route.continue();
   if(url.hostname.endsWith('supabase.co')){
    if(offline)return route.abort();
    const key=(url.searchParams.get('key')||'').replace(/^eq\./,'');
    if(req.method()==='GET')return route.fulfill({json:cloud[key]?[cloud[key]]:[]});
    const body=req.postDataJSON();
    if(req.method()==='PATCH'){
      if(conflict){conflict=false;cloud.crm.value.inventory.push({id:'race-stock',name:'Remote stock',qty:'9',unitPrice:'50'});cloud.crm.updated_at=stamp();}
      if(url.searchParams.get('updated_at')!=='eq.'+cloud[key].updated_at)return route.fulfill({json:[]});
      cloud[key]={value:body.value,updated_at:body.updated_at};return route.fulfill({json:[cloud[key]]});
    }
    cloud[body.key]={value:body.value,updated_at:body.updated_at};return route.fulfill({status:204});
   }
   return route.abort();
 });
 await context.addInitScript(({accounts,base})=>{
   if(!localStorage.getItem('testSeed')){
     localStorage.setItem('testSeed','1');localStorage.setItem('fg_admin_creds_v1',JSON.stringify(accounts));
     const legacy=JSON.parse(JSON.stringify(base));legacy.customers[0].idCard={name:'old.png',type:'image/png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII='};
     localStorage.setItem('fg_admin_crm_v1',JSON.stringify(legacy));
   }
   sessionStorage.setItem('fg_admin_auth_v3','true');sessionStorage.setItem('fg_current_admin_v1','employee');
 },{accounts,base});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/',{waitUntil:'load'});await page.waitForFunction(()=>typeof crmDurableReady!=='undefined'&&crmDurableReady&&crmData.customers.length>0);await page.waitForTimeout(700);
 assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>canAccessAdmin('customers')),true);
 await page.evaluate(()=>{openAdminPanel();switchAdminView('customers');});
 assert.equal(await page.evaluate(()=>crmData.customers.find(c=>c.id==='c').idCard.name),'old.png');
 assert.equal(await page.evaluate(()=>inventoryBalance('stock')),77);ok('Upgrade retains legacy customer document and 77 stock units');
 // A non-admin employee saves with localStorage writes blocked, reproducing phone quota failures.
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fg_admin_crm_v1'||k==='fg_pending_sync_v5'||k==='fg_audit_log_v1')throw new DOMException('Quota','QuotaExceededError');return original.call(this,k,v);};resetCustomerForm();});
 await page.fill('#crmCustomerName','عميل الموبايل');await page.fill('#crmCustomerPhone','01000000001');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=','base64');
 // Distinct PDFs check true multi-file preservation without image compressor deduplication.
 await page.setInputFiles('#crmCustomerTaxInvoice',[{name:'one.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 one')},{name:'two.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 two')}]);
 await page.evaluate(()=>saveCustomer());await page.waitForTimeout(500);
 const cid=await page.inputValue('#crmCustomerId');assert.ok(cid);
 assert.equal(await page.evaluate(id=>crmCustomerById(id).taxInvoice.length,cid),2);
 assert.ok(cloud.crm.value.customers.some(c=>c.id===cid));assert.ok(!cloud.crm.value.customers.find(c=>c.id===cid).taxInvoice);ok('Mobile employee saves customer + multiple private invoices despite localStorage quota');
 await page.setInputFiles('#crmCustomerTaxInvoice',{name:'three.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 three')});
 await page.evaluate(()=>saveCustomer());assert.equal(await page.evaluate(id=>crmCustomerById(id).taxInvoice.length,cid),3);ok('Adding attachments preserves previously saved files');
 await page.evaluate(()=>{addPriorJob();document.querySelector('#priorJobsBuilder').closest('details').open=true;});await page.fill('.prior-date','2026-09-20');await page.fill('.prior-model','صيانة سابقة');await page.fill('.prior-technician','أحمد');await page.setInputFiles('.prior-photos',{name:'serial.png',mimeType:'image/png',buffer:png});
 await page.evaluate(()=>saveCustomer());assert.equal(await page.evaluate(()=>crmData.jobs.find(j=>j.historical).technicianName),'أحمد');assert.equal(await page.evaluate(()=>crmData.jobs.find(j=>j.historical).devicePhotos.length),1);ok('Historical work saves technician name, date and device image');
 await page.evaluate(id=>{switchAdminView('jobs');resetJobForm();document.getElementById('crmJobCustomer').value=id;document.getElementById('crmJobTechnician').value='t';document.getElementById('crmJobTitle').value='شغل اختبار';},cid);
 await page.evaluate(()=>saveJob());const jid=await page.inputValue('#crmJobId');assert.ok(jid);await page.evaluate(id=>completeJob(id),jid);
 assert.equal(await page.evaluate(id=>crmJobById(id).status,jid),'تم التنفيذ');assert.equal(await page.locator('#crmJobsList').getByText('شغل اختبار',{exact:true}).count(),0);assert.equal(await page.locator('#completedJobsList').getByText('شغل اختبار',{exact:true}).count(),1);
 await page.evaluate(()=>switchAdminView('completed'));await page.fill('#completedFrom','2027-01-01');await page.evaluate(()=>renderCompletedJobs());assert.equal(await page.locator('#completedJobsList').getByText('شغل اختبار',{exact:true}).count(),0);ok('Complete moves the same job to executed list and date filters work');
 await page.evaluate(()=>{switchAdminView('inventory');fillInventoryItemForm('stock');});await page.selectOption('#inventoryPriceRate','7');await page.evaluate(()=>saveInventoryItem());assert.equal(await page.evaluate(()=>inventoryUnitPrice(inventoryItemById('stock'))),930);assert.equal(await page.evaluate(()=>inventoryBalance('stock')),77);ok('7% pricing adjusts price without changing existing stock count');
 await page.evaluate(()=>switchAdminView('receipts'));assert.equal(await page.evaluate(()=>document.querySelector('[data-admin-view=receipts]').scrollWidth <= document.querySelector('[data-admin-view=receipts]').clientWidth),true);await page.selectOption('#receiptItem','stock');await page.fill('#receiptSerial','SN-TEST-001');await page.evaluate(()=>saveReceipt());assert.equal(await page.evaluate(()=>inventoryBalance('stock')),78);
 await page.selectOption('#receiptItem','stock');await page.fill('#receiptSerial','SN-TEST-001');await page.evaluate(()=>saveReceipt());assert.equal(await page.evaluate(()=>inventoryBalance('stock')),78);ok('Receipt adds exactly one unit; duplicate serial rejected');
 await page.evaluate(()=>{switchAdminView('inventory');fillInventoryItemForm('stock');});await page.evaluate(()=>saveInventoryItem());assert.equal(await page.evaluate(()=>inventoryBalance('stock')),78);ok('Editing inventory after a receipt does not double-count arrivals');
 conflict=true;await page.evaluate(()=>{crmData.customers[0].notes='concurrent edit';return saveCrmData();});await page.evaluate(()=>saveCloudState('crm'));assert.ok(cloud.crm.value.inventory.some(x=>x.id==='race-stock'));ok('CAS retry retains a simultaneous remote inventory addition');
 offline=true;await page.evaluate(()=>{crmData.customers[0].notes='offline retained';return saveCrmData();});await page.evaluate(()=>saveCloudState('crm'));await page.reload({waitUntil:'load'});await page.waitForFunction(()=>crmDurableReady&&crmData.customers.length>0);assert.equal(await page.evaluate(()=>crmData.customers.find(x=>x.id==='c').notes),'offline retained');
 offline=false;await page.evaluate(()=>syncAllCloudState());assert.equal(cloud.crm.value.customers.find(x=>x.id==='c').notes,'offline retained');ok('Offline pending edits and photos survive reload, then retry successfully');
 await page.evaluate(()=>{openAdminPanel();switchAdminView('receipts');});await page.screenshot({path:'./mobile-receipts.png',fullPage:false});
 assert.deepEqual(errors,[]);ok('No JavaScript runtime errors in mobile workflows');
 // The OCR workflow must fill a suggestion without changing inventory until submit.
 await page.setInputFiles('#receiptPhotos',{name:'label.png',mimeType:'image/png',buffer:png});
 await page.evaluate(()=>{window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:'MODEL: 42KH\\nS/N: ABC123456'}}),terminate:async()=>{}})};});
 const stockBeforeOcr=await page.evaluate(()=>inventoryBalance('stock'));
 await page.evaluate(()=>readReceiptSerial());assert.equal(await page.inputValue('#receiptSerial'),'ABC123456');assert.equal(await page.evaluate(()=>inventoryBalance('stock')),stockBeforeOcr);ok('OCR suggestion requires review and never changes stock before saving');
 await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>switchAdminView('completed'));await page.screenshot({path:'./desktop-completed.png'});
 // Limited permissions cannot save inventory; linked technicians only see assigned jobs.
 await page.evaluate(()=>{currentAdminUser='employee';const list=JSON.parse(localStorage.getItem(STORAGE_KEYS.adminCreds));list.find(x=>x.username==='employee').permissions=['customers','jobs'];list.find(x=>x.username==='employee').technicianId='t';localStorage.setItem(STORAGE_KEYS.adminCreds,JSON.stringify(list));});
 assert.equal(await page.evaluate(()=>canAccessAdmin('receipts')),false);assert.equal(await page.evaluate(()=>canAccessJobRecord({technicianId:'different'})),false);ok('Existing staff permission and technician assignment restrictions preserved');

 await browser.close();fs.writeFileSync('./test-results.json',JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
