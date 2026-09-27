/* IndexedDB retains attachments without the small localStorage quota.
 * Private documents remain on this browser, as in the previous release.
 * Cloud changes use a three-way merge and optimistic compare-and-swap.
 */
let fgDb, durableCrm, crmBaseline, durablePendingWrite=Promise.resolve(),dbWriteTail=Promise.resolve();
let crmDurableReady=false,crmMutationVersion=0;
function openFgDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('fast-group-durable-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('state');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function durableRead(key){
  return new Promise((resolve,reject)=>{
    const request=fgDb.transaction('state').objectStore('state').get(key);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
function durableWrite(entries){
  const operation=dbWriteTail.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
    const tx=fgDb.transaction('state','readwrite');
    const values=typeof entries==='function'?entries():entries;
    for(const [key,value] of Object.entries(values)) tx.objectStore('state').put(value,key);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage aborted'));
  }));
  dbWriteTail=operation;return operation;
}
async function initializeDurableCrm(){
  try{
    fgDb=await openFgDb();
    [durableCrm,crmBaseline]=await Promise.all([durableRead('crm'),durableRead('crmBaseline')]);
    const savedPending=await durableRead('pending');
    if(savedPending) pendingSync=savedPending;
    if(!await durableRead('preUpdateBackup')){
      const legacy=localStorage.getItem(STORAGE_KEYS.crm);
      await durableWrite({preUpdateBackup:{at:new Date().toISOString(),crm:legacy,pending:localStorage.getItem(pendingSyncKey)}});
    }
    const legacyCrm=localStorage.getItem(STORAGE_KEYS.crm);
    if(!durableCrm && legacyCrm) durableCrm=normalizeCrmData(JSON.parse(legacyCrm));
    await durableWrite({crm:durableCrm||emptyCrmData(),pending:cloneForCloud(pendingSync)});
    // Remove only the migrated duplicate after both the full backup and IndexedDB commit succeed.
    if(localStorage.getItem(STORAGE_KEYS.crm)===legacyCrm) localStorage.removeItem(STORAGE_KEYS.crm);
    localStorage.removeItem(pendingSyncKey);
    crmDurableReady=true;
  }catch(error){
    showSyncState('تعذر فتح مساحة الحفظ. لا تغلق الصفحة قبل تصدير نسخة احتياطية.');
    throw error;
  }
}
const legacyLoadCrmData=loadCrmData;
loadCrmData=function(){
  legacyLoadCrmData();
  if(durableCrm) crmData=normalizeCrmData(durableCrm);
  selectedCrmCustomerId=crmData.customers[0]?.id||null;
  selectedCrmTechId=crmData.technicians[0]?.id||null;
};
const PRIVATE_CRM_FIELDS={customers:['idCard','taxInvoice','idCards','taxInvoices'],jobs:['beforePhoto','afterPhoto','beforePhotos','afterPhotos','devicePhotos'],purchases:['photo','photos'],receipts:['photos']};
crmCloudSnapshot=function(value){
  const safe=cloneForCloud(value||{});
  for(const [collection,fields] of Object.entries(PRIVATE_CRM_FIELDS))
    for(const record of safe[collection]||[]) for(const field of fields) delete record[field];
  return safe;
};
mergeLocalPrivateAssets=function(incoming){
  const next=cloneForCloud(incoming);
  for(const [collection,fields] of Object.entries(PRIVATE_CRM_FIELDS)){
    const local=new Map((crmData[collection]||[]).map(x=>[x.id,x]));
    for(const record of next[collection]||[]) for(const field of fields)
      if(local.get(record.id)?.[field]) record[field]=local.get(record.id)[field];
  }
  return next;
};
persistPendingSync=function(){
  if(!fgDb) return;
  // Read the outbox when this queued transaction starts, so an audit write cannot
  // restore an older snapshot over a newer, atomically committed CRM save.
  durablePendingWrite=durableWrite(()=>({pending:cloneForCloud(pendingSync)}));
  durablePendingWrite.catch(()=>showSyncState('مساحة الحفظ غير متاحة — صدّر نسخة احتياطية قبل إغلاق الصفحة'));
  return durablePendingWrite;
};
saveCrmData=async function(){
  if(!crmDurableReady) throw new Error('مساحة الحفظ غير جاهزة؛ أعد فتح الموقع');
  crmData=normalizeCrmData(crmData);
  const snapshot=cloneForCloud(crmData);
  crmMutationVersion++;
  const entry={value:crmCloudSnapshot(snapshot),revision:Date.now()+Math.random(),base:cloneForCloud(crmBaseline||{})};
  // One transaction commits the record and its outbox together.
  const nextPending={...pendingSync,crm:entry};
  const previous=pendingSync.crm;pendingSync.crm=entry;
  const commit=durableWrite({crm:snapshot,pending:nextPending});
  durablePendingWrite=commit;
  try{await commit;}catch(error){if(pendingSync.crm===entry){if(previous)pendingSync.crm=previous;else delete pendingSync.crm;}throw error;}
  durableCrm=snapshot;
  showSyncState('تم الحفظ على الجهاز — جارٍ المزامنة');
  clearTimeout(cloudSyncTimers.crm);
  cloudSyncTimers.crm=setTimeout(()=>saveCloudState('crm'),300);
  return true;
};
const previousApplyCloudState=applyCloudState;
applyCloudState=async function(name,value,updatedAt=''){
  if(name!=='crm') return previousApplyCloudState(name,value,updatedAt);
  if(pendingSync.crm || cloudSyncSaving.crm) return false;
  // Local backups may contain superseded stock/staff IDs. Their initial cloud lists are authoritative;
  // keep the original local snapshot in IndexedDB for recovery, not as live stock/staff.
  const migrated=crmBaseline?value:mergeCrmChanges({},value,crmCloudSnapshot(crmData));
  if(!crmBaseline){
    migrated.inventory=value.inventory||[];
    migrated.technicians=value.technicians||[];
  }
  const next=normalizeCrmData(mergeLocalPrivateAssets(applyCrmRecordCorrections(migrated,value)));
  const version=crmMutationVersion;
  await durableWrite({crm:next,crmBaseline:value});
  if(pendingSync.crm || cloudSyncSaving.crm || crmMutationVersion!==version) return false;
  crmData=next;durableCrm=next;crmBaseline=cloneForCloud(value);cloudSyncMeta.crm=updatedAt;
  if(JSON.stringify(crmCloudSnapshot(next))!==JSON.stringify(value)) await saveCrmData();
  try{refreshCrmFromCloud();}catch{}
  return true;
};
const previousCloudUpsertState=cloudUpsertState;
cloudUpsertState=async function(name,value){
  if(name!=='crm') return previousCloudUpsertState(name,value);
  const base=cloneForCloud(pendingSync.crm?.base||crmBaseline||{});
  for(let attempt=0;attempt<5;attempt++){
    const remote=await cloudGetState('crm');
    if(!remote || !remote.value || !remote.updated_at) throw new Error('تعذر قراءة النسخة الحالية؛ لن يتم استبدال البيانات');
    const merged=mergeCrmWithCorrections(base,value,remote.value);
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(remote.updated_at)+1)).toISOString();
    const rows=await cloudRequest(`${encodeURIComponent(SUPABASE_SYNC.table)}?key=eq.${encodeURIComponent(cloudStateKey('crm'))}&updated_at=eq.${encodeURIComponent(remote.updated_at)}`,{
      method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({value:merged,updated_at:updatedAt})
    });
    if(!Array.isArray(rows)||rows.length!==1) continue;
    const latest=pendingSync.crm;
    const newer=latest && JSON.stringify(latest.value)!==JSON.stringify(value);
    const combined=mergeCrmWithCorrections(value,crmCloudSnapshot(crmData),merged);
    const next=normalizeCrmData(mergeLocalPrivateAssets(combined));
    if(newer) pendingSync.crm={...latest,value:combined,base:merged};
    crmData=next;durableCrm=next;crmBaseline=merged;cloudSyncMeta.crm=updatedAt;
    await durableWrite({crm:next,crmBaseline:merged,pending:cloneForCloud(pendingSync)});
    try{refreshCrmFromCloud();}catch{}
    return updatedAt;
  }
  throw new Error('توجد تعديلات متزامنة؛ ستتم إعادة المحاولة تلقائيًا');
};
const previousSaveCloudState=saveCloudState;
const activeCloudSaves={};
saveCloudState=function(name){
  if(!crmDurableReady) return Promise.resolve(false);
  if(activeCloudSaves[name]) return activeCloudSaves[name];
  activeCloudSaves[name]=(async()=>{
    try{
      await durablePendingWrite;
      const result=await previousSaveCloudState(name);
      await durablePendingWrite;
      return result;
    }catch{showSyncState('تعذر الحفظ الدائم؛ أعد المحاولة قبل إغلاق الصفحة');return false;}
    finally{delete activeCloudSaves[name];}
  })();
  return activeCloudSaves[name];
};
const previousPullCloudState=pullCloudState;
pullCloudState=async function(name){
  if(!crmDurableReady) return false;
  return previousPullCloudState(name);
};
let activeFullSync;
syncAllCloudState=function(){
  if(activeFullSync) return activeFullSync;
  activeFullSync=(async()=>{
    lastSyncReadFailed=false;
    try{
      await Promise.all(['products','crm','reviews','adminCreds','auditLog'].map(pullCloudState));
      if(!lastSyncReadFailed&&!Object.keys(pendingSync).length) showSyncState('تمت المزامنة — الصور والمرفقات محفوظة على هذا الجهاز');
    }finally{activeFullSync=null;}
  })();return activeFullSync;
};
saveAuditLog=function(list){
  try{localStorage.setItem(STORAGE_KEYS.auditLog,JSON.stringify(list));}catch{}
  queueCloudSave('auditLog',list);
};
// A background refresh must not change the customer or technician currently selected in a form.
const previousRenderCrmSelects=renderCrmSelects;
renderCrmSelects=function(){
  const ids=['crmJobCustomer','crmJobTechnician','crmJobProject','projectCustomer','stockMoveItem','stockMoveProject','stockMoveJob'];
  const selected=ids.map(id=>[id,document.getElementById(id)?.value]);
  previousRenderCrmSelects();
  for(const [id,value] of selected){const el=document.getElementById(id);if(el && [...el.options].some(o=>o.value===value)) el.value=value;}
};
async function exportFullCrmBackup(){
  if(!requireAdminAccess('customers') && !canAccessAdmin('inventory')) return;
  const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),crmData,pending:pendingSync.crm},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`fast-group-backup-${crmDate()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
