/* Shared, read-only projections. Unknown dates and capacities stay unknown. */
(function(root){
  const capacities={12:1.5,18:2.25,24:3,30:4,36:5,48:6,60:7.5};
  function validDay(value){
    const day=String(value||'').slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day?day:'';
  }
  function actualVisitDate(job){
    if(job.status!=='تم التنفيذ')return '';
    return validDay(job.visitDate)||validDay(job.completedAt)||validDay(job.doneDate)||(job.historical?validDay(job.dueDate):'');
  }
  function customerVisits(jobs,customerId){
    return jobs.filter(j=>j.customerId===customerId&&j.status==='تم التنفيذ').slice().sort((a,b)=>actualVisitDate(b).localeCompare(actualVisitDate(a)));
  }
  function inventoryHorsepower(item){
    for(const raw of [item.model,item.name,item.sku]){
      const value=String(raw||'').replace(/[٠-٩]/g,x=>'٠١٢٣٤٥٦٧٨٩'.indexOf(x));
      const explicit=value.match(/(?:^|[^\d.])(1\.5|2\.25|3|4|5|6|7\.5)\s*(?:حصان|HP\b)/i);
      if(explicit)return Number(explicit[1]);
      // Require a model token, so dates, quantities and serial numbers aren't capacities.
      for(const token of value.toUpperCase().split(/\s+/)){
        if(!/[A-Z]/.test(token))continue;
        const code=token.match(/(?:^|[^\d])(12|18|24|30|36|48|60)(?!\d)/);
        if(code)return capacities[code[1]];
      }
    }
    return null;
  }
  function filterInventoryCapacity(items,query='',hp='all'){
    return items.filter(item=>[item.model,item.name,item.sku,item.category,item.notes].join(' ').toLowerCase().includes(query.toLowerCase())&&(hp==='all'||(hp==='unknown'?inventoryHorsepower(item)===null:inventoryHorsepower(item)===Number(hp))))
      .sort((a,b)=>(inventoryHorsepower(a)??Infinity)-(inventoryHorsepower(b)??Infinity)||String(a.name||'').localeCompare(String(b.name||'')));
  }
  Object.assign(root,{actualVisitDate,customerVisits,inventoryHorsepower,filterInventoryCapacity});
  if(typeof module!=='undefined')module.exports={actualVisitDate,customerVisits,inventoryHorsepower,filterInventoryCapacity};
})(globalThis);

function customerVisitSummary(customerId){
  const visits=customerVisits(crmData.jobs.filter(canAccessJobRecord),customerId);
  const day=visits.map(actualVisitDate).find(Boolean);
  return `<p class="text-sm mt-2">آخر زيارة منفذة: <strong>${escapeHtml(day||'لا يوجد تاريخ تنفيذ مسجل')}</strong> · ${visits.length} شغلانة منفذة</p>`;
}
function customerWorkHistory(customerId){
  const visits=customerVisits(crmData.jobs.filter(canAccessJobRecord),customerId);
  return customerVisitSummary(customerId)+`<details class="fg-record mt-2"><summary>سجل الشغل المنفذ للعميل (${visits.length})</summary>${visits.map(j=>`<p><strong>${escapeHtml(actualVisitDate(j)||'تاريخ التنفيذ غير مسجل')}</strong> — ${escapeHtml(j.title||j.type||'شغل')} — ${escapeHtml(crmTeamNames(j).join('، ')||'الفني غير مسجل')}</p>`).join('')||'<p>لا يوجد شغل منفذ مسجل.</p>'}</details>`;
}
