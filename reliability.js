/* Durable pending saves, bounded requests, and visible connection state. */
const pendingSyncKey='fg_pending_sync_v5';
let pendingSync={};
try { pendingSync=JSON.parse(localStorage.getItem(pendingSyncKey)||'{}'); } catch {}
let adminCloudChecked=false;
let lastSyncReadFailed=false;
function persistPendingSync(){localStorage.setItem(pendingSyncKey,JSON.stringify(pendingSync));}
function showSyncState(message){
  const el=document.getElementById('syncStatus');if(el) el.textContent=message;
}
const originalCloudRequest=cloudRequest;
cloudRequest=async function(path,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{return await originalCloudRequest(path,{...options,signal:controller.signal});}
  finally{clearTimeout(timer);}
};
queueCloudSave=function(name,value=readLocalCloudState(name)){
  if(cloudSyncApplying || !cloudSyncEnabled()) return;
  pendingSync[name]={value:name==='crm'?crmCloudSnapshot(value):cloneForCloud(value),revision:Date.now()+Math.random()};
  persistPendingSync();showSyncState('تعديلات محفوظة على الجهاز — في انتظار المزامنة');
  clearTimeout(cloudSyncTimers[name]);
  cloudSyncTimers[name]=setTimeout(()=>saveCloudState(name),300);
};
saveCloudState=async function(name){
  if(!cloudSyncEnabled() || cloudSyncSaving[name]) return false;
  if(!pendingSync[name]) return true;
  cloudSyncSaving[name]=true;
  try{
    while(pendingSync[name]){
      const entry=pendingSync[name];
      showSyncState('جارٍ رفع التعديلات…');
      await cloudUpsertState(name,entry.value);
      if(pendingSync[name]?.revision===entry.revision){delete pendingSync[name];persistPendingSync();}
    }
    showSyncState(Object.keys(pendingSync).length?'توجد تعديلات في انتظار المزامنة':'تم رفع التعديلات — الصور والمرفقات محلية');
    return true;
  }catch(error){showSyncState('فشل الاتصال — التعديلات محفوظة وستُعاد المحاولة');return false;}
  finally{cloudSyncSaving[name]=false;}
};
pullCloudState=async function(name){
  if(!cloudSyncEnabled()) return false;
  // Never let a poll overwrite an unsent local edit.
  if(pendingSync[name] || cloudSyncSaving[name]) return saveCloudState(name);
  try{
    const row=await cloudGetState(name);
    if(name==='adminCreds') adminCloudChecked=true;
    if(pendingSync[name] || cloudSyncSaving[name]) return false;
    if(!row || !cloudValueIsUsable(name,row.value)) return false;
    if(row.updated_at && row.updated_at===cloudSyncMeta[name]) return false;
    return applyCloudState(name,row.value,row.updated_at||'');
  }catch(error){lastSyncReadFailed=true;showSyncState('تعذر الاتصال — لم يتم تأكيد المزامنة');return false;}
};
let fullSyncRunning=false;
syncAllCloudState=async function(){
  if(fullSyncRunning) return;
  fullSyncRunning=true;
  lastSyncReadFailed=false;
  try{
    await Promise.all(['products','crm','reviews','adminCreds','auditLog'].map(pullCloudState));
    if(!lastSyncReadFailed && !Object.keys(pendingSync).length) showSyncState('تمت المزامنة — الصور والمرفقات محلية');
  }
  finally{fullSyncRunning=false;}
};
window.addEventListener('online',()=>syncAllCloudState());
const originalOpenAdminLogin=openAdminLogin;
openAdminLogin=async function(){
  await pullCloudState('adminCreds');
  await originalOpenAdminLogin();
  if(ownerPasswordMissing() && cloudSyncEnabled() && !adminCloudChecked){
    document.getElementById('adminLoginHint').textContent='تعذر تحميل الحسابات. أعد المحاولة عند عودة الاتصال؛ لن يتم إنشاء مالك بديل.';
    document.getElementById('adminLoginButton').disabled=true;
  }else document.getElementById('adminLoginButton').disabled=false;
};
const originalAdminLogin=adminLogin;
adminLogin=async function(){
  if(!cryptoReady()){toast('افتح رابط الموقع الآمن HTTPS لتسجيل الدخول من الموبايل');return;}
  await pullCloudState('adminCreds');
  if(ownerPasswordMissing() && cloudSyncEnabled() && !adminCloudChecked){toast('تعذر تحميل حسابات الأدمن؛ حاول عند عودة الاتصال');return;}
  try{return await originalAdminLogin();}catch(error){toast('تعذر تسجيل الدخول. تحقق من الاتصال وحاول مرة أخرى');}
};
const originalSaveAdminCredentials=saveAdminCredentialsFromModal;
saveAdminCredentialsFromModal=async function(){
  await originalSaveAdminCredentials();
  if(pendingSync.adminCreds){
    const saved=await saveCloudState('adminCreds');
    toast(saved?'تمت مزامنة الحسابات؛ يمكن الدخول من الجهاز الآخر':'الحساب محفوظ محليًا؛ انتظر نجاح المزامنة قبل الدخول من جهاز آخر');
  }
};
async function copyReviewsLink(){
  const field=document.getElementById('reviewsShareLink');
  if(!/^https?:$/.test(location.protocol)){toast('افتح الموقع من رابط النشر أولًا لنسخ رابط صالح للعملاء');return;}
  const url=new URL(location.href);url.hash='reviews';url.search='';field.value=url.href;
  try{await navigator.clipboard.writeText(url.href);toast('تم نسخ رابط التقييمات');}
  catch{field.focus();field.select();toast('الرابط محدد؛ انسخه من الخانة');}
}
window.addEventListener('DOMContentLoaded',()=>{
  const search=document.getElementById('searchInput');
  search.placeholder='ابحث بالموديل — مثل KH';
  const searchPanel=search.closest('.reveal');if(searchPanel) searchPanel.classList.add('in');
  document.getElementById('adminSearch').placeholder='ابحث بالموديل — مثل KH';
  const field=document.getElementById('reviewsShareLink');
  if(/^https?:$/.test(location.protocol)){const url=new URL(location.href);url.hash='reviews';url.search='';field.value=url.href;}
  else field.placeholder='رابط التقييمات يظهر عند فتح الموقع المنشور';
});
