/* Keep background sync from replacing controls while a user is writing. */
let crmFormSaveCount=0;
const dirtyCrmViews=new Set();
document.addEventListener('input',markCrmDraft,true);
document.addEventListener('change',markCrmDraft,true);
function markCrmDraft(event){
  const view=event.target.closest?.('[data-admin-view]');
  if(view)dirtyCrmViews.add(view.dataset.adminView);
}
function refreshCrmFromCloud(){
  if(crmFormSaveCount||dirtyCrmViews.size)return;
  renderCrm();
}
function crmFieldError(element,message){
  element?.closest('details')?.setAttribute('open','');
  if(element){element.setAttribute('aria-invalid','true');element.scrollIntoView({block:'center',behavior:'smooth'});element.focus();}
  return new Error(message);
}
document.addEventListener('input',event=>event.target.removeAttribute?.('aria-invalid'));
for(const [name,view] of [['Customer','customers'],['Job','jobs']]){
  const reset=window[`reset${name}Form`],fill=window[`fill${name}Form`];
  const label=name==='Customer'?'عميل':'شغل';
  const button=document.querySelector(`[onclick="save${name}()"]`);
  const newLabel=`حفظ ${label} جديد`;
  button.textContent=newLabel;
  window[`reset${name}Form`]=function(...args){const result=reset(...args);dirtyCrmViews.delete(view);button.textContent=newLabel;return result;};
  window[`fill${name}Form`]=function(...args){const result=fill(...args);button.textContent=`حفظ تعديل ${label}`;return result;};
  const save=window[`save${name}`];let busy=false;
  window[`save${name}`]=async function(...args){
    if(busy)return;
    busy=true;crmFormSaveCount++;
    const form=document.getElementById(`crm${name}Id`).parentElement;
    const controls=[...form.querySelectorAll('input,select,textarea,button')].map(el=>[el,el.disabled]);
    controls.forEach(([el])=>el.disabled=true);
    const caption=button.textContent;button.textContent='جارٍ الحفظ…';
    try{
      const id=await save(...args);
      if(id){window[`reset${name}Form`]();toast(`تم حفظ ${label} — النموذج جاهز لإضافة جديد`);}
      return id;
    }finally{
      busy=false;crmFormSaveCount--;
      controls.forEach(([el,disabled])=>el.disabled=disabled);
      form.querySelector('[aria-invalid="true"]')?.focus();
      if(button.textContent==='جارٍ الحفظ…')button.textContent=caption;
    }
  };
}
